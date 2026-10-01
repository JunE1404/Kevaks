package handlers

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

func ResetPasswordHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		ctx := context.Background()

		login, err := db.GetLogin(ctx, uid)
		if err != nil {
			return helpers.Unauthorized(c)
		}
		if !login.Temp {
			return helpers.Forbidden(c)
		}

		var body struct {
			Password string `json:"password"`
		}
		if err := c.Bind().Body(&body); err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		if err := auth.ValidatePassword(body.Password); err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		if err := db.SetLogin(ctx, &database.Login{
			UUID:    uid,
			PwdHash: auth.HashPassword(body.Password),
			Temp:    false,
		}); err != nil {
			return helpers.ServerError(c)
		}

		return c.SendStatus(fiber.StatusOK)
	}
}
