package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"

	mw "github.com/kevaks/backend-shared/api/middleware"
	helpers "github.com/kevaks/backend-shared/api/misc"
	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

const sessionTTL = 30 * 24 * time.Hour

func LoginHandler(db *database.DBHandler) fiber.Handler {
	return func(c fiber.Ctx) error {
		ctx := context.Background()

		var body struct {
			Name     string `json:"name"`
			Password string `json:"password"`
		}
		hasCredentials := c.Bind().Body(&body) == nil && body.Name != "" && body.Password != ""

		if hasCredentials {
			user, err := db.GetUserByName(ctx, body.Name)
			if err != nil || !user.Enabled {
				return helpers.Unauthorized(c)
			}

			login, err := db.GetLogin(ctx, user.UUID)
			if err != nil || !auth.CompareHashAndPassword(login.PwdHash, body.Password) {
				return helpers.Unauthorized(c)
			}

			newToken, err := auth.GenerateSessionToken()
			if err != nil {
				return helpers.ServerError(c)
			}

			session := &database.Session{
				UUID:        user.UUID,
				CookieToken: newToken,
				TTL:         time.Now().Add(sessionTTL),
			}
			if err := db.SetSession(ctx, session); err != nil {
				return helpers.ServerError(c)
			}
			if err := db.SetLastLogin(ctx, user.UUID, time.Now()); err != nil {
				return helpers.ServerError(c)
			}

			mw.SetSessionCookie(c, user.UUID, newToken, session.TTL)

			return c.JSON(userPayload(user, login))
		}

		if uid, token, ok := mw.ReadSessionCookie(c); ok {
			session, err := db.GetSession(ctx, uid, token)
			if err != nil || time.Now().After(session.TTL) {
				return helpers.Unauthorized(c)
			}

			user, err := db.GetUser(ctx, uid)
			if err != nil || !user.Enabled {
				return helpers.Unauthorized(c)
			}

			login, err := db.GetLogin(ctx, uid)
			if err != nil {
				return helpers.Unauthorized(c)
			}

			session.TTL = time.Now().Add(sessionTTL)
			if err := db.SetSession(ctx, session); err != nil {
				return helpers.ServerError(c)
			}
			mw.SetSessionCookie(c, uid, token, session.TTL)

			return c.JSON(userPayload(user, login))
		}

		return helpers.Unauthorized(c)
	}
}

func userPayload(user *database.User, login *database.Login) fiber.Map {
	return fiber.Map{
		"uuid":  user.UUID,
		"name":  user.Name,
		"admin": user.Admin,
		"dev":   user.Dev,
		"temp":  login.Temp,
	}
}
