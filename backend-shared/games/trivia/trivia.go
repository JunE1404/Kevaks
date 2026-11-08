package trivia

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"sync"

	"github.com/google/uuid"
	db "github.com/kevaks/backend-shared/database"
	t "github.com/kevaks/backend-shared/types"
)

var (
	ErrAdminOnly        = errors.New("only the game owner may join as admin")
	ErrConnectionLimit  = errors.New("connection limit reached for this account")
	ErrUserError        = errors.New("User not found")
	ErrNotJoined        = errors.New("player has not joined the lobby")
	ErrStartForbidden   = errors.New("only an admin may start the game")
	ErrNotInGame        = errors.New("you were not in the lobby when the game started")
	ErrInvalidCard      = errors.New("invalid card selection")
	ErrCardAlreadyUsed  = errors.New("this card has already been played")
	ErrCardNotResolved  = errors.New("award points for the current card before selecting another")
	ErrNotAnswerPhase   = errors.New("the game is not in the answer phase")
	ErrNotChoicePhase   = errors.New("the game is not in the card choice phase")
	ErrAdminCannotBuzz  = errors.New("the game admin cannot buzz")
	ErrAlreadyBuzzed    = errors.New("a player already buzzed")
	ErrBoardNotComplete = errors.New("all questions on the current board must be completed first")
	ErrNoMoreBoards     = errors.New("there is no next board")
)

type Card struct {
	Special       bool   `json:"special"`
	Question      string `json:"question"`
	SpecialString string `json:"specialString"`
	Index         []int  `json:"index"`
	Value         int    `json:"value"`
}

type GameState struct {
	BoardMask       [][][]bool    `json:"boardMask"`
	CurrentQuestion Card          `json:"currentQuestion"`
	GameData        *t.TriviaGame `json:"-"`
}

type BoardView struct {
	Title          string   `json:"title"`
	CategoryPoints []int    `json:"categoryPoints"`
	Categories     []string `json:"categories"`
}

type Player struct {
	Uuid            uuid.UUID `json:"uuid"`
	Name            string    `json:"name"`
	Points          int       `json:"points"`
	Admin           bool      `json:"admin"`
	Connected       bool      `json:"connected"`
	LiveKitIdentity string    `json:"livekitIdentity"`
}

type Game struct {
	Lobbystate         int `json:"lobbyState"`
	muGame             sync.Mutex
	Gamestate          GameState            `json:"gameState"`
	CurrentBoardIdx    int                  `json:"currentBoardIdx"`
	Phase              int                  `json:"phase"`
	Admin              uuid.UUID            `json:"admin"`
	Players            map[uuid.UUID]Player `json:"players"`
	PlayerOrder        []uuid.UUID          `json:"playerOrder"`
	CurrentPlayer      int                  `json:"currentPlayer"`
	lastNatPlayer      int
	BuzzPlayer         uuid.UUID   `json:"buzzPlayer"`
	LastAnswerCorrect  bool        `json:"lastAnswer"`
	RoundPointsAwarded bool        `json:"roundPointsAwarded"`
	FreeForAll         bool        `json:"freeForAll"`
	Boards             []BoardView `json:"boards"`
	Title              string      `json:"title"`
	db                 *db.DBHandler
	ctx                context.Context
}

