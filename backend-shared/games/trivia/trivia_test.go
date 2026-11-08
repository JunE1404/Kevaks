package trivia

import (
	"errors"
	"slices"
	"testing"

	"github.com/google/uuid"
	t "github.com/kevaks/backend-shared/types"
)

func newTestGame() *Game {
	return &Game{
		Gamestate: GameState{
			BoardMask: [][][]bool{{
				{false, false},
				{false, false},
			}},
			GameData: &t.TriviaGame{Boards: []t.Board{{
				Title:          "Board",
				CategoryPoints: []int{100, 200},
				Categories: []t.Category{
					{
						Name: "Cat A",
						Fields: []t.Field{
							{Type: "normal", Text: "A0", Answer: "answer A0"},
							{Type: "special", Text: "A1", Answer: "answer A1", SpecialText: "double"},
						},
					},
					{
						Name: "Cat B",
						Fields: []t.Field{
							{Type: "normal", Text: "B0", Answer: "answer B0"},
							{Type: "normal", Text: "B1", Answer: "answer B1"},
						},
					},
				},
			}}},
		},
		Players: make(map[uuid.UUID]Player),
	}
}

func TestChooseCardSelectsCategoryAndRow(t *testing.T) {
	g := newTestGame()
	g.Phase = 1

	if err := g.ChooseCard([]int{0, 1, 0}); err != nil {
		t.Fatalf("ChooseCard returned %v", err)
	}

	card := g.Gamestate.CurrentQuestion
	if card.Question != "B0" {
		t.Errorf("Question = %q, want B0", card.Question)
	}
	if card.Special {
		t.Error("normal field was marked special")
	}
	if card.Value != 100 {
		t.Errorf("Value = %d, want 100 (the row's point value)", card.Value)
	}
	if !slices.Equal(card.Index, []int{0, 1, 0}) {
		t.Errorf("Index = %v, want [0 1 0]", card.Index)
	}
	if g.Phase != 2 {
		t.Errorf("Phase = %d, want 2", g.Phase)
	}
	if g.RoundPointsAwarded {
		t.Error("a freshly selected card should not be marked as awarded")
	}
}

func TestChooseCardSpecialRow(t *testing.T) {
	g := newTestGame()
	g.Phase = 1

	if err := g.ChooseCard([]int{0, 0, 1}); err != nil {
		t.Fatalf("ChooseCard returned %v", err)
	}

	card := g.Gamestate.CurrentQuestion
	if !card.Special || card.SpecialString != "double" {
		t.Errorf("card = %+v, want a special card with special string", card)
	}
	if card.Value != 200 {
		t.Errorf("Value = %d, want 200", card.Value)
	}
}

func TestChooseCardRejectsInvalidOrUsedCards(t *testing.T) {
	g := newTestGame()
	g.Phase = 1

	for _, index := range [][]int{nil, {0}, {0, 5, 0}, {0, 0, 5}, {-1, 0, 0}} {
		if err := g.ChooseCard(index); !errors.Is(err, ErrInvalidCard) {
			t.Errorf("ChooseCard(%v) = %v, want ErrInvalidCard", index, err)
		}
	}

	g.Gamestate.BoardMask[0][0][1] = true
	if err := g.ChooseCard([]int{0, 1, 0}); !errors.Is(err, ErrCardAlreadyUsed) {
		t.Errorf("ChooseCard on used cell = %v, want ErrCardAlreadyUsed", err)
	}
}

