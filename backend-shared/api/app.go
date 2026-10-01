package api

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	h "github.com/kevaks/backend-shared/api/handlers"
	mw "github.com/kevaks/backend-shared/api/middleware"
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

	app.Get("/", h.HandleRoot)
	app.Get("/health", h.HandleHealth)
	app.Post("/login", h.LoginHandler(dbHandler))
	app.Post("/logout", h.LogoutHandler(dbHandler))
	app.Post("/password", mw.AuthMiddleware(dbHandler), h.ResetPasswordHandler(dbHandler))

	app.Use(mw.AuthMiddleware(dbHandler))
	app.Use(mw.PasswordResetGuard(dbHandler))

	app.Post("/profile/name", h.UpdateNameHandler(dbHandler))

	app.Get("/games/trivia", h.ListTriviaGamesHandler(dbHandler))
	app.Post("/games/trivia", h.SaveTriviaGameHandler(dbHandler))
	app.Get("/games/trivia/:uuid", h.GetTriviaGameHandler(dbHandler))

	admin := app.Group("/admin", mw.AdminMiddleware(dbHandler))
	admin.Get("/accounts", h.ListUsersHandler(dbHandler))
	admin.Post("/accounts", h.CreateAccountHandler(dbHandler))
	admin.Post("/accounts/:uuid/enable", h.SetAccountEnabledHandler(dbHandler, true))
	admin.Post("/accounts/:uuid/disable", h.SetAccountEnabledHandler(dbHandler, false))
	admin.Post("/accounts/:uuid/pw-reset", h.ResetAccountPasswordHandler(dbHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
