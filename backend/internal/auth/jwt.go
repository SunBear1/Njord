// Package auth provides JWT signing/verification, bcrypt password hashing,
// HttpOnly cookie helpers, and the HTTP handlers that back
// /api/v1/auth/{register,login,logout,me,change-password,delete-account}.
//
// JWT_SECRET is read from the environment by the caller (cmd/server); this
// package never touches process state.
package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Claims is the subset of JWT claims that the Njord auth flow uses.
// `Sub` is the user id, mirroring the existing TS implementation.
type Claims struct {
	Sub   string  `json:"sub"`
	Email string  `json:"email"`
	Name  *string `json:"name"`
	Iat   int64   `json:"iat"`
	Exp   int64   `json:"exp"`
}

// JWTExpiry is the lifetime of an issued token. 7d matches the TS impl.
const JWTExpiry = 7 * 24 * time.Hour

// SignJWT returns a compact JWS (HS256) over the claims with iat/exp filled in.
func SignJWT(sub, email string, name *string, secret string) (string, error) {
	if secret == "" {
		return "", errors.New("auth: empty JWT secret")
	}
	now := time.Now().Unix()
	claims := Claims{
		Sub:   sub,
		Email: email,
		Name:  name,
		Iat:   now,
		Exp:   now + int64(JWTExpiry/time.Second),
	}

	headerJSON, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("encode claims: %w", err)
	}

	signingInput := b64url(headerJSON) + "." + b64url(payloadJSON)
	sig := mac([]byte(signingInput), []byte(secret))
	return signingInput + "." + b64url(sig), nil
}

// VerifyJWT returns the decoded claims if `token` is a valid, unexpired
// HS256 JWT signed with `secret`.
func VerifyJWT(token, secret string) (*Claims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, errors.New("auth: malformed token")
	}
	headerRaw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("auth: bad header b64")
	}
	var header struct {
		Alg string `json:"alg"`
		Typ string `json:"typ"`
	}
	if err := json.Unmarshal(headerRaw, &header); err != nil {
		return nil, errors.New("auth: bad header json")
	}
	if header.Alg != "HS256" || header.Typ != "JWT" {
		return nil, errors.New("auth: unsupported alg")
	}

	signingInput := parts[0] + "." + parts[1]
	expected := mac([]byte(signingInput), []byte(secret))
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, errors.New("auth: bad signature b64")
	}
	if !hmac.Equal(expected, sig) {
		return nil, errors.New("auth: signature mismatch")
	}

	payloadRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("auth: bad payload b64")
	}
	var claims Claims
	if err := json.Unmarshal(payloadRaw, &claims); err != nil {
		return nil, errors.New("auth: bad payload json")
	}
	if claims.Exp < time.Now().Unix() {
		return nil, errors.New("auth: expired")
	}
	return &claims, nil
}

func b64url(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func mac(message, secret []byte) []byte {
	h := hmac.New(sha256.New, secret)
	h.Write(message)
	return h.Sum(nil)
}