func TestAwardPointsPersistsScoreAndMarksCell(t *testing.T) {
	g := newTestGame()
	playerId := uuid.New()
	g.Players[playerId] = Player{Uuid: playerId, Points: 10}
	g.PlayerOrder = []uuid.UUID{playerId}
	g.BuzzPlayer = playerId
	g.Phase = 3
	g.Gamestate.CurrentQuestion = Card{Value: 100, Index: []int{0, 1, 0}}

	if err := g.AwardPoints(true); err != nil {
		t.Fatalf("AwardPoints returned %v", err)
	}
	if got := g.Players[playerId].Points; got != 110 {
		t.Errorf("Points = %d, want 110 (the update must be stored back)", got)
	}
	if !g.Gamestate.BoardMask[0][0][1] {
		t.Error("used cell was marked at the wrong mask position")
	}
	if !g.LastAnswerCorrect || g.Phase != 4 {
		t.Errorf("lastAnswer/phase = %v/%d, want true/4", g.LastAnswerCorrect, g.Phase)
	}
	if !g.RoundPointsAwarded {
		t.Error("RoundPointsAwarded should be true after scoring the card")
	}

	if err := g.AwardPoints(true); !errors.Is(err, ErrNotAnswerPhase) {
		t.Errorf("second AwardPoints = %v, want ErrNotAnswerPhase", err)
	}
}

func TestWrongAnswerEntersFreeForAll(t *testing.T) {
	g := newTestGame()
	playerId := uuid.New()
	g.Players[playerId] = Player{Uuid: playerId, Points: 100}
	g.CurrentPlayer = 0
	g.BuzzPlayer = playerId
	g.Phase = 3
	g.Gamestate.CurrentQuestion = Card{Value: 100, Index: []int{0, 0, 0}}

	if err := g.AwardPoints(false); err != nil {
		t.Fatalf("AwardPoints returned %v", err)
	}
	if got := g.Players[playerId].Points; got != 0 {
		t.Errorf("Points = %d, want 0", got)
	}
	if g.Phase != 2 {
		t.Errorf("Phase = %d, want 2 (free for all is open)", g.Phase)
	}
	if !g.FreeForAll {
		t.Error("FreeForAll should be true after the first wrong answer")
	}
	if g.BuzzPlayer != uuid.Nil {
		t.Error("nobody should be marked as buzzed during the free for all")
	}
	if g.CurrentPlayer != -1 {
		t.Error("no current player should be highlighted during the free for all")
	}
	if g.LastAnswerCorrect {
		t.Error("LastAnswerCorrect should be false")
	}
	if g.Gamestate.BoardMask[0][0][0] {
		t.Error("the card must not be completed until the free-for-all resolves")
	}
	if g.RoundPointsAwarded {
		t.Error("the card is not resolved yet")
	}
}

func TestFreeForAllWrongAnswerCompletesQuestion(t *testing.T) {
	g := newTestGame()
	first, second := uuid.New(), uuid.New()
	g.Players[first] = Player{Uuid: first, Points: 100}
	g.Players[second] = Player{Uuid: second, Points: 100}
	g.CurrentPlayer = 0
	g.BuzzPlayer = first
	g.Phase = 3
	g.Gamestate.CurrentQuestion = Card{Value: 100, Index: []int{0, 0, 1}}

	if err := g.AwardPoints(false); err != nil {
		t.Fatalf("first AwardPoints returned %v", err)
	}
	if err := g.Buzz(second); err != nil {
		t.Fatalf("free-for-all Buzz returned %v", err)
	}
	if err := g.AwardPoints(false); err != nil {
		t.Fatalf("second AwardPoints returned %v", err)
	}

	if got := g.Players[second].Points; got != 0 {
		t.Errorf("Points = %d, want 0", got)
	}
	if g.Phase != 4 {
		t.Errorf("Phase = %d, want 4 (question completed)", g.Phase)
	}
	if g.FreeForAll {
		t.Error("FreeForAll should be cleared once the question is completed")
	}
	if g.BuzzPlayer != uuid.Nil {
		t.Error("BuzzPlayer should be cleared once the question is completed")
	}
	if !g.RoundPointsAwarded {
		t.Error("the card is resolved and should unlock the next selection")
	}
	if !g.Gamestate.BoardMask[0][1][0] {
		t.Error("the completed card should be marked as used")
	}
}