func StartGame(db *db.DBHandler, ownerId uuid.UUID, gameConfigId uuid.UUID) (*Game, error) {
	ctx := context.Background()
	data, err := db.GetTriviaGame(ctx, ownerId, gameConfigId)
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
	boards := make([]BoardView, len(data.Boards))
	for i, b := range data.Boards {
		categories := make([]string, len(b.Categories))
		for j, category := range b.Categories {
			categories[j] = category.Name
		}
		boards[i] = BoardView{
			Title:          b.Title,
			CategoryPoints: b.CategoryPoints,
			Categories:     categories,
		}
	}
	gs := GameState{BoardMask: boardMask, CurrentQuestion: Card{}, GameData: data}
	return &Game{
		Lobbystate:         0,
		muGame:             sync.Mutex{},
		Gamestate:          gs,
		CurrentBoardIdx:    0,
		Phase:              0,
		Admin:              ownerId,
		Players:            make(map[uuid.UUID]Player),
		CurrentPlayer:      -1,
		RoundPointsAwarded: true,
		Boards:             boards,
		Title:              data.Title,
		db:                 db,
		ctx:                ctx,
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

// IsOwner reports whether uid owns the game and may therefore control it.
func (g *Game) IsOwner(uid uuid.UUID) bool {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	return uid == g.ownerId()
}

// RoomName returns the LiveKit room name for this game.
func (g *Game) RoomName() string {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	if g.Gamestate.GameData == nil || g.Gamestate.GameData.Uid == uuid.Nil {
		return ""
	}
	return g.Gamestate.GameData.Uid.String()
}

// Player returns the stored player record for uid.
func (g *Game) Player(uid uuid.UUID) (Player, bool) {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	p, ok := g.Players[uid]
	return p, ok
}

// RegisterIdentity stores the LiveKit participant identity for uid.
func (g *Game) RegisterIdentity(uid uuid.UUID, identity string) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	player, ok := g.Players[uid]
	if !ok {
		return ErrNotInGame
	}

	player.LiveKitIdentity = identity
	g.Players[uid] = player
	return nil
}

// PlayerJoin marks the user connected and refreshes their name from the DB.
// A new entry is only created while the lobby is still in its waiting phase;
// after the game starts, only users who were already in the map may reconnect.
func (g *Game) PlayerJoin(playerUuid uuid.UUID, asAdmin bool) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if g.Players == nil {
		g.Players = make(map[uuid.UUID]Player)
	}

	if asAdmin && playerUuid != g.ownerId() {
		return ErrAdminOnly
	}

	player, exists := g.Players[playerUuid]
	if !exists && g.Lobbystate != 0 {
		return ErrNotInGame
	}

	if g.db == nil {
		return ErrUserError
	}
	account, err := g.db.GetUser(g.ctx, playerUuid)
	if err != nil {
		return ErrUserError
	}

	if !exists {
		player = Player{Uuid: playerUuid}
	}
	player.Name = account.Name
	player.Connected = true
	if asAdmin || playerUuid == g.ownerId() {
		player.Admin = true
	}
	g.Players[playerUuid] = player
	if playerUuid != g.ownerId() && !slices.Contains(g.PlayerOrder, playerUuid) {
		g.PlayerOrder = append(g.PlayerOrder, playerUuid)
	}
	return nil
}

// PlayerDisconnect keeps the player record and just marks it offline.
func (g *Game) PlayerDisconnect(playerUuid uuid.UUID) {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	player, ok := g.Players[playerUuid]
	if !ok {
		return
	}
	player.Connected = false
	g.Players[playerUuid] = player
	g.PlayerOrder = remove(g.PlayerOrder, playerUuid)
}

// Start moves the lobby from waiting (0) to running (1). Only a connected
// admin player may start it; starting an already running lobby is a no-op.
func (g *Game) Start(playerUuid uuid.UUID) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	player, ok := g.Players[playerUuid]
	if !ok || !player.Connected {
		return ErrNotJoined
	}
	if !player.Admin {
		return ErrStartForbidden
	}

	g.Lobbystate = 1
	return nil
}

// Snapshot serializes the live game for clients. GameData (the full board
// configuration) is excluded via its json:"-" tag, and the mutex/unexported
// fields are never marshalled.
func (g *Game) Snapshot() ([]byte, error) {
	g.muGame.Lock()
	defer g.muGame.Unlock()
	return json.Marshal(g)
}

