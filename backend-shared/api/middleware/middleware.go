package middleware

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/database"
)

func AuthMiddleware(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		if c.Method() == fiber.MethodOptions {
			return c.Next()
		}

		uid, token, ok := ReadSessionCookie(c)
		if !ok {
			return helpers.Unauthorized(c)
		}

		session, err := db.GetSession(context.Background(), uid, token)
		if err != nil || time.Now().After(session.TTL) {
			return helpers.Unauthorized(c)
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
			return helpers.Unauthorized(c)
		}

		user, err := db.GetUser(context.Background(), uid)
		if err != nil {
			return helpers.Unauthorized(c)
		}

		if !user.Admin {
			return helpers.Forbidden(c)
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
			return helpers.Unauthorized(c)
		}

		login, err := db.GetLogin(context.Background(), uid)
		if err != nil {
			return helpers.Unauthorized(c)
		}

		if login.Temp {
			return helpers.Forbidden(c)
		}

		return c.Next()
	}
}
