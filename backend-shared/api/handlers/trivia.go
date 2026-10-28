package handlers

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"net/url"
	"strings"

	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/database"
	t "github.com/kevaks/backend-shared/types"

	"github.com/fasthttp/websocket"

	"github.com/valyala/fasthttp"

	triv "github.com/kevaks/backend-shared/games/trivia"
	ws "github.com/kevaks/backend-shared/ws/trivia"
)

func SaveTriviaGameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		var game t.TriviaGame
		if err := c.Bind().Body(&game); err != nil {
			return helpers.BadRequest(c, "invalid trivia game")
		}

		switch err := db.SaveTriviaGame(context.Background(), uid, &game); {
		case err == nil:
		case errors.Is(err, database.ErrGameForbidden):
			return helpers.Forbidden(c)
		case errors.Is(err, database.ErrTooManyCategoryField):
			return helpers.ErrorCode(c, fiber.StatusBadRequest, "e30")
		case errors.Is(err, database.ErrFieldTypeInvalid):
			return helpers.ErrorCode(c, fiber.StatusBadRequest, "e31")
		case errors.Is(err, database.ErrSpecialTextRequired):
			return helpers.ErrorCode(c, fiber.StatusBadRequest, "e32")
		default:
			return helpers.ServerError(c)
		}

		return c.JSON(game)
	}
}

func GetTriviaGameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		gameUid, err := uuid.Parse(c.Params("uuid"))
		if err != nil {
			return helpers.BadRequest(c, "invalid uuid")
		}

		game, err := db.GetTriviaGame(context.Background(), uid, gameUid)
		if err != nil {
			return helpers.NotFound(c)
		}

		return c.JSON(game)
	}
}

func StartTriviaGameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		gameUid, err := uuid.Parse(c.Params("uuid"))
		if err != nil {
			return helpers.BadRequest(c, "invalid uuid")
		}

		game, err := triv.StartGame(db, uid, gameUid)
		if err != nil {
			return helpers.NotFound(c)
		}

		if !game.Gamestate.GameData.Done {
			return helpers.BadRequest(c, "game is not complete")
		}

		ok = ws.NewHub(game)

		return c.JSON(ok)
	}
}

func ListTriviaGamesHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		games, err := db.ListTriviaGames(context.Background(), uid)
		if err != nil {
			return helpers.ServerError(c)
		}

		return c.JSON(games)
	}
}

func DeleteTriviaGameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		gameUid, err := uuid.Parse(c.Params("uuid"))
		if err != nil {
			return helpers.BadRequest(c, "invalid uuid")
		}

		if err := db.DeleteTriviaGame(context.Background(), uid, gameUid); err != nil {
			if errors.Is(err, database.ErrGameNotFound) {
				return helpers.NotFound(c)
			}
			return helpers.ServerError(c)
		}

		return c.SendStatus(fiber.StatusOK)
	}
}

var wsUpgrader = websocket.FastHTTPUpgrader{
	CheckOrigin: func(ctx *fasthttp.RequestCtx) bool {
		origin := string(ctx.Request.Header.Peek("Origin"))
		if origin == "" {
			return true
		}

		parsed, err := url.Parse(origin)
		if err != nil {
			return false
		}

		if strings.EqualFold(parsed.Host, string(ctx.Host())) {
			return true
		}

		// Vite dev server.
		return parsed.Host == "localhost:5173" || parsed.Host == "127.0.0.1:5173"
	},
}

func TriviaWebSocketHandler() fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		hub := ws.GetHub()
		if hub == nil {
			return helpers.NotFound(c)
		}

		if err := wsUpgrader.Upgrade(c.RequestCtx(), func(conn *websocket.Conn) {
			hub.Serve(uid, conn)
		}); err != nil {
			return fiber.ErrUpgradeRequired
		}

		return nil
	}
}

func TriviaActiveLobbyHandler() fiber.Handler {
	return func(c fiber.Ctx) error {
		return c.JSON(ws.TriviaLobbyActive())
	}
}
