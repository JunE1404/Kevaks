package database

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrNameTaken    = errors.New("name already exists")
)

type DBHandler struct {
	Conn *pgxpool.Pool
}

type User struct {
	UUID    uuid.UUID
	Name    string
	Admin   bool
	Dev     bool
	Enabled bool
}

type UserInfo struct {
	UUID      uuid.UUID  `json:"uuid"`
	Name      string     `json:"name"`
	Admin     bool       `json:"admin"`
	Dev       bool       `json:"dev"`
	Enabled   bool       `json:"enabled"`
	Temp      bool       `json:"temp"`
	LastLogin *time.Time `json:"last_login"`
	Role      string     `json:"role"`
}

type Login struct {
	UUID    uuid.UUID
	PwdHash []byte
	Temp    bool
}

type Session struct {
	UUID        uuid.UUID
	CookieToken string
	TTL         time.Time
}

func Connect(connString string) (*DBHandler, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 1
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	return &DBHandler{Conn: pool}, nil
}

func (db *DBHandler) GetUser(ctx context.Context, uuid uuid.UUID) (*User, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, name, admin, dev, enabled
		FROM account.users
		WHERE uuid = $1`, uuid)

	var u User
	if err := row.Scan(&u.UUID, &u.Name, &u.Admin, &u.Dev, &u.Enabled); err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DBHandler) GetUserByName(ctx context.Context, name string) (*User, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, name, admin, dev, enabled
		FROM account.users
		WHERE name = $1`, name)

	var u User
	if err := row.Scan(&u.UUID, &u.Name, &u.Admin, &u.Dev, &u.Enabled); err != nil {
		return nil, err
	}
	return &u, nil
}

func (db *DBHandler) SetUser(ctx context.Context, u *User) error {
	_, err := db.Conn.Exec(ctx, `
		INSERT INTO account.users (uuid, name, admin, dev, enabled)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (uuid) DO UPDATE SET
			name = EXCLUDED.name,
			admin = EXCLUDED.admin,
			dev = EXCLUDED.dev,
			enabled = EXCLUDED.enabled`, u.UUID, u.Name, u.Admin, u.Dev, u.Enabled)
	if isUniqueViolation(err) {
		return ErrNameTaken
	}
	return err
}

func (db *DBHandler) SetUserEnabled(ctx context.Context, uuid uuid.UUID, enabled bool) error {
	tag, err := db.Conn.Exec(ctx, `
		UPDATE account.users
		SET enabled = $2
		WHERE uuid = $1`, uuid, enabled)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (db *DBHandler) ListUsers(ctx context.Context) ([]UserInfo, error) {
	rows, err := db.Conn.Query(ctx, `
		SELECT u.uuid, u.name, u.admin, u.dev, u.enabled, l.pwd_temp, l.last_login
		FROM account.users u
		LEFT JOIN auth.logins l ON l.uuid = u.uuid
		ORDER BY u.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []UserInfo{}
	for rows.Next() {
		var u UserInfo
		if err := rows.Scan(&u.UUID, &u.Name, &u.Admin, &u.Dev, &u.Enabled, &u.Temp, &u.LastLogin); err != nil {
			return nil, err
		}
		u.Role = "user"
		if u.Dev {
			u.Role = "dev"
		}
		if u.Admin {
			u.Role = "admin"
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (db *DBHandler) GetLogin(ctx context.Context, uuid uuid.UUID) (*Login, error) {
	row := db.Conn.QueryRow(ctx, `
		SELECT uuid, pwdhash, pwd_temp
		FROM auth.logins
		WHERE uuid = $1`, uuid)

	var l Login
	if err := row.Scan(&l.UUID, &l.PwdHash, &l.Temp); err != nil {
		return nil, err
	}
	return &l, nil
}

func (db *DBHandler) SetLogin(ctx context.Context, l *Login) error {
	_, err := db.Conn.Exec(ctx, `
		INSERT INTO auth.logins (uuid, pwdhash, pwd_temp)
		VALUES ($1, $2, $3)
		ON CONFLICT (uuid) DO UPDATE SET
			pwdhash = EXCLUDED.pwdhash,
			pwd_temp = EXCLUDED.pwd_temp`, l.UUID, l.PwdHash, l.Temp)
	return err
}

func (db *DBHandler) SetLastLogin(ctx context.Context, uuid uuid.UUID, t time.Time) error {
	_, err := db.Conn.Exec(ctx, `
		UPDATE auth.logins
		SET last_login = $2
		WHERE uuid = $1`, uuid, t)
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

func (db *DBHandler) DeleteUserSessions(ctx context.Context, uuid uuid.UUID) error {
	_, err := db.Conn.Exec(ctx, `
		DELETE FROM auth.sessions
		WHERE uuid = $1`, uuid)
	return err
}

func (db *DBHandler) RenameUser(ctx context.Context, uuid uuid.UUID, name string) error {
	tx, err := db.Conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var taken bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM account.users WHERE name = $1 AND uuid <> $2
		)`, name, uuid).Scan(&taken); err != nil {
		return err
	}
	if taken {
		return ErrNameTaken
	}

	tag, err := tx.Exec(ctx, `
		UPDATE account.users
		SET name = $2
		WHERE uuid = $1`, uuid, name)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrNameTaken
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return tx.Commit(ctx)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
