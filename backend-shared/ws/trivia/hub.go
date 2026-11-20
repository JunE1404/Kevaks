package trivia

import (
	"encoding/json"
	"errors"
	"log"
	"sync"

	"github.com/fasthttp/websocket"
	"github.com/google/uuid"
	triv "github.com/kevaks/backend-shared/games/trivia"
	lk "github.com/kevaks/backend-shared/livekit"
)

var (
	hubMu       sync.RWMutex
	HubInstance *Hub
)

func GetHub() *Hub {
	hubMu.RLock()
	defer hubMu.RUnlock()
	return HubInstance
}

// Event is the envelope used for both incoming and outgoing websocket
// messages. Event is always present. UID is filled in by the server for
// broadcasts so clients know who caused the event, and Data carries any
// event-specific payload.
type Event struct {
	Event string          `json:"event"`
	UID   string          `json:"uid,omitempty"`
	Data  json.RawMessage `json:"data,omitempty"`
}

// Client is a single websocket connection together with the user it belongs
// to. A user may have more than one connection.
type Client struct {
	UID        uuid.UUID
	Conn       *websocket.Conn
	Joined     bool
	AdminPanel bool
	writeMu    sync.Mutex
}

func TriviaLobbyActive() bool {
	return GetHub() != nil
}

func (h *Hub) disconnect(c *Client) {
	c.Conn.Close()
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

// destroyIfEmpty clears the global hub once no connections remain. Serve
// re-checks GetHub after registering its connection to close the race with a
// hub that self-destructed in the meantime.
func (h *Hub) destroyIfEmpty() {
	hubMu.Lock()
	if HubInstance != h {
		hubMu.Unlock()
		return
	}

	h.mu.RLock()
	empty := len(h.clients) == 0
	h.mu.RUnlock()
	if !empty {
		hubMu.Unlock()
		return
	}

	HubInstance = nil
	hubMu.Unlock()

	h.closeRoom()
}

func (h *Hub) closeRoom() {
	h.mu.Lock()
	room := h.Room
	h.Room = nil
	h.mu.Unlock()
	if room == nil {
		return
	}
	if err := room.CloseRoom(); err != nil {
		log.Println("trivia: close livekit room:", err)
	}
}

func (c *Client) Send(event Event) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.Conn.WriteJSON(event)
}

// Hub keeps track of all connected clients and fans messages out to them.
type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
	Game    *triv.Game
	Room    *lk.LK
}

func NewHub(game *triv.Game) bool {
	hub := &Hub{clients: make(map[*Client]struct{}), Game: game}

	if name := game.RoomName(); name != "" {
		room, err := lk.NewRoom(name)
		switch {
		case err == nil:
			hub.Room = room
		case !errors.Is(err, lk.ErrNotConfigured):
			log.Println("trivia: create livekit room:", err)
		}
	}

	hubMu.Lock()
	previous := HubInstance
	HubInstance = hub
	hubMu.Unlock()

	if previous != nil && previous != hub {
		previous.closeRoom()
	}
	return true
}

// JoinToken returns a LiveKit join token for uid.
func (h *Hub) JoinToken(uid uuid.UUID) (string, error) {
	h.mu.RLock()
	room := h.Room
	h.mu.RUnlock()
	if room == nil {
		return "", lk.ErrNotConfigured
	}

	player, ok := h.Game.Player(uid)
	if !ok {
		return "", triv.ErrNotInGame
	}
	return room.GetJoinToken(uid.String(), player.Name)
}

func (h *Hub) LiveKitURL() string {
	h.mu.RLock()
	room := h.Room
	h.mu.RUnlock()
	if room == nil {
		return ""
	}
	return room.ClientURL()
}

// register adds the connection if the user is still under their connection
// limit. The limit is checked and the client inserted under the same lock so
// concurrent connections cannot both pass.
func (h *Hub) register(uid uuid.UUID, client *Client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	count := 0
	for existing := range h.clients {
		if existing.UID == uid {
			count++
		}
	}
	if count >= h.Game.ConnectionLimit(uid) {
		return false
	}
	h.clients[client] = struct{}{}
	return true
}

// Serve registers the connection, runs the read loop and cleans up when the
// connection goes away. It blocks until the client disconnects.
func (h *Hub) Serve(uid uuid.UUID, conn *websocket.Conn) {
	client := &Client{UID: uid, Conn: conn}

	if !h.register(uid, client) {
		_ = client.Send(createErrorEvent("join", triv.ErrConnectionLimit.Error(), uid))
		_ = conn.Close()
		return
	}

	// The hub may have self-destructed (or been replaced) between the handler
	// fetching it and this goroutine registering the connection.
	if GetHub() != h {
		h.mu.Lock()
		delete(h.clients, client)
		h.mu.Unlock()
		_ = conn.Close()
		return
	}

	defer func() {
		h.mu.Lock()
		delete(h.clients, client)
		joined := client.Joined
		stillConnected := false
		if joined {
			for other := range h.clients {
				if other.UID == uid && other.Joined {
					stillConnected = true
					break
				}
			}
		}
		h.mu.Unlock()

		if joined && !stillConnected {
			h.Game.PlayerDisconnect(uid)
			h.Broadcast(Event{Event: "user_quit", UID: uid.String()})
		}
		_ = conn.Close()
		h.destroyIfEmpty()
	}()

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		h.handleMessage(client, data)
	}
}

func createErrorEvent(code, message string, uid uuid.UUID) Event {
	data, _ := json.Marshal(struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}{Code: code, Message: message})
	return Event{Event: "error", UID: uid.String(), Data: data}
}

