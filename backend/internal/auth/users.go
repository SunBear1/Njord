package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SchemaDDL creates the `users` table. Idempotent; safe to call on every
// startup.
//
// We intentionally omit oauth_accounts: OAuth is deferred to Epic 99 per
// PRD; introducing the table without a writer would only add dead code.
const SchemaDDL = `
CREATE TABLE IF NOT EXISTS users (
    id             TEXT        PRIMARY KEY,
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT,
    name           TEXT,
    avatar_url     TEXT,
    email_verified BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
`

// ApplySchema initialises the users table.
func ApplySchema(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, SchemaDDL); err != nil {
		return fmt.Errorf("auth: apply schema: %w", err)
	}
	return nil
}

// ErrUserExists is returned by CreateUser when the email is already taken.
var ErrUserExists = errors.New("user already exists")

// ErrUserNotFound is returned by GetUserByID/Email when the row is missing.
var ErrUserNotFound = errors.New("user not found")

// User is the in-Go projection of one row.
type User struct {
	ID           string
	Email        string
	PasswordHash *string
	Name         *string
	AvatarURL    *string
}

// CreateUser inserts a new row and returns the generated id. Returns
// ErrUserExists if the email is already registered.
func CreateUser(ctx context.Context, pool *pgxpool.Pool, email, passwordHash string, name *string) (string, error) {
	id := uuid.NewString()
	_, err := pool.Exec(ctx, `
INSERT INTO users (id, email, password_hash, name)
VALUES ($1, $2, $3, $4)
`, id, email, passwordHash, name)
	if err != nil {
		if isUniqueViolation(err) {
			return "", ErrUserExists
		}
		return "", err
	}
	return id, nil
}

// GetUserByEmail looks up a user by email.
func GetUserByEmail(ctx context.Context, pool *pgxpool.Pool, email string) (*User, error) {
	var u User
	err := pool.QueryRow(ctx, `
SELECT id, email, password_hash, name, avatar_url
  FROM users
 WHERE email = $1
`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// GetUserByID looks up a user by primary key.
func GetUserByID(ctx context.Context, pool *pgxpool.Pool, id string) (*User, error) {
	var u User
	err := pool.QueryRow(ctx, `
SELECT id, email, password_hash, name, avatar_url
  FROM users
 WHERE id = $1
`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Name, &u.AvatarURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UpdatePassword rewrites the bcrypt hash.
func UpdatePassword(ctx context.Context, pool *pgxpool.Pool, id, newHash string) error {
	_, err := pool.Exec(ctx, `
UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
`, newHash, id)
	return err
}

// DeleteUser drops the row.
func DeleteUser(ctx context.Context, pool *pgxpool.Pool, id string) error {
	_, err := pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

func isUniqueViolation(err error) bool {
	// pgx error codes: 23505 = unique_violation
	return err != nil && (containsCode(err, "23505") || errors.Is(err, pgx.ErrTooManyRows))
}

func containsCode(err error, code string) bool {
	type sqlStateErr interface{ SQLState() string }
	var s sqlStateErr
	if errors.As(err, &s) {
		return s.SQLState() == code
	}
	return false
}
