package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/kevaks/backend-shared/games/trivia"
)

var (
	ErrGameForbidden        = errors.New("trivia game does not belong to this user")
	ErrTooManyCategoryField = errors.New("trivia category has more fields than category points")
	ErrFieldTypeInvalid     = errors.New("trivia field type must be \"normal\" or \"special\"")
	ErrSpecialTextRequired  = errors.New("trivia field of type \"special\" requires special text")
)

type TriviaGameInfo struct {
	UUID        uuid.UUID `json:"uuid"`
	Title       string    `json:"title"`
	Done        bool      `json:"done"`
	LastUpdated time.Time `json:"lastUpdate"`
}

// SaveTriviaGame persists the supplied game and everything below it (boards,
// categories and fields) on behalf of owner. The supplied data is
// authoritative: rows whose uuid is present are updated (and
// re-parented/re-ordered), rows whose uuid is missing are deleted, and new rows
// are inserted. Entities that arrive without a uuid are assigned one; the
// supplied game is mutated in place so the caller can send the fully identified
// state back to the frontend.
//
// A game that already exists may only be saved by its owner, otherwise
// ErrGameForbidden is returned. A category may not have more fields than its
// board has category points (ErrTooManyCategoryField); a field's type must be
// "normal" or "special" (ErrFieldTypeInvalid) and a "special" field must carry
// special text (ErrSpecialTextRequired). game.Done is recomputed as part of the
// save.
func (db *DBHandler) SaveTriviaGame(ctx context.Context, owner uuid.UUID, game *trivia.TriviaGame) error {
	tx, err := db.Conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin trivia game transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if game.Uid == uuid.Nil {
		game.Uid = uuid.New()
	}

	var existingOwner uuid.UUID
	switch err := tx.QueryRow(ctx, `
		SELECT owner FROM game.trivia_games WHERE uuid = $1`, game.Uid).Scan(&existingOwner); {
	case err == nil:
		if existingOwner != owner {
			return ErrGameForbidden
		}
	case errors.Is(err, pgx.ErrNoRows):
	default:
		return fmt.Errorf("lookup trivia game owner: %w", err)
	}
	game.Owner = owner
	game.Done = triviaGameDone(game)

	if _, err := tx.Exec(ctx, `
		INSERT INTO game.trivia_games (uuid, owner, title, done)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (uuid) DO UPDATE SET
			title = EXCLUDED.title,
			done = EXCLUDED.done,
			updated_at = now()`, game.Uid, game.Owner, game.Title, game.Done); err != nil {
		return fmt.Errorf("upsert trivia game: %w", err)
	}

	boardUids := make([]uuid.UUID, len(game.Boards))
	for i := range game.Boards {
		if game.Boards[i].Uid == uuid.Nil {
			game.Boards[i].Uid = uuid.New()
		}
		boardUids[i] = game.Boards[i].Uid
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM game.trivia_boards
		WHERE game_uuid = $1 AND uuid <> ALL($2::uuid[])`, game.Uid, boardUids); err != nil {
		return fmt.Errorf("delete removed trivia boards: %w", err)
	}

	for i := range game.Boards {
		if err := saveBoard(ctx, tx, game.Uid, i, &game.Boards[i]); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit trivia game transaction: %w", err)
	}
	return nil
}

func saveBoard(ctx context.Context, tx pgx.Tx, gameUid uuid.UUID, position int, board *trivia.Board) error {
	if board.Uid == uuid.Nil {
		board.Uid = uuid.New()
	}

	categoryUids := make([]uuid.UUID, len(board.Categories))
	for i := range board.Categories {
		if board.Categories[i].Uid == uuid.Nil {
			board.Categories[i].Uid = uuid.New()
		}
		categoryUids[i] = board.Categories[i].Uid
	}

	for i := range board.Categories {
		if len(board.Categories[i].Fields) > len(board.CategoryPoints) {
			return fmt.Errorf("trivia category %s has %d fields but only %d category points: %w",
				board.Categories[i].Uid, len(board.Categories[i].Fields), len(board.CategoryPoints), ErrTooManyCategoryField)
		}
	}

	points := make([]int32, len(board.CategoryPoints))
	for i, p := range board.CategoryPoints {
		points[i] = int32(p)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO game.trivia_boards (uuid, game_uuid, title, category_points, position)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (uuid) DO UPDATE SET
			game_uuid = EXCLUDED.game_uuid,
			title = EXCLUDED.title,
			category_points = EXCLUDED.category_points,
			position = EXCLUDED.position`,
		board.Uid, gameUid, board.Title, points, position); err != nil {
		return fmt.Errorf("upsert trivia board %s: %w", board.Uid, err)
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM game.trivia_categories
		WHERE board_uuid = $1 AND uuid <> ALL($2::uuid[])`, board.Uid, categoryUids); err != nil {
		return fmt.Errorf("delete removed trivia categories: %w", err)
	}

	for i := range board.Categories {
		if err := saveCategory(ctx, tx, board.Uid, i, &board.Categories[i]); err != nil {
			return err
		}
	}
	return nil
}

func saveCategory(ctx context.Context, tx pgx.Tx, boardUid uuid.UUID, position int, category *trivia.Category) error {
	if category.Uid == uuid.Nil {
		category.Uid = uuid.New()
	}

	fieldUids := make([]uuid.UUID, len(category.Fields))
	for i := range category.Fields {
		field := &category.Fields[i]
		if field.Uid == uuid.Nil {
			field.Uid = uuid.New()
		}
		switch field.Type {
		case "normal":
		case "special":
			if field.SpecialText == "" {
				return fmt.Errorf("trivia field %s: %w", field.Uid, ErrSpecialTextRequired)
			}
		default:
			return fmt.Errorf("trivia field %s has type %q: %w", field.Uid, field.Type, ErrFieldTypeInvalid)
		}
		fieldUids[i] = field.Uid
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO game.trivia_categories (uuid, board_uuid, name, position)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (uuid) DO UPDATE SET
			board_uuid = EXCLUDED.board_uuid,
			name = EXCLUDED.name,
			position = EXCLUDED.position`,
		category.Uid, boardUid, category.Name, position); err != nil {
		return fmt.Errorf("upsert trivia category %s: %w", category.Uid, err)
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM game.trivia_fields
		WHERE category_uuid = $1 AND uuid <> ALL($2::uuid[])`, category.Uid, fieldUids); err != nil {
		return fmt.Errorf("delete removed trivia fields: %w", err)
	}

	for i := range category.Fields {
		field := &category.Fields[i]
		if _, err := tx.Exec(ctx, `
			INSERT INTO game.trivia_fields (uuid, category_uuid, type, text, special_text, position)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (uuid) DO UPDATE SET
				category_uuid = EXCLUDED.category_uuid,
				type = EXCLUDED.type,
				text = EXCLUDED.text,
				special_text = EXCLUDED.special_text,
				position = EXCLUDED.position`,
			field.Uid, category.Uid, field.Type, field.Text, field.SpecialText, i); err != nil {
			return fmt.Errorf("upsert trivia field %s: %w", field.Uid, err)
		}
	}
	return nil
}

// GetTriviaGame loads a game and its full board state, ordered exactly as it
// was saved, ready to be serialized back to the frontend. Only a game owned by
// the supplied owner is returned.
func (db *DBHandler) GetTriviaGame(ctx context.Context, owner uuid.UUID, uid uuid.UUID) (*trivia.TriviaGame, error) {
	game := &trivia.TriviaGame{Boards: []trivia.Board{}}

	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, owner, title, done
		FROM game.trivia_games
		WHERE uuid = $1 AND owner = $2`, uid, owner)
	if err := row.Scan(&game.Uid, &game.Owner, &game.Title, &game.Done); err != nil {
		return nil, err
	}

	boardRows, err := db.Conn.Query(ctx, `
		SELECT uuid, title, category_points
		FROM game.trivia_boards
		WHERE game_uuid = $1
		ORDER BY position`, uid)
	if err != nil {
		return nil, err
	}
	defer boardRows.Close()

	boardIndex := map[uuid.UUID]int{}
	for boardRows.Next() {
		var (
			board  trivia.Board
			points []int32
		)
		if err := boardRows.Scan(&board.Uid, &board.Title, &points); err != nil {
			return nil, err
		}
		board.CategoryPoints = make([]int, len(points))
		for i, p := range points {
			board.CategoryPoints[i] = int(p)
		}
		board.Categories = []trivia.Category{}
		boardIndex[board.Uid] = len(game.Boards)
		game.Boards = append(game.Boards, board)
	}
	if err := boardRows.Err(); err != nil {
		return nil, err
	}

	categoryRows, err := db.Conn.Query(ctx, `
		SELECT c.uuid, c.board_uuid, c.name
		FROM game.trivia_categories c
		JOIN game.trivia_boards b ON b.uuid = c.board_uuid
		WHERE b.game_uuid = $1
		ORDER BY b.position, c.position`, uid)
	if err != nil {
		return nil, err
	}
	defer categoryRows.Close()

	categoryBoard := map[uuid.UUID]int{}
	categoryPosition := map[uuid.UUID]int{}
	for categoryRows.Next() {
		var (
			categoryUid uuid.UUID
			boardUid    uuid.UUID
			name        string
		)
		if err := categoryRows.Scan(&categoryUid, &boardUid, &name); err != nil {
			return nil, err
		}
		bi, ok := boardIndex[boardUid]
		if !ok {
			continue
		}
		game.Boards[bi].Categories = append(game.Boards[bi].Categories, trivia.Category{
			Uid:    categoryUid,
			Name:   name,
			Fields: []trivia.Field{},
		})
		categoryBoard[categoryUid] = bi
		categoryPosition[categoryUid] = len(game.Boards[bi].Categories) - 1
	}
	if err := categoryRows.Err(); err != nil {
		return nil, err
	}

	fieldRows, err := db.Conn.Query(ctx, `
		SELECT f.uuid, f.category_uuid, f.type, f.text, f.special_text
		FROM game.trivia_fields f
		JOIN game.trivia_categories c ON c.uuid = f.category_uuid
		JOIN game.trivia_boards b ON b.uuid = c.board_uuid
		WHERE b.game_uuid = $1
		ORDER BY b.position, c.position, f.position`, uid)
	if err != nil {
		return nil, err
	}
	defer fieldRows.Close()

	for fieldRows.Next() {
		var (
			fieldUid    uuid.UUID
			categoryUid uuid.UUID
			fieldType   string
			text        string
			specialText string
		)
		if err := fieldRows.Scan(&fieldUid, &categoryUid, &fieldType, &text, &specialText); err != nil {
			return nil, err
		}
		bi, ok := categoryBoard[categoryUid]
		if !ok {
			continue
		}
		ci, ok := categoryPosition[categoryUid]
		if !ok {
			continue
		}
		game.Boards[bi].Categories[ci].Fields = append(
			game.Boards[bi].Categories[ci].Fields,
			trivia.Field{Uid: fieldUid, Type: fieldType, Text: text, SpecialText: specialText},
		)
	}
	if err := fieldRows.Err(); err != nil {
		return nil, err
	}

	return game, nil
}

// ListTriviaGames returns a lightweight summary of every game owned by the
// supplied owner, newest first.
func (db *DBHandler) ListTriviaGames(ctx context.Context, owner uuid.UUID) ([]TriviaGameInfo, error) {
	rows, err := db.Conn.Query(ctx, `
		SELECT uuid, title, done, updated_at
		FROM game.trivia_games
		WHERE owner = $1
		ORDER BY updated_at DESC`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	games := []TriviaGameInfo{}
	for rows.Next() {
		var g TriviaGameInfo
		if err := rows.Scan(&g.UUID, &g.Title, &g.Done, &g.LastUpdated); err != nil {
			return nil, err
		}
		games = append(games, g)
	}
	return games, rows.Err()
}

// triviaGameDone reports whether every category in the game is fully populated,
// i.e. has exactly as many fields as its board declares category points. A game
// without any categories is not considered done.
func triviaGameDone(game *trivia.TriviaGame) bool {
	hasCategory := false
	for _, board := range game.Boards {
		for _, category := range board.Categories {
			hasCategory = true
			if len(category.Fields) != len(board.CategoryPoints) {
				return false
			}
		}
	}
	return hasCategory
}
