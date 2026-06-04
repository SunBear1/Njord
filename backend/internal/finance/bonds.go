package finance

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// BondsHandler returns GET /api/v1/finance/bonds.
//
// Reads the static bonds preset table seeded at startup (see internal/seed).
// Supports two optional filters: `type` (prefix on id, e.g. OTS, TOS) and
// `is_family` (boolean as "true"|"false").
func BondsHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		typ := r.URL.Query().Get("type")
		isFamilyParam := r.URL.Query().Get("is_family")

		var isFamily *bool
		if isFamilyParam != "" {
			switch isFamilyParam {
			case "true":
				v := true
				isFamily = &v
			case "false":
				v := false
				isFamily = &v
			default:
				writeError(w, http.StatusBadRequest, "BAD_REQUEST", `is_family must be "true" or "false"`, "")
				return
			}
		}

		bonds, lastUpdated, err := queryBonds(r.Context(), pool, typ, isFamily)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
			return
		}

		body := bondsResponse{
			Data: bonds,
			Meta: apiMeta{Source: "obligacjeskarbowe.pl", LastUpdatedAt: lastUpdated},
		}
		writePayload(w, body, "max-age=86400")
	}
}

type bond struct {
	ID                        string   `json:"id"`
	NamePL                    string   `json:"name_pl"`
	MaturityMonths            int      `json:"maturity_months"`
	RateType                  string   `json:"rate_type"`
	FirstYearRatePct          *float64 `json:"first_year_rate_pct"`
	MarginPct                 *float64 `json:"margin_pct"`
	CouponFrequency           int      `json:"coupon_frequency"`
	EarlyRedemptionAllowed    bool     `json:"early_redemption_allowed"`
	EarlyRedemptionPenaltyPct *float64 `json:"early_redemption_penalty_pct"`
	IsFamily                  bool     `json:"is_family"`
	UpdatedAt                 string   `json:"updated_at"`
}

type apiMeta struct {
	Source        string `json:"source"`
	LastUpdatedAt string `json:"last_updated_at,omitempty"`
}

type bondsResponse struct {
	Data []bond  `json:"data"`
	Meta apiMeta `json:"_meta"`
}

func queryBonds(ctx context.Context, pool *pgxpool.Pool, typ string, isFamily *bool) ([]bond, string, error) {
	sql := `SELECT id, name_pl, maturity_months, rate_type, first_year_rate_pct,
                  margin_pct, coupon_frequency, early_redemption_allowed,
                  early_redemption_penalty_pct, is_family,
                  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
              FROM bonds`
	var (
		args   []any
		clause string
	)
	if typ != "" {
		args = append(args, typ+"%")
		clause = " WHERE id LIKE $1"
	}
	if isFamily != nil {
		args = append(args, *isFamily)
		if clause == "" {
			clause = " WHERE is_family = $1"
		} else {
			clause += " AND is_family = $2"
		}
	}
	sql += clause + " ORDER BY id"

	rows, err := pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	out := make([]bond, 0, 8)
	last := ""
	for rows.Next() {
		var b bond
		if err := rows.Scan(
			&b.ID, &b.NamePL, &b.MaturityMonths, &b.RateType, &b.FirstYearRatePct,
			&b.MarginPct, &b.CouponFrequency, &b.EarlyRedemptionAllowed,
			&b.EarlyRedemptionPenaltyPct, &b.IsFamily, &b.UpdatedAt,
		); err != nil {
			return nil, "", err
		}
		out = append(out, b)
		if b.UpdatedAt > last {
			last = b.UpdatedAt
		}
	}
	return out, last, rows.Err()
}

func writePayload(w http.ResponseWriter, body any, cacheControl string) {
	w.Header().Set("Content-Type", "application/json")
	if cacheControl != "" {
		w.Header().Set("Cache-Control", cacheControl)
	}
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(body)
}
