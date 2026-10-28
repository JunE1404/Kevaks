package trivia

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/google/uuid"
	db "github.com/kevaks/backend-shared/database"
	t "github.com/kevaks/backend-shared/types"
)

var (
	ErrAdminOnly       = errors.New("only the game owner may join as admin")
	ErrConnectionLimit = errors.New("connection limit reached for this account")
)

type Card struct {
	Special       bool   `json:"special"`
	Question      string `json:"question"`
	SpecialString string `json:"specialString"`
}

type GameState struct {
	BoardId         int           `json:"boardId"`
	BoardMask       [][][]bool    `json:"boardMask"`
	CurrentQuestion Card          `json:"currentQuestion"`
	GameData        *t.TriviaGame `json:"-"`
}

type Player struct {
	Uuid  uuid.UUID `json:"uuid"`
	Admin bool      `json:"admin"`
}

type Game struct {
	Lobbystate int `json:"lobbyState"`
	muGame     sync.Mutex
	Gamestate  GameState      `json:"gameState"`
	Admin      uuid.UUID      `json:"admin"`
	Players    map[int]Player `json:"players"`
	Title      string         `json:"title"`
	maxId      int
}

func StartGame(db *db.DBHandler, ownerId uuid.UUID, gameConfigId uuid.UUID) (*Game, error) {
	data, err := db.GetTriviaGame(context.Background(), ownerId, gameConfigId)
	if err != nil {
		return &Game{}, err
	}
	boardMask := make([][][]bool, len(data.Boards))
	for i, b := range data.Boards {
		a := make([][]bool, len(b.CategoryPoints))
		for j := range a {
			a[j] = make([]bool, len(b.Categories))
		}
		boardMask[i] = a
	}
	gs := GameState{BoardId: 0, BoardMask: boardMask, CurrentQuestion: Card{}, GameData: data}
	return &Game{
		Lobbystate: 0,
		muGame:     sync.Mutex{},
		Gamestate:  gs,
		Admin:      ownerId,
		Players:    make(map[int]Player),
		Title:      data.Title,
	}, nil
}

func (g *Game) ownerId() uuid.UUID {
	if g.Gamestate.GameData != nil {
		return g.Gamestate.GameData.Owner
	}
	return g.Admin
}

// ConnectionLimit is the number of simultaneous sockets a user may hold: two
// for the owner (stream view + admin panel), one for everybody else.
func (g *Game) ConnectionLimit(uid uuid.UUID) int {
	if uid == g.ownerId() {
		return 2
	}
	return 1
}

// PlayerJoin adds a player to the lobby. The owner may hold two entries and
// everybody else one; the per-UUID cap is also enforced when the raw
// connection registers.
func (g *Game) PlayerJoin(playerUuid uuid.UUID, asAdmin bool) (int, error) {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if asAdmin && playerUuid != g.ownerId() {
		return -1, ErrAdminOnly
	}

	count := 0
	for _, player := range g.Players {
		if player.Uuid == playerUuid {
			count++
		}
	}

	if count >= g.ConnectionLimit(playerUuid) {
		return -1, ErrConnectionLimit
	}

	lobbyId := g.maxId + 1
	g.maxId = lobbyId
	g.Players[lobbyId] = Player{Uuid: playerUuid, Admin: asAdmin}
	return lobbyId, nil
}

func (g *Game) PlayerLeave(lobbyId int) bool {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	_, ok := g.Players[lobbyId]
	if !ok {
		return false
	}
	delete(g.Players, lobbyId)
	return true
}

// Snapshot serializes the live game for clients. GameData (the full board
// configuration) is excluded via its json:"-" tag, and the mutex/unexported
// fields are never marshalled.
func (g *Game) Snapshot() ([]byte, error) {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	return json.Marshal(g)
}
