package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword returns a bcrypt hash at the default cost (10).
//
// We do not match the CF Pages implementation's PBKDF2 format on purpose:
// every account is freshly migrated via Story 0.8, so there are no legacy
// hashes to keep readable, and bcrypt is the more conventional choice.
func HashPassword(password string) (string, error) {
	if len(password) == 0 {
		return "", errors.New("auth: empty password")
	}
	if len(password) > 72 {
		// bcrypt silently truncates inputs >72 bytes; reject explicitly so
		// callers see the same outcome as the 128-char validation upstream.
		return "", errors.New("auth: password too long for bcrypt")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

// VerifyPassword checks password against a bcrypt hash. Returns true on match.
func VerifyPassword(password, hash string) bool {
	if hash == "" {
		return false
	}
	if len(password) > 72 {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
