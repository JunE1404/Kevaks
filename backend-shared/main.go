package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/kevaks/backend-shared/api"
	"github.com/kevaks/backend-shared/database"
	lk "github.com/kevaks/backend-shared/livekit"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file loaded:", err)
	}

	db, err := database.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Conn.Close()

	if _, err := lk.InitServer(
		env("LIVEKIT_URL", "http://localhost:7880"),
		env("LIVEKIT_API_KEY", "devkey"),
		env("LIVEKIT_API_SECRET", "secret"),
	); err != nil {
		log.Println("livekit init failed:", err)
	}

	api.InitAPI(db)
}
