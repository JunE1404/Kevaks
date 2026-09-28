package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/kevaks/backend-shared/api"
	"github.com/kevaks/backend-shared/database"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file loaded:", err)
	}

	db, err := database.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Conn.Close()
	api.InitAPI(db)
}
