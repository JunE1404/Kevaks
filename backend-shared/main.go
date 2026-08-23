package main

import (
	"os"

	"github.com/kevaks/backend-shared/database"
)

func main() {
	db := database.Connect(os.Getenv("DATABASE_URL"))
	defer db.Conn.Close()

}
