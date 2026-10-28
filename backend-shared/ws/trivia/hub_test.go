package trivia_test

import (
	"encoding/json"
	"net"
	"testing"
	"time"

	"github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	h "github.com/kevaks/backend-shared/api/handlers"
	game "github.com/kevaks/backend-shared/games/trivia"
	"github.com/kevaks/backend-shared/types"
	ws "github.com/kevaks/backend-shared/ws/trivia"
)

func TestHubSelfDestructsWhenEmpty(t *testing.T) {
	g := &game.Game{
		Gamestate: game.GameState{GameData: &types.TriviaGame{}},
		Players:   map[int]game.Player{},
	}
	ws.NewHub(g)
	if !ws.TriviaLobbyActive() {
		t.Fatal("hub should be active after NewHub")
	}

	app := fiber.New()
	handler := h.TriviaWebSocketHandler()
	app.Get("/ws", func(c fiber.Ctx) error {
		c.Locals("UID", uuid.New())
		return handler(c)
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln) }()
	defer func() { _ = app.Shutdown() }()

	conn, _, err := websocket.DefaultDialer.Dial("ws://"+ln.Addr().String()+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}

	if err := conn.WriteJSON(map[string]any{
		"event": "join",
		"data":  map[string]any{"asAdmin": false},
	}); err != nil {
		t.Fatal(err)
	}

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, _, err := conn.ReadMessage(); err != nil {
		t.Fatalf("expected user_joined broadcast: %v", err)
	}

	_ = conn.Close()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if !ws.TriviaLobbyActive() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}

	t.Fatal("hub did not self-destruct after the last client left")
}

func TestConnectionLimits(t *testing.T) {
	owner := uuid.New()
	user := uuid.New()

	g := &game.Game{
		Admin:     owner,
		Gamestate: game.GameState{GameData: &types.TriviaGame{Owner: owner}},
		Players:   map[int]game.Player{},
	}
	ws.NewHub(g)

	app := fiber.New()
	handler := h.TriviaWebSocketHandler()
	app.Get("/owner", func(c fiber.Ctx) error {
		c.Locals("UID", owner)
		return handler(c)
	})
	app.Get("/user", func(c fiber.Ctx) error {
		c.Locals("UID", user)
		return handler(c)
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln) }()
	defer func() { _ = app.Shutdown() }()

	base := "ws://" + ln.Addr().String()
	dial := func(path string) *websocket.Conn {
		conn, _, err := websocket.DefaultDialer.Dial(base+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		return conn
	}

	ownerOne := dial("/owner")
	defer ownerOne.Close()
	ownerTwo := dial("/owner")
	defer ownerTwo.Close()

	ownerThree := dial("/owner")
	defer ownerThree.Close()
	if event := readEvent(t, ownerThree); event.Event != "error" {
		t.Fatalf("expected owner's third connection to be rejected, got %+v", event)
	}

	userOne := dial("/user")
	defer userOne.Close()
	userTwo := dial("/user")
	defer userTwo.Close()
	if event := readEvent(t, userTwo); event.Event != "error" {
		t.Fatalf("expected duplicate user connection to be rejected, got %+v", event)
	}
}

func readEvent(t *testing.T, conn *websocket.Conn) ws.Event {
	t.Helper()

	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}

	var event ws.Event
	if err := json.Unmarshal(data, &event); err != nil {
		t.Fatal(err)
	}
	return event
}
