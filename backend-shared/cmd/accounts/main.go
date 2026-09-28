package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"

	"github.com/kevaks/backend-shared/auth"
	"github.com/kevaks/backend-shared/database"
)

func main() {
	create := flag.String("create", "", "username to create")
	admin := flag.Bool("admin", false, "grant admin (with --create)")
	dev := flag.Bool("dev", false, "grant dev (with --create)")
	disable := flag.String("disable", "", "username to disable")
	enable := flag.String("enable", "", "username to enable")
	pwReset := flag.String("pw-reset", "", "username to reset password for")
	flag.Parse()

	actions := 0
	for _, name := range []string{*create, *disable, *enable, *pwReset} {
		if name != "" {
			actions++
		}
	}
	if actions != 1 {
		flag.Usage()
		os.Exit(2)
	}

	db := database.Connect(os.Getenv("DATABASE_URL"))
	if db == nil {
		log.Fatal("could not connect to database")
	}

	ctx := context.Background()

	switch {
	case *create != "":
		if err := createAccount(ctx, db, *create, *admin, *dev); err != nil {
			log.Fatal(err)
		}
	case *disable != "":
		if err := disableAccount(ctx, db, *disable); err != nil {
			log.Fatal(err)
		}
	case *enable != "":
		if err := enableAccount(ctx, db, *enable); err != nil {
			log.Fatal(err)
		}
	case *pwReset != "":
		if err := resetPassword(ctx, db, *pwReset); err != nil {
			log.Fatal(err)
		}
	}
}

func createAccount(ctx context.Context, db *database.DBHandler, name string, admin, dev bool) error {
	tempPassword, err := auth.GenerateTempPassword()
	if err != nil {
		return err
	}

	id := uuid.New()
	if err := db.SetUser(ctx, &database.User{
		UUID:    id,
		Name:    name,
		Admin:   admin,
		Dev:     dev,
		Enabled: true,
	}); err != nil {
		return fmt.Errorf("create account: %w", err)
	}

	if err := db.SetLogin(ctx, &database.Login{
		UUID:    id,
		PwdHash: auth.HashPassword(tempPassword),
		Temp:    true,
	}); err != nil {
		return fmt.Errorf("create login: %w", err)
	}

	fmt.Printf("uuid: %s\nusername: %s\ntemporary password: %s\n", id, name, tempPassword)
	return nil
}

func disableAccount(ctx context.Context, db *database.DBHandler, name string) error {
	user, err := db.GetUserByName(ctx, name)
	if err != nil {
		return fmt.Errorf("disable account: %w", err)
	}

	if err := db.DeleteUserSessions(ctx, user.UUID); err != nil {
		return fmt.Errorf("invalidate sessions: %w", err)
	}

	if err := db.SetUserEnabled(ctx, user.UUID, false); err != nil {
		return fmt.Errorf("disable account: %w", err)
	}

	fmt.Printf("disabled: %s\n", name)
	return nil
}

func enableAccount(ctx context.Context, db *database.DBHandler, name string) error {
	user, err := db.GetUserByName(ctx, name)
	if err != nil {
		return fmt.Errorf("enable account: %w", err)
	}

	if err := db.SetUserEnabled(ctx, user.UUID, true); err != nil {
		return fmt.Errorf("enable account: %w", err)
	}

	fmt.Printf("enabled: %s\n", name)
	return nil
}

func resetPassword(ctx context.Context, db *database.DBHandler, name string) error {
	user, err := db.GetUserByName(ctx, name)
	if err != nil {
		return fmt.Errorf("reset password: %w", err)
	}

	tempPassword, err := auth.GenerateTempPassword()
	if err != nil {
		return err
	}

	if err := db.SetLogin(ctx, &database.Login{
		UUID:    user.UUID,
		PwdHash: auth.HashPassword(tempPassword),
		Temp:    true,
	}); err != nil {
		return fmt.Errorf("reset password: %w", err)
	}

	if err := db.DeleteUserSessions(ctx, user.UUID); err != nil {
		return fmt.Errorf("invalidate sessions: %w", err)
	}

	fmt.Printf("username: %s\ntemporary password: %s\n", name, tempPassword)
	return nil
}
