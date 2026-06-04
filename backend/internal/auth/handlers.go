package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handlers wires the HTTP handlers for /api/v1/auth/*. Construct one via
// NewHandlers in cmd/server and call Register to mount on a *http.ServeMux.
type Handlers struct {
	pool      *pgxpool.Pool
	jwtSecret string
}

// NewHandlers constructs Handlers.
func NewHandlers(pool *pgxpool.Pool, jwtSecret string) *Handlers {
	return &Handlers{pool: pool, jwtSecret: jwtSecret}
}

// Register attaches all six auth routes to mux.
func (h *Handlers) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/auth/register", h.Register_)
	mux.HandleFunc("POST /api/v1/auth/login", h.Login)
	mux.HandleFunc("POST /api/v1/auth/logout", h.Logout)
	mux.HandleFunc("GET /api/v1/auth/me", h.Me)
	mux.HandleFunc("POST /api/v1/auth/change-password", h.ChangePassword)
	mux.HandleFunc("POST /api/v1/auth/delete-account", h.DeleteAccount)
}

// publicUser is the response shape the frontend expects.
type publicUser struct {
	ID              string   `json:"id"`
	Email           string   `json:"email"`
	Name            *string  `json:"name"`
	HasPassword     bool     `json:"hasPassword"`
	LinkedProviders []string `json:"linkedProviders"`
}

func toPublicUser(u *User) publicUser {
	return publicUser{
		ID:              u.ID,
		Email:           u.Email,
		Name:            u.Name,
		HasPassword:     u.PasswordHash != nil,
		LinkedProviders: []string{}, // OAuth deferred to Epic 99.
	}
}

// --- error envelope -------------------------------------------------------

type authErrEnvelope struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func authError(w http.ResponseWriter, code, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(authErrEnvelope{Error: message, Code: code})
}

func authJSON(w http.ResponseWriter, v any, status int, setCookie string) {
	w.Header().Set("Content-Type", "application/json")
	if setCookie != "" {
		w.Header().Set("Set-Cookie", setCookie)
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// --- handlers -------------------------------------------------------------

var emailRE = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

const (
	minPasswordLen = 8
	maxPasswordLen = 72 // bcrypt's hard limit; tighter than the TS impl (128) but safer.
	maxNameLen     = 100
	maxEmailLen    = 254
)

type registerReq struct {
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Name     *string `json:"name"`
}

// Register_ — POST /api/v1/auth/register. The trailing underscore avoids
// the method-name collision with the (h *Handlers) Register(mux *...) router.
func (h *Handlers) Register_(w http.ResponseWriter, r *http.Request) {
	var body registerReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		authError(w, "INVALID_INPUT", "Nieprawidłowe dane wejściowe.", http.StatusBadRequest)
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || !emailRE.MatchString(email) {
		authError(w, "INVALID_EMAIL", "Podaj prawidłowy adres email.", http.StatusBadRequest)
		return
	}
	if len(email) > maxEmailLen {
		authError(w, "INVALID_EMAIL", "Adres email jest zbyt długi.", http.StatusBadRequest)
		return
	}
	if len(body.Password) < minPasswordLen {
		authError(w, "WEAK_PASSWORD", "Hasło musi mieć co najmniej 8 znaków.", http.StatusBadRequest)
		return
	}
	if len(body.Password) > maxPasswordLen {
		authError(w, "WEAK_PASSWORD", "Hasło nie może przekraczać 72 znaków.", http.StatusBadRequest)
		return
	}
	if body.Name != nil && len(*body.Name) > maxNameLen {
		authError(w, "INVALID_INPUT", "Nazwa nie może przekraczać 100 znaków.", http.StatusBadRequest)
		return
	}

	hash, err := HashPassword(body.Password)
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}

	id, err := CreateUser(r.Context(), h.pool, email, hash, body.Name)
	if errors.Is(err, ErrUserExists) {
		authError(w, "EMAIL_EXISTS", "Konto z tym adresem email już istnieje.", http.StatusConflict)
		return
	}
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}

	token, err := SignJWT(id, email, body.Name, h.jwtSecret)
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}

	user := &User{ID: id, Email: email, PasswordHash: &hash, Name: body.Name}
	authJSON(w, toPublicUser(user), http.StatusCreated, SetAuthCookie(token, IsSecureRequest(r)))
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Login — POST /api/v1/auth/login.
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var body loginReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		authError(w, "INVALID_INPUT", "Nieprawidłowe dane wejściowe.", http.StatusBadRequest)
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		authError(w, "INVALID_INPUT", "Email i hasło są wymagane.", http.StatusBadRequest)
		return
	}
	if len(body.Password) > maxPasswordLen {
		authError(w, "INVALID_CREDENTIALS", "Nieprawidłowy email lub hasło.", http.StatusUnauthorized)
		return
	}

	user, err := GetUserByEmail(r.Context(), h.pool, email)
	if errors.Is(err, ErrUserNotFound) || (user != nil && user.PasswordHash == nil) {
		authError(w, "INVALID_CREDENTIALS", "Nieprawidłowy email lub hasło.", http.StatusUnauthorized)
		return
	}
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	if !VerifyPassword(body.Password, *user.PasswordHash) {
		authError(w, "INVALID_CREDENTIALS", "Nieprawidłowy email lub hasło.", http.StatusUnauthorized)
		return
	}

	token, err := SignJWT(user.ID, user.Email, user.Name, h.jwtSecret)
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	authJSON(w, toPublicUser(user), http.StatusOK, SetAuthCookie(token, IsSecureRequest(r)))
}

// Logout — POST /api/v1/auth/logout.
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	authJSON(w, map[string]bool{"ok": true}, http.StatusOK, ClearAuthCookie(IsSecureRequest(r)))
}

// Me — GET /api/v1/auth/me.
func (h *Handlers) Me(w http.ResponseWriter, r *http.Request) {
	claims, err := h.authenticated(r)
	if err != nil {
		authError(w, "NOT_AUTHENTICATED", err.Error(), http.StatusUnauthorized)
		return
	}
	user, err := GetUserByID(r.Context(), h.pool, claims.Sub)
	if errors.Is(err, ErrUserNotFound) {
		authError(w, "NOT_AUTHENTICATED", "Konto nie istnieje.", http.StatusUnauthorized)
		return
	}
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	authJSON(w, toPublicUser(user), http.StatusOK, "")
}

type changePasswordReq struct {
	CurrentPassword *string `json:"currentPassword"`
	NewPassword     string  `json:"newPassword"`
}

// ChangePassword — POST /api/v1/auth/change-password.
func (h *Handlers) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims, err := h.authenticated(r)
	if err != nil {
		authError(w, "NOT_AUTHENTICATED", err.Error(), http.StatusUnauthorized)
		return
	}
	var body changePasswordReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		authError(w, "INVALID_INPUT", "Nieprawidłowe dane wejściowe.", http.StatusBadRequest)
		return
	}
	if len(body.NewPassword) < minPasswordLen {
		authError(w, "WEAK_PASSWORD", "Nowe hasło musi mieć co najmniej 8 znaków.", http.StatusBadRequest)
		return
	}
	if len(body.NewPassword) > maxPasswordLen {
		authError(w, "WEAK_PASSWORD", "Hasło nie może przekraczać 72 znaków.", http.StatusBadRequest)
		return
	}
	user, err := GetUserByID(r.Context(), h.pool, claims.Sub)
	if errors.Is(err, ErrUserNotFound) {
		authError(w, "NOT_FOUND", "Konto nie istnieje.", http.StatusNotFound)
		return
	}
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	if user.PasswordHash != nil {
		if body.CurrentPassword == nil || *body.CurrentPassword == "" {
			authError(w, "INVALID_INPUT", "Podaj aktualne hasło.", http.StatusBadRequest)
			return
		}
		if !VerifyPassword(*body.CurrentPassword, *user.PasswordHash) {
			authError(w, "WRONG_PASSWORD", "Aktualne hasło jest nieprawidłowe.", http.StatusForbidden)
			return
		}
	}
	newHash, err := HashPassword(body.NewPassword)
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	if err := UpdatePassword(r.Context(), h.pool, user.ID, newHash); err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	authJSON(w, map[string]bool{"ok": true}, http.StatusOK, "")
}

type deleteAccountReq struct {
	Password *string `json:"password"`
}

// DeleteAccount — POST /api/v1/auth/delete-account.
func (h *Handlers) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	claims, err := h.authenticated(r)
	if err != nil {
		authError(w, "NOT_AUTHENTICATED", err.Error(), http.StatusUnauthorized)
		return
	}
	var body deleteAccountReq
	_ = json.NewDecoder(r.Body).Decode(&body) // optional body
	user, err := GetUserByID(r.Context(), h.pool, claims.Sub)
	if errors.Is(err, ErrUserNotFound) {
		authError(w, "NOT_FOUND", "Konto nie istnieje.", http.StatusNotFound)
		return
	}
	if err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	if user.PasswordHash != nil {
		if body.Password == nil || *body.Password == "" {
			authError(w, "INVALID_INPUT", "Podaj hasło, aby potwierdzić usunięcie konta.", http.StatusBadRequest)
			return
		}
		if !VerifyPassword(*body.Password, *user.PasswordHash) {
			authError(w, "WRONG_PASSWORD", "Hasło jest nieprawidłowe.", http.StatusForbidden)
			return
		}
	}
	if err := DeleteUser(r.Context(), h.pool, user.ID); err != nil {
		authError(w, "INTERNAL_ERROR", err.Error(), http.StatusInternalServerError)
		return
	}
	authJSON(w, map[string]bool{"ok": true}, http.StatusOK, ClearAuthCookie(IsSecureRequest(r)))
}

// authenticated parses + verifies the JWT cookie. Returned errors carry
// Polish messages that mirror the existing TS handlers.
func (h *Handlers) authenticated(r *http.Request) (*Claims, error) {
	token := GetAuthCookie(r)
	if token == "" {
		return nil, errors.New("Nie jesteś zalogowany.")
	}
	claims, err := VerifyJWT(token, h.jwtSecret)
	if err != nil {
		return nil, errors.New("Sesja wygasła. Zaloguj się ponownie.")
	}
	return claims, nil
}
