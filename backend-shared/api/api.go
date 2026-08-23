package api

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/kevaks/backend-shared/database"
)

func InitAPI(dbHandler *database.DBHandler) {
	app := fiber.New()

	app.Get("/", func(c fiber.Ctx) error {
		return c.SendString("kevaks backend")
	})

	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
