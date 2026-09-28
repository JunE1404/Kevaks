package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const sessionCookieName = "kevaks_session"

func setSessionCookie(c fiber.Ctx, uid uuid.UUID, token string, ttl time.Time) {
	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    uid.String() + "." + token,
		Path:     "/",
		HTTPOnly: true,
		SameSite: fiber.CookieSameSiteLaxMode,
		Expires:  ttl,
	})
}

func clearSessionCookie(c fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		SameSite: fiber.CookieSameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

func readSessionCookie(c fiber.Ctx) (uuid.UUID, string, bool) {
	raw := c.Cookies(sessionCookieName)
	if raw == "" {
		return uuid.Nil, "", false
	}

	parts := strings.SplitN(raw, ".", 2)
	if len(parts) != 2 || parts[1] == "" {
		return uuid.Nil, "", false
	}

	uid, err := uuid.Parse(parts[0])
	if err != nil {
		return uuid.Nil, "", false
	}

	return uid, parts[1], true
}
