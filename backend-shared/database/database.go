package database

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBHandler struct {
	Conn *pgxpool.Pool
}

type User struct {
	UUID  uuid.UUID
	Name  string
	Admin bool
	Dev   bool
}

type Login struct {
	UUID    uuid.UUID
	PwdHash []byte
}

type Session struct {
	UUID        uuid.UUID
	CookieToken string
	TTL         time.Time
}

func Connect(connString string) *DBHandler {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil
	}

	config.MaxConns = 10
	config.MinConns = 1
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil
	}

	return &DBHandler{Conn: pool}
}

func (db *DBHandler) GetUser(ctx context.Context, uuid uuid.UUID) (*User, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, name, admin, dev
		FROM account.users
		WHERE uuid = $1`, uuid)

	var u User
	if err := row.Scan(&u.UUID, &u.Name, &u.Admin, &u.Dev); err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DBHandler) SetUser(ctx context.Context, u *User) error {
	_, err := db.Conn.Exec(ctx, `
		INSERT INTO account.users (uuid, name, admin, dev)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (uuid) DO UPDATE SET
			name = EXCLUDED.name,
			admin = EXCLUDED.admin,
			dev = EXCLUDED.dev`, u.UUID, u.Name, u.Admin, u.Dev)
	return err
}

func (db *DBHandler) GetLogin(ctx context.Context, uuid uuid.UUID) (*Login, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, pwdhash
		FROM auth.logins
		WHERE uuid = $1`, uuid)

	var l Login
	if err := row.Scan(&l.UUID, &l.PwdHash); err != nil {
		return nil, err
	}
	return &l, nil
}

func (db *DBHandler) SetLogin(ctx context.Context, l *Login) error {
	_, err := db.Conn.Exec(ctx, `
		INSERT INTO auth.logins (uuid, pwdhash)
		VALUES ($1, $2)
		ON CONFLICT (uuid) DO UPDATE SET
			pwdhash = EXCLUDED.pwdhash`, l.UUID, l.PwdHash)
	return err
}

func (db *DBHandler) GetSession(ctx context.Context, uuid uuid.UUID, cookieToken string) (*Session, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, cookietoken, ttl
		FROM auth.sessions
		WHERE uuid = $1 AND cookietoken = $2`, uuid, cookieToken)

	var s Session
	if err := row.Scan(&s.UUID, &s.CookieToken, &s.TTL); err != nil {
		return nil, err
	}
	return &s, nil
}

func (db *DBHandler) SetSession(ctx context.Context, s *Session) error {
	_, err := db.Conn.Exec(ctx, `
		INSERT INTO auth.sessions (uuid, cookietoken, ttl)
		VALUES ($1, $2, $3)
		ON CONFLICT (uuid, cookietoken) DO UPDATE SET
			ttl = EXCLUDED.ttl`, s.UUID, s.CookieToken, s.TTL)
	return err
}

func (db *DBHandler) DeleteSession(ctx context.Context, uuid uuid.UUID, cookieToken string) error {
	tag, err := db.Conn.Exec(ctx, `
		DELETE FROM auth.sessions
		WHERE uuid = $1 AND cookietoken = $2`, uuid, cookieToken)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("session not found")
	}
	return nil
}
