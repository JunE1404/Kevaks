package handlers

import "github.com/gofiber/fiber/v3"

func HandleRoot(c fiber.Ctx) error {
	return c.SendStatus(200)
}

func HandleHealth(c fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}
