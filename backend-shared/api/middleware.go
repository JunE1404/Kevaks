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

		uid, token, ok := readSessionCookie(c)
		if !ok {
			return unauthorized(c)
		}

		session, err := db.GetSession(context.Background(), uid, token)
		if err != nil || time.Now().After(session.TTL) {
			return unauthorized(c)
		}

		c.Locals("UID", uid)
		return c.Next()
	}
}

func AdminMiddleware(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if c.Method() == fiber.MethodOptions {
			return c.Next()
		}

		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return unauthorized(c)
		}

		user, err := db.GetUser(context.Background(), uid)
		if err != nil {
			return unauthorized(c)
		}

		if !user.Admin {
			return forbidden(c)
		}

		return c.Next()
	}
}

func PasswordResetGuard(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if c.Method() == fiber.MethodOptions {
			return c.Next()
		}

		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return unauthorized(c)
		}

		login, err := db.GetLogin(context.Background(), uid)
		if err != nil {
			return unauthorized(c)
		}

		if login.Temp {
			return c.Status(403).JSON(fiber.Map{
				"error": "Password reset required",
			})
		}

		return c.Next()
	}
}

func unauthorized(c fiber.Ctx) error {
	return c.Status(401).JSON(fiber.Map{
		"error": "Unauthorized",
	})
}

func badRequest(c fiber.Ctx, message string) error {
	return c.Status(400).JSON(fiber.Map{
		"error": message,
	})
}

func forbidden(c fiber.Ctx) error {
	return c.Status(403).JSON(fiber.Map{
		"error": "Forbidden",
	})
}

func notFound(c fiber.Ctx) error {
	return c.Status(404).JSON(fiber.Map{
		"error": "Not Found",
	})
}

func serverError(c fiber.Ctx) error {
	return c.Status(500).JSON(fiber.Map{
		"error": "Internal Server Error",
	})
}
