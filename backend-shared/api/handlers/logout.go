package handlers

import (
	"context"

	"github.com/gofiber/fiber/v3"

	mw "github.com/kevaks/backend-shared/api/middleware"
	"github.com/kevaks/backend-shared/database"
)

func LogoutHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if uid, token, ok := mw.ReadSessionCookie(c); ok {
			_ = db.DeleteSession(context.Background(), uid, token)
		}

		mw.ClearSessionCookie(c)
		return c.SendStatus(fiber.StatusOK)
	}
}