func TestFreeForAllCorrectAnswerCompletesQuestion(t *testing.T) {
	g := newTestGame()
	first, second := uuid.New(), uuid.New()
	g.Players[first] = Player{Uuid: first, Points: 100}
	g.Players[second] = Player{Uuid: second, Points: 100}
	g.CurrentPlayer = 0
	g.BuzzPlayer = first
	g.Phase = 3
	g.Gamestate.CurrentQuestion = Card{Value: 200, Index: []int{0, 1, 0}}

	if err := g.AwardPoints(false); err != nil {
		t.Fatalf("first AwardPoints returned %v", err)
	}
	if err := g.Buzz(second); err != nil {
		t.Fatalf("free-for-all Buzz returned %v", err)
	}
	if err := g.AwardPoints(true); err != nil {
		t.Fatalf("second AwardPoints returned %v", err)
	}

	if got := g.Players[second].Points; got != 300 {
		t.Errorf("Points = %d, want 300", got)
	}
	if !g.LastAnswerCorrect || g.Phase != 4 {
		t.Errorf("lastAnswer/phase = %v/%d, want true/4", g.LastAnswerCorrect, g.Phase)
	}
	if g.FreeForAll {
		t.Error("FreeForAll should be cleared once the question is completed")
	}
	if g.BuzzPlayer != second {
		t.Error("the correct buzzer should keep the turn")
	}
	if !g.Gamestate.BoardMask[0][0][1] {
		t.Error("the completed card should be marked as used")
	}
}

func TestBuzzRejectsSecondBuzz(t *testing.T) {
	g := newTestGame()
	first, second := uuid.New(), uuid.New()
	g.Players[first] = Player{Uuid: first}
	g.Players[second] = Player{Uuid: second}
	g.Phase = 2
	g.Gamestate.CurrentQuestion = Card{Index: []int{0, 0, 0}}

	if err := g.Buzz(first); err != nil {
		t.Fatalf("first Buzz returned %v", err)
	}
	if g.CurrentPlayer != -1 {
		t.Errorf("CurrentPlayer = %d, want -1 after a buzz", g.CurrentPlayer)
	}
	g.Phase = 2
	if err := g.Buzz(second); !errors.Is(err, ErrAlreadyBuzzed) {
		t.Errorf("second Buzz = %v, want ErrAlreadyBuzzed", err)
	}
}

func TestChooseCardRequiresChoicePhase(t *testing.T) {
	g := newTestGame()

	if err := g.ChooseCard([]int{0, 0, 0}); !errors.Is(err, ErrNotChoicePhase) {
		t.Errorf("ChooseCard outside the choice phase = %v, want ErrNotChoicePhase", err)
	}

	g.Phase = 1
	if err := g.ChooseCard([]int{0, 0, 0}); err != nil {
		t.Errorf("ChooseCard in the choice phase = %v, want nil", err)
	}
}

func TestChooseCardLockedUntilRoundPointsAwarded(t *testing.T) {
	g := newTestGame()
	g.Phase = 1
	if err := g.ChooseCard([]int{0, 0, 0}); err != nil {
		t.Fatalf("first ChooseCard returned %v", err)
	}

	g.Phase = 1
	if err := g.ChooseCard([]int{0, 1, 0}); !errors.Is(err, ErrCardNotResolved) {
		t.Errorf("second ChooseCard = %v, want ErrCardNotResolved", err)
	}

	playerId := uuid.New()
	g.Players[playerId] = Player{Uuid: playerId}
	g.BuzzPlayer = playerId
	g.Phase = 3
	if err := g.AwardPoints(true); err != nil {
		t.Fatalf("AwardPoints returned %v", err)
	}

	g.Phase = 1
	if err := g.ChooseCard([]int{0, 1, 0}); err != nil {
		t.Errorf("ChooseCard after awarding = %v, want nil", err)
	}
}

func TestNextBoardRequiresCompletedBoard(t *testing.T) {
	g := newTestGame()

	if err := g.NextBoard(); !errors.Is(err, ErrBoardNotComplete) {
		t.Errorf("NextBoard on an incomplete board = %v, want ErrBoardNotComplete", err)
	}

	g.Gamestate.BoardMask[0] = [][]bool{{true, true}, {true, false}}
	if err := g.NextBoard(); !errors.Is(err, ErrBoardNotComplete) {
		t.Errorf("NextBoard with a cell left = %v, want ErrBoardNotComplete", err)
	}

	g.Gamestate.BoardMask[0][1][1] = true
	if err := g.NextBoard(); !errors.Is(err, ErrNoMoreBoards) {
		t.Errorf("NextBoard on the last board = %v, want ErrNoMoreBoards", err)
	}
}