// AdminBoard loads the full board configuration straight from the database for
// the game owner's admin panel. The result includes questions, answers and
// special text, so it must only ever be sent to the requesting admin
// connection, never broadcast to the other players.
func (g *Game) AdminBoard(playerUuid uuid.UUID) (*t.TriviaGame, error) {
	g.muGame.Lock()
	owner := g.ownerId()
	var gameUuid uuid.UUID
	if g.Gamestate.GameData != nil {
		gameUuid = g.Gamestate.GameData.Uid
	}
	handler := g.db
	ctx := g.ctx
	g.muGame.Unlock()

	if playerUuid != owner {
		return nil, ErrAdminOnly
	}
	if handler == nil || gameUuid == uuid.Nil {
		return nil, db.ErrGameNotFound
	}
	return handler.GetTriviaGame(ctx, owner, gameUuid)
}

// InitChoicePhase starts a new card-choice round. The player who last answered
// correctly keeps the turn; otherwise the turn passes to the next player in
// join order. On the first round the first player chooses.
func (g *Game) InitChoicePhase() {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if g.Gamestate.CurrentQuestion.Index != nil && !g.RoundPointsAwarded {
		g.markCurrentCardUsed()
		g.RoundPointsAwarded = true
	}

	switch {
	case g.BuzzPlayer != uuid.Nil && g.LastAnswerCorrect:
		g.CurrentPlayer = g.getPlayerIndex(g.BuzzPlayer)
	case g.Phase == 0:
		g.CurrentPlayer = 0
	case len(g.PlayerOrder) > 0:
		g.CurrentPlayer = (g.lastNatPlayer + 1) % len(g.PlayerOrder)
	default:
		g.CurrentPlayer = 0
	}

	g.lastNatPlayer = g.CurrentPlayer
	g.Phase = 1
	g.BuzzPlayer = uuid.Nil
	g.FreeForAll = false
}

// NextBoard advances to the next board once every question on the current one
// has been completed.
func (g *Game) NextBoard() error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if !g.currentBoardComplete() {
		return ErrBoardNotComplete
	}
	if g.CurrentBoardIdx+1 >= len(g.Gamestate.BoardMask) {
		return ErrNoMoreBoards
	}

	g.CurrentBoardIdx++
	g.Phase = 1
	g.CurrentPlayer = -1
	g.Gamestate.CurrentQuestion = Card{}
	g.BuzzPlayer = uuid.Nil
	g.FreeForAll = false
	g.RoundPointsAwarded = true
	return nil
}

// currentBoardComplete reports whether every populated cell on the active board
// has been played.
func (g *Game) currentBoardComplete() bool {
	if g.Gamestate.GameData == nil ||
		g.CurrentBoardIdx < 0 ||
		g.CurrentBoardIdx >= len(g.Gamestate.GameData.Boards) ||
		g.CurrentBoardIdx >= len(g.Gamestate.BoardMask) {
		return false
	}

	board := g.Gamestate.GameData.Boards[g.CurrentBoardIdx]
	mask := g.Gamestate.BoardMask[g.CurrentBoardIdx]
	for column, category := range board.Categories {
		for row := range board.CategoryPoints {
			if row >= len(category.Fields) || category.Fields[row].Text == "" {
				continue
			}
			if row >= len(mask) || column >= len(mask[row]) || !mask[row][column] {
				return false
			}
		}
	}
	return true
}

// ChooseCard makes the selected cell the active question. index is
// [board, category, row], matching the editor's target ordering.
func (g *Game) ChooseCard(index []int) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if len(index) != 3 {
		return ErrInvalidCard
	}
	if g.Gamestate.GameData == nil {
		return ErrInvalidCard
	}

	boardIndex, categoryIndex, row := index[0], index[1], index[2]
	if boardIndex < 0 || boardIndex >= len(g.Gamestate.GameData.Boards) {
		return ErrInvalidCard
	}
	if boardIndex != g.CurrentBoardIdx {
		return ErrInvalidCard
	}
	board := g.Gamestate.GameData.Boards[boardIndex]
	if categoryIndex < 0 || categoryIndex >= len(board.Categories) {
		return ErrInvalidCard
	}
	if row < 0 || row >= len(board.CategoryPoints) {
		return ErrInvalidCard
	}

	fields := board.Categories[categoryIndex].Fields
	if row >= len(fields) {
		return ErrInvalidCard
	}
	field := fields[row]

	if g.Phase != 1 {
		return ErrNotChoicePhase
	}

	if g.Gamestate.CurrentQuestion.Index != nil && !g.RoundPointsAwarded {
		return ErrCardNotResolved
	}

	mask := g.Gamestate.BoardMask
	if boardIndex < len(mask) &&
		row < len(mask[boardIndex]) &&
		categoryIndex < len(mask[boardIndex][row]) &&
		mask[boardIndex][row][categoryIndex] {
		return ErrCardAlreadyUsed
	}

	g.Gamestate.CurrentQuestion = Card{
		Special:       field.Type == "special",
		Question:      field.Text,
		SpecialString: field.SpecialText,
		Index:         []int{boardIndex, categoryIndex, row},
		Value:         board.CategoryPoints[row],
	}
	g.Phase = 2
	g.BuzzPlayer = uuid.Nil
	g.RoundPointsAwarded = false
	g.FreeForAll = false
	return nil
}

