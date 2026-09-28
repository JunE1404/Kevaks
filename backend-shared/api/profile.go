package api

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

func UpdateNameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return unauthorized(c)
		}

		var body struct {
			Name string `json:"name"`
		}
		if err := c.Bind().Body(&body); err != nil || auth.ValidateName(body.Name) != nil {
			return errorCode(c, fiber.StatusBadRequest, "e20")
		}

		if err := db.RenameUser(context.Background(), uid, body.Name); err != nil {
			if errors.Is(err, database.ErrNameTaken) {
				return errorCode(c, fiber.StatusConflict, "e21")
			}
			return serverError(c)
		}

		return c.SendStatus(fiber.StatusOK)
	}
}
