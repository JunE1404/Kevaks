package api

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"

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
				return unauthorized(c)
			}

			login, err := db.GetLogin(ctx, user.UUID)
			if err != nil || !auth.CompareHashAndPassword(login.PwdHash, body.Password) {
				return unauthorized(c)
			}

			newToken, err := auth.GenerateSessionToken()
			if err != nil {
				return serverError(c)
			}

			session := &database.Session{
				UUID:        user.UUID,
				CookieToken: newToken,
				TTL:         time.Now().Add(sessionTTL),
			}
			if err := db.SetSession(ctx, session); err != nil {
				return serverError(c)
			}
			if err := db.SetLastLogin(ctx, user.UUID, time.Now()); err != nil {
				return serverError(c)
			}

			setSessionCookie(c, user.UUID, newToken, session.TTL)

			return c.JSON(userPayload(user, login))
		}

		if uid, token, ok := readSessionCookie(c); ok {
			session, err := db.GetSession(ctx, uid, token)
			if err != nil || time.Now().After(session.TTL) {
				return unauthorized(c)
			}

			user, err := db.GetUser(ctx, uid)
			if err != nil || !user.Enabled {
				return unauthorized(c)
			}

			login, err := db.GetLogin(ctx, uid)
			if err != nil {
				return unauthorized(c)
			}

			session.TTL = time.Now().Add(sessionTTL)
			if err := db.SetSession(ctx, session); err != nil {
				return serverError(c)
			}
			setSessionCookie(c, uid, token, session.TTL)

			return c.JSON(userPayload(user, login))
		}

		return unauthorized(c)
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
