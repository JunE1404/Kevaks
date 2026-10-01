package handlers

import (
	"context"
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

func UpdateNameHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, ok := c.Locals("UID").(uuid.UUID)
		if !ok {
			return helpers.Unauthorized(c)
		}

		var body struct {
			Name string `json:"name"`
		}
		if err := c.Bind().Body(&body); err != nil || auth.ValidateName(body.Name) != nil {
			return helpers.ErrorCode(c, fiber.StatusBadRequest, "e20")
		}

		if err := db.RenameUser(context.Background(), uid, body.Name); err != nil {
			if errors.Is(err, database.ErrNameTaken) {
				return helpers.ErrorCode(c, fiber.StatusConflict, "e21")
			}
			return helpers.ServerError(c)
		}

		return c.SendStatus(fiber.StatusOK)
	}
}
