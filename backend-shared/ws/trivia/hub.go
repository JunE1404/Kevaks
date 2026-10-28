package trivia

import (
	"encoding/json"
	"sync"

	"github.com/fasthttp/websocket"
	"github.com/google/uuid"
	triv "github.com/kevaks/backend-shared/games/trivia"
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
	UID     uuid.UUID
	Conn    *websocket.Conn
	LobbyId int
	writeMu sync.Mutex
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
	defer hubMu.Unlock()

	if HubInstance != h {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	if len(h.clients) == 0 {
		HubInstance = nil
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
}

func NewHub(game *triv.Game) bool {
	hubMu.Lock()
	defer hubMu.Unlock()
	HubInstance = &Hub{clients: make(map[*Client]struct{}), Game: game}
	return true
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
		_ = client.Send(createErrorEvent("Connection limit reached for this account.", uid))
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
		h.mu.Unlock()

		ok := h.Game.PlayerLeave(client.LobbyId)
		if ok {
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

func createErrorEvent(message string, uid uuid.UUID) Event {
	data, _ := json.Marshal(struct {
		Message string `json:"message"`
	}{Message: message})
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

// handleMessage is the incoming-event scaffold. Add lobby/game events to the
// switch as they are implemented.
func (h *Hub) handleMessage(client *Client, data []byte) {
	var msg Event
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	switch msg.Event {
	case "join":
		if client.LobbyId != 0 {
			_ = client.Send(createErrorEvent("This connection already joined the lobby.", client.UID))
			return
		}

		var payload struct {
			AsAdmin bool `json:"asAdmin"`
		}
		if len(msg.Data) > 0 {
			if err := json.Unmarshal(msg.Data, &payload); err != nil {
				_ = client.Send(createErrorEvent("Join failed, retry later.", client.UID))
				h.disconnect(client)
				return
			}
		}

		lobbyId, err := h.Game.PlayerJoin(client.UID, payload.AsAdmin)
		if err != nil {
			_ = client.Send(createErrorEvent(err.Error(), client.UID))
			h.disconnect(client)
			return
		}

		client.LobbyId = lobbyId
		h.Broadcast(Event{Event: "user_joined", UID: client.UID.String()})

	case "ping":
		_ = client.Send(Event{Event: "pong"})
	case "buzz":
	case "submit_answer":

	case "admin_award_points":
	case "admin_select_next_player":

	default:
		// TODO: handle lobby/game events here.
	}
}
