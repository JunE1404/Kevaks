package api

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/kevaks/backend-shared/database"
)

func AuthMiddleware(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if c.Method() == fiber.MethodOptions {
			return c.Next()
		}

		auth := c.Get("X-User-ID")
		uid, err := uuid.Parse(auth)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": "Unauthorized",
			})
		}

		token := c.Get("X-Cookie-Token")
		if token == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": "Unauthorized",
			})
		}

		session, err := db.GetSession(context.Background(), uid, token)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": "Unauthorized",
			})
		}

		if time.Now().After(session.TTL) {
			return c.Status(401).JSON(fiber.Map{
				"error": "Unauthorized",
			})
		}

		c.Locals("UID", uid)
		return c.Next()
	}
}
