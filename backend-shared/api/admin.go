package api

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

func CreateAccountHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		var body struct {
			Name  string `json:"name"`
			Admin bool   `json:"admin"`
			Dev   bool   `json:"dev"`
		}
		if err := c.Bind().Body(&body); err != nil || body.Name == "" {
			return badRequest(c, "name is required")
		}

		tempPassword, err := auth.GenerateTempPassword()
		if err != nil {
			return serverError(c)
		}

		ctx := context.Background()
		id := uuid.New()

		if err := db.SetUser(ctx, &database.User{
			UUID:    id,
			Name:    body.Name,
			Admin:   body.Admin,
			Dev:     body.Dev,
			Enabled: true,
		}); err != nil {
			return badRequest(c, "could not create account")
		}

		if err := db.SetLogin(ctx, &database.Login{
			UUID:    id,
			PwdHash: auth.HashPassword(tempPassword),
			Temp:    true,
		}); err != nil {
			return serverError(c)
		}

		return c.Status(201).JSON(fiber.Map{
			"uuid":               id,
			"name":               body.Name,
			"temporary_password": tempPassword,
		})
	}
}

func ListUsersHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		users, err := db.ListUsers(context.Background())
		if err != nil {
			return serverError(c)
		}
		return c.JSON(users)
	}
}

func SetAccountEnabledHandler(db *database.DBHandler, enabled bool) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, err := uuid.Parse(c.Params("uuid"))
		if err != nil {
			return badRequest(c, "invalid uuid")
		}

		ctx := context.Background()
		if !enabled {
			if err := db.DeleteUserSessions(ctx, uid); err != nil {
				return serverError(c)
			}
		}
		if err := db.SetUserEnabled(ctx, uid, enabled); err != nil {
			return notFound(c)
		}

		return c.SendStatus(fiber.StatusOK)
	}
}

func ResetAccountPasswordHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		uid, err := uuid.Parse(c.Params("uuid"))
		if err != nil {
			return badRequest(c, "invalid uuid")
		}

		ctx := context.Background()
		user, err := db.GetUser(ctx, uid)
		if err != nil {
			return notFound(c)
		}

		if err := db.DeleteUserSessions(ctx, user.UUID); err != nil {
			return serverError(c)
		}

		tempPassword, err := auth.GenerateTempPassword()
		if err != nil {
			return serverError(c)
		}

		if err := db.SetLogin(ctx, &database.Login{
			UUID:    user.UUID,
			PwdHash: auth.HashPassword(tempPassword),
			Temp:    true,
		}); err != nil {
			return serverError(c)
		}

		return c.JSON(fiber.Map{
			"uuid":               user.UUID,
			"name":               user.Name,
			"temporary_password": tempPassword,
		})
	}
}
