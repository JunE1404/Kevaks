package handlers

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/database"
	"github.com/kevaks/backend-shared/games/trivia"
)

func SaveTriviaGameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		var game trivia.TriviaGame
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