// Broadcast sends event to every currently connected client. Each client has
// its own write mutex, so this can be called concurrently.
func (h *Hub) Broadcast(event Event) {
	if len(event.Data) == 0 && h.Game != nil {
		if data, err := h.Game.Snapshot(); err == nil {
			event.Data = data
		}
	}

	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for client := range h.clients {
		clients = append(clients, client)
	}
	h.mu.RUnlock()

	for _, client := range clients {
		_ = client.Send(event)
	}
}

// sendAdminBoard sends the full board configuration to a single admin
// connection. It is deliberately not a broadcast: questions, answers and
// special text must never reach regular players.
func (h *Hub) sendAdminBoard(client *Client) {
	board, err := h.Game.AdminBoard(client.UID)
	if err != nil {
		_ = client.Send(createErrorEvent("admin_board", "Unable to load the admin board.", client.UID))
		return
	}

	data, err := json.Marshal(board)
	if err != nil {
		_ = client.Send(createErrorEvent("admin_board", "Unable to load the admin board.", client.UID))
		return
	}

	h.mu.Lock()
	client.AdminPanel = true
	h.mu.Unlock()

	_ = client.Send(Event{Event: "admin_board", UID: client.UID.String(), Data: data})
}

func (h *Hub) isJoined(client *Client) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return client.Joined
}

// requireOwner rejects admin-only actions from anybody but the game owner.
func (h *Hub) requireOwner(client *Client, code string) bool {
	if !h.isJoined(client) {
		_ = client.Send(createErrorEvent(code, triv.ErrNotJoined.Error(), client.UID))
		return false
	}
	if !h.Game.IsOwner(client.UID) {
		_ = client.Send(createErrorEvent(code, triv.ErrAdminOnly.Error(), client.UID))
		return false
	}
	return true
}

// handleMessage is the incoming-event scaffold. Add lobby/game events to the
// switch as they are implemented.
func (h *Hub) handleMessage(client *Client, data []byte) {
	var msg Event
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	switch msg.Event {
	case "join":
		h.mu.RLock()
		alreadyJoined := client.Joined
		h.mu.RUnlock()
		if alreadyJoined {
			_ = client.Send(createErrorEvent("join", "This connection already joined the lobby.", client.UID))
			return
		}

		var payload struct {
			AsAdmin bool `json:"asAdmin"`
		}
		if len(msg.Data) > 0 {
			if err := json.Unmarshal(msg.Data, &payload); err != nil {
				_ = client.Send(createErrorEvent("join", "Join failed, retry later.", client.UID))
				h.disconnect(client)
				return
			}
		}

		if err := h.Game.PlayerJoin(client.UID, payload.AsAdmin); err != nil {
			_ = client.Send(createErrorEvent("join", err.Error(), client.UID))
			h.disconnect(client)
			return
		}

		h.mu.Lock()
		client.Joined = true
		h.mu.Unlock()
		h.Broadcast(Event{Event: "user_joined", UID: client.UID.String()})

	case "start":
		h.mu.RLock()
		joined := client.Joined
		h.mu.RUnlock()
		if !joined {
			_ = client.Send(createErrorEvent("start", triv.ErrNotJoined.Error(), client.UID))
			return
		}

		if err := h.Game.Start(client.UID); err != nil {
			_ = client.Send(createErrorEvent("start", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "start", UID: client.UID.String()})

	case "ping":
		_ = client.Send(Event{Event: "pong"})
	case "request_admin_board":
		if !h.requireOwner(client, "admin_board") {
			return
		}
		h.sendAdminBoard(client)
	case "buzz":
		if !h.isJoined(client) {
			_ = client.Send(createErrorEvent("buzz_err", triv.ErrNotJoined.Error(), client.UID))
			return
		}
		if err := h.Game.Buzz(client.UID); err != nil {
			_ = client.Send(createErrorEvent("buzz_err", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "b_update"})

	case "admin_submit_answer":
		if !h.requireOwner(client, "admin_submit_answer") {
			return
		}
		var payload struct {
			Correct bool `json:"correct"`
		}
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			_ = client.Send(createErrorEvent("admin_submit_answer", "Error while submitting", client.UID))
			return
		}
		if err := h.Game.AwardPoints(payload.Correct); err != nil {
			_ = client.Send(createErrorEvent("admin_submit_answer", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "b_update"})

	case "admin_select_card":
		if !h.requireOwner(client, "select_card") {
			return
		}
		var payload struct {
			Index []int `json:"index"`
		}
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			_ = client.Send(createErrorEvent("select_card", "Error while selecting card", client.UID))
			return
		}
		if err := h.Game.ChooseCard(payload.Index); err != nil {
			_ = client.Send(createErrorEvent("select_card", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "b_update"})

	case "admin_init_choice_phase":
		if !h.requireOwner(client, "admin_init_choice_phase") {
			return
		}
		h.Game.InitChoicePhase()
		h.Broadcast(Event{Event: "b_update"})

	case "admin_next_board":
		if !h.requireOwner(client, "admin_next_board") {
			return
		}
		if err := h.Game.NextBoard(); err != nil {
			_ = client.Send(createErrorEvent("admin_next_board", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "b_update"})

	case "admin_finish_game":
		if !h.requireOwner(client, "admin_finish_game") {
			return
		}
		if err := h.Game.Finish(client.UID); err != nil {
			_ = client.Send(createErrorEvent("admin_finish_game", err.Error(), client.UID))
			return
		}
		h.Broadcast(Event{Event: "b_update"})

	default:
		// TODO: handle lobby/game events here.
	}
}