// Buzz gives the answer to player. Only a joined player may buzz, and only
// while a question is open.
func (g *Game) Buzz(player uuid.UUID) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if player == g.ownerId() {
		return ErrAdminCannotBuzz
	}
	if _, ok := g.Players[player]; !ok {
		return ErrNotInGame
	}
	if g.Phase != 2 {
		return ErrNotAnswerPhase
	}

	if g.BuzzPlayer == uuid.Nil {
		g.BuzzPlayer = player
		g.CurrentPlayer = -1
		g.Phase = 3
		return nil
	}
	return ErrAlreadyBuzzed
}

// AwardPoints resolves the current answer. A correct answer awards the question
// value and marks the cell used. A wrong answer deducts the value: the first
// wrong answer opens a one-time free-for-all buzz, the second completes the
// question.
func (g *Game) AwardPoints(correct bool) error {
	g.muGame.Lock()
	defer g.muGame.Unlock()

	if g.Phase != 3 {
		return ErrNotAnswerPhase
	}

	buzzPlayer := g.BuzzPlayer
	player, ok := g.Players[buzzPlayer]
	if !ok {
		return ErrNotInGame
	}

	question := g.Gamestate.CurrentQuestion
	if correct {
		player.Points += question.Value
		g.LastAnswerCorrect = true
		g.markCurrentCardUsed()
		g.Phase = 4
		g.FreeForAll = false
		g.RoundPointsAwarded = true
	} else {
		player.Points -= question.Value
		g.LastAnswerCorrect = false

		if g.FreeForAll {
			g.markCurrentCardUsed()
			g.BuzzPlayer = uuid.Nil
			g.FreeForAll = false
			g.Phase = 4
			g.RoundPointsAwarded = true
		} else {
			g.BuzzPlayer = uuid.Nil
			g.CurrentPlayer = -1
			g.FreeForAll = true
			g.Phase = 2
		}
	}

	g.Players[buzzPlayer] = player
	return nil
}

// markCurrentCardUsed marks the active question's board cell as completed.
func (g *Game) markCurrentCardUsed() {
	question := g.Gamestate.CurrentQuestion
	if len(question.Index) != 3 {
		return
	}

	boardIndex, categoryIndex, row := question.Index[0], question.Index[1], question.Index[2]
	if boardIndex < 0 || categoryIndex < 0 || row < 0 {
		return
	}
	if boardIndex < len(g.Gamestate.BoardMask) &&
		row < len(g.Gamestate.BoardMask[boardIndex]) &&
		categoryIndex < len(g.Gamestate.BoardMask[boardIndex][row]) {
		g.Gamestate.BoardMask[boardIndex][row][categoryIndex] = true
	}
}

func (g *Game) getPlayerIndex(p uuid.UUID) int {
	for i, pp := range g.PlayerOrder {
		if pp == p {
			return i
		}
	}
	return 0
}

func remove(l []uuid.UUID, e uuid.UUID) []uuid.UUID {
	kept := make([]uuid.UUID, 0, len(l))
	for _, item := range l {
		if item != e {
			kept = append(kept, item)
		}
	}
	return kept
}