func TestNextBoardAdvancesAndResetsRound(t *testing.T) {
	g := newTestGame()
	g.Gamestate.GameData.Boards = append(
		g.Gamestate.GameData.Boards,
		g.Gamestate.GameData.Boards[0],
	)
	g.Gamestate.BoardMask = append(
		g.Gamestate.BoardMask,
		[][]bool{{false, false}, {false, false}},
	)
	g.Gamestate.BoardMask[0] = [][]bool{{true, true}, {true, true}}
	g.Phase = 4
	g.Gamestate.CurrentQuestion = Card{Value: 100, Index: []int{0, 0, 0}}
	g.BuzzPlayer = uuid.New()
	g.FreeForAll = true
	g.RoundPointsAwarded = true

	if err := g.NextBoard(); err != nil {
		t.Fatalf("NextBoard returned %v", err)
	}
	if g.CurrentBoardIdx != 1 {
		t.Errorf("CurrentBoardIdx = %d, want 1", g.CurrentBoardIdx)
	}
	if g.Phase != 1 || g.CurrentPlayer != -1 {
		t.Errorf("phase/current player = %d/%d, want 1/-1", g.Phase, g.CurrentPlayer)
	}
	if g.Gamestate.CurrentQuestion.Index != nil {
		t.Error("the previous question should be cleared")
	}
	if g.BuzzPlayer != uuid.Nil || g.FreeForAll {
		t.Error("round state should be reset")
	}
	if !g.RoundPointsAwarded {
		t.Error("a fresh board should allow choosing the next player first")
	}
}

func TestCurrentBoardCompleteIgnoresEmptyCells(t *testing.T) {
	g := newTestGame()
	g.Gamestate.BoardMask[0] = [][]bool{{true, true}, {false, true}}
	g.Gamestate.GameData.Boards[0].Categories[0].Fields =
		g.Gamestate.GameData.Boards[0].Categories[0].Fields[:1]

	if !g.currentBoardComplete() {
		t.Error("a board whose remaining cells have no question should be complete")
	}
}

func TestRegisterIdentity(t *testing.T) {
	g := newTestGame()
	playerId := uuid.New()
	g.Players[playerId] = Player{Uuid: playerId}

	if err := g.RegisterIdentity(playerId, "lk-identity"); err != nil {
		t.Fatalf("RegisterIdentity returned %v", err)
	}
	if got := g.Players[playerId].LiveKitIdentity; got != "lk-identity" {
		t.Errorf("LiveKitIdentity = %q, want lk-identity", got)
	}

	if err := g.RegisterIdentity(uuid.New(), "other"); !errors.Is(err, ErrNotInGame) {
		t.Errorf("RegisterIdentity(unknown) = %v, want ErrNotInGame", err)
	}
}

func TestInitChoicePhaseTurnOrder(t *testing.T) {
	first, second, third := uuid.New(), uuid.New(), uuid.New()
	g := newTestGame()
	g.PlayerOrder = []uuid.UUID{first, second, third}

	g.InitChoicePhase()
	if g.CurrentPlayer != 0 || g.Phase != 1 {
		t.Fatalf("first round = current %d, phase %d; want 0, 1", g.CurrentPlayer, g.Phase)
	}

	g.Phase = 3
	g.BuzzPlayer = second
	g.LastAnswerCorrect = true
	g.InitChoicePhase()
	if g.CurrentPlayer != 1 {
		t.Errorf("after correct buzz current player = %d, want 1", g.CurrentPlayer)
	}

	g.Phase = 2
	g.LastAnswerCorrect = false
	g.InitChoicePhase()
	if g.CurrentPlayer != 2 {
		t.Errorf("after advance current player = %d, want 2", g.CurrentPlayer)
	}

	g.PlayerOrder = nil
	g.InitChoicePhase()
	if g.CurrentPlayer != 0 {
		t.Errorf("with an empty order current player = %d, want 0", g.CurrentPlayer)
	}
}
