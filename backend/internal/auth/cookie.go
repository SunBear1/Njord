package auth

import (
	"fmt"
	"net/http"
	"strings"
)

const (
	cookieName    = "njord_auth"
	cookieMaxAge  = 7 * 24 * 60 * 60 // 7d in seconds
	cookieBaseFmt = "%s=%s; Path=/; Max-Age=%d; HttpOnly; SameSite=Lax"
)

// SetAuthCookie returns a Set-Cookie value containing `token`.
//
// secure=true sets the Secure attribute (must be false when serving over
// plain HTTP on njord.localhost during local development).
func SetAuthCookie(token string, secure bool) string {
	v := fmt.Sprintf(cookieBaseFmt, cookieName, token, cookieMaxAge)
	if secure {
		v += "; Secure"
	}
	return v
}

// ClearAuthCookie returns a Set-Cookie value that immediately expires the
// auth cookie.
func ClearAuthCookie(secure bool) string {
	v := fmt.Sprintf(cookieBaseFmt, cookieName, "", 0)
	if secure {
		v += "; Secure"
	}
	return v
}

// GetAuthCookie extracts the JWT token from the request's Cookie header.
// Returns "" if the cookie is absent.
func GetAuthCookie(r *http.Request) string {
	header := r.Header.Get("Cookie")
	if header == "" {
		return ""
	}
	for _, raw := range strings.Split(header, ";") {
		part := strings.TrimSpace(raw)
		if strings.HasPrefix(part, cookieName+"=") {
			return part[len(cookieName)+1:]
		}
	}
	return ""
}

// IsSecureRequest reports whether the request arrived over TLS.
//
// Hits behind a TLS-terminating reverse proxy must set X-Forwarded-Proto;
// we honour it so Set-Cookie carries the Secure attribute correctly.
func IsSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	return false
}
