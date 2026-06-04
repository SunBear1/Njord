package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestJWTRoundTrip(t *testing.T) {
	tok, err := SignJWT("u1", "a@b.com", strPtr("Alice"), "secret")
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if strings.Count(tok, ".") != 2 {
		t.Fatalf("expected 3-part JWT, got %q", tok)
	}
	claims, err := VerifyJWT(tok, "secret")
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.Sub != "u1" || claims.Email != "a@b.com" || claims.Name == nil || *claims.Name != "Alice" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
	if claims.Exp <= time.Now().Unix() {
		t.Fatalf("exp not in future")
	}
}

func TestJWTWrongSecret(t *testing.T) {
	tok, _ := SignJWT("u", "a@b.com", nil, "secret")
	if _, err := VerifyJWT(tok, "other"); err == nil {
		t.Fatal("expected verification failure with wrong secret")
	}
}

func TestJWTRejectsNone(t *testing.T) {
	// Hand-crafted alg=none token, which must be rejected even though the
	// signature segment is empty.
	parts := []string{
		base64URL([]byte(`{"alg":"none","typ":"JWT"}`)),
		base64URL([]byte(`{"sub":"x","exp":9999999999}`)),
		"",
	}
	tok := strings.Join(parts, ".")
	if _, err := VerifyJWT(tok, "secret"); err == nil {
		t.Fatal("alg=none must be rejected")
	}
}

func TestPasswordHashVerify(t *testing.T) {
	h, err := HashPassword("hunter22")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !VerifyPassword("hunter22", h) {
		t.Fatal("verify true negative")
	}
	if VerifyPassword("wrong", h) {
		t.Fatal("wrong password verified")
	}
}

func TestPasswordTooLongRejected(t *testing.T) {
	long := strings.Repeat("a", 73)
	if _, err := HashPassword(long); err == nil {
		t.Fatal("expected error for >72 bytes")
	}
}

func TestCookieRoundTrip(t *testing.T) {
	got := SetAuthCookie("tok", false)
	if !strings.Contains(got, "njord_auth=tok") || !strings.Contains(got, "HttpOnly") {
		t.Fatalf("missing flags: %q", got)
	}
	if strings.Contains(got, "Secure") {
		t.Fatal("Secure must be off when secure=false")
	}
	got = SetAuthCookie("tok", true)
	if !strings.Contains(got, "Secure") {
		t.Fatal("Secure missing when secure=true")
	}

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Cookie", "other=x; njord_auth=mytok; extra=y")
	if v := GetAuthCookie(req); v != "mytok" {
		t.Fatalf("got %q", v)
	}
}

func TestIsSecureRequest(t *testing.T) {
	req := httptest.NewRequest("GET", "http://x/", nil)
	if IsSecureRequest(req) {
		t.Fatal("plain http should not be secure")
	}
	req.Header.Set("X-Forwarded-Proto", "https")
	if !IsSecureRequest(req) {
		t.Fatal("X-Forwarded-Proto=https should signal secure")
	}
}

func TestToPublicUser(t *testing.T) {
	hash := "abc"
	name := "Bob"
	u := &User{ID: "1", Email: "b@x", PasswordHash: &hash, Name: &name}
	pu := toPublicUser(u)
	if !pu.HasPassword || len(pu.LinkedProviders) != 0 || *pu.Name != "Bob" {
		t.Fatalf("unexpected: %#v", pu)
	}
}

func TestRegisterValidation(t *testing.T) {
	h := &Handlers{jwtSecret: "s"}
	cases := []struct {
		body string
		code int
	}{
		{`{"email":"","password":"longenough"}`, http.StatusBadRequest},
		{`{"email":"not-an-email","password":"longenough"}`, http.StatusBadRequest},
		{`{"email":"a@b.com","password":"short"}`, http.StatusBadRequest},
		{`{"email":"a@b.com","password":"` + strings.Repeat("x", 80) + `"}`, http.StatusBadRequest},
		{`not-json`, http.StatusBadRequest},
	}
	for _, c := range cases {
		req := httptest.NewRequest("POST", "/api/v1/auth/register", strings.NewReader(c.body))
		w := httptest.NewRecorder()
		h.Register_(w, req)
		if w.Code != c.code {
			t.Errorf("body %q: got %d want %d", c.body, w.Code, c.code)
		}
	}
}

func TestMeRequiresCookie(t *testing.T) {
	h := &Handlers{jwtSecret: "s"}
	req := httptest.NewRequest("GET", "/api/v1/auth/me", nil)
	w := httptest.NewRecorder()
	h.Me(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", w.Code)
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	h := &Handlers{}
	req := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
	w := httptest.NewRecorder()
	h.Logout(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d", w.Code)
	}
	set := w.Header().Get("Set-Cookie")
	if !strings.Contains(set, "njord_auth=;") || !strings.Contains(set, "Max-Age=0") {
		t.Fatalf("expected cleared cookie, got %q", set)
	}
}

func strPtr(s string) *string { return &s }

// Tiny base64url that doesn't depend on the package-private b64url.
func base64URL(b []byte) string { return b64url(b) }
