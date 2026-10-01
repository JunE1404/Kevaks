package misc

import "github.com/gofiber/fiber/v3"

func Unauthorized(c fiber.Ctx) error {
	return c.Status(401).JSON(fiber.Map{
		"error": "Unauthorized",
	})
}

func BadRequest(c fiber.Ctx, message string) error {
	return c.Status(400).JSON(fiber.Map{
		"error": message,
	})
}

func ErrorCode(c fiber.Ctx, status int, code string) error {
	return c.Status(status).JSON(fiber.Map{
		"error": code,
	})
}

func Forbidden(c fiber.Ctx) error {
	return c.Status(403).JSON(fiber.Map{
		"error": "Forbidden",
	})
}

func NotFound(c fiber.Ctx) error {
	return c.Status(404).JSON(fiber.Map{
		"error": "Not Found",
	})
}

func ServerError(c fiber.Ctx) error {
	return c.Status(500).JSON(fiber.Map{
		"error": "Internal Server Error",
	})
}
