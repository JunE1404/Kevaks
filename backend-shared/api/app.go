package api

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/kevaks/backend-shared/database"
)

func InitAPI(dbHandler *database.DBHandler) {
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowCredentials: true,
		AllowHeaders:     []string{"Content-Type"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
	}))

	app.Get("/", handleRoot)
	app.Get("/health", handleHealth)
	app.Post("/login", LoginHandler(dbHandler))
	app.Post("/logout", LogoutHandler(dbHandler))
	app.Post("/password", AuthMiddleware(dbHandler), ResetPasswordHandler(dbHandler))

	app.Use(AuthMiddleware(dbHandler))
	app.Use(PasswordResetGuard(dbHandler))

	app.Post("/profile/name", UpdateNameHandler(dbHandler))

	admin := app.Group("/admin", AdminMiddleware(dbHandler))
	admin.Get("/accounts", ListUsersHandler(dbHandler))
	admin.Post("/accounts", CreateAccountHandler(dbHandler))
	admin.Post("/accounts/:uuid/enable", SetAccountEnabledHandler(dbHandler, true))
	admin.Post("/accounts/:uuid/disable", SetAccountEnabledHandler(dbHandler, false))
	admin.Post("/accounts/:uuid/pw-reset", ResetAccountPasswordHandler(dbHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}

func handleRoot(c fiber.Ctx) error {
	return c.SendString("kevaks backend")
}

func handleHealth(c fiber.Ctx) error {
	return c.JSON(fiber.Map{"status": "ok"})
}
