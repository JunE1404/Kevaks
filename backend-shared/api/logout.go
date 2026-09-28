package api

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"github.com/kevaks/backend-shared/database"
)

func LogoutHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if uid, token, ok := readSessionCookie(c); ok {
			_ = db.DeleteSession(context.Background(), uid, token)
		}

		clearSessionCookie(c)
		return c.SendStatus(fiber.StatusOK)
	}
}
