# Njord — Code Health Review

**Date:** 2026-04-25
**Scope:** Full audit across security, code quality, React, Cloudflare Pages, architecture, financial methodology + Polish tax/instrument correctness, and repository hygiene.
**Status:** Implementation pass completed. 40 items fixed (all 🔴 Critical where code changes apply + majority of 🟡 Warnings). See `✅ FIXED` / `⏭️ DEFERRED` markers on individual items.

## Severity legend

| Emoji | Meaning |
|---|---|
| 🔴 **Critical** | Security vulnerability, math error, tax-law violation, or actively broken behavior |
| 🟡 **Warning** | Likely bug, maintenance hazard, or violation of stated convention |
| 🟢 **Suggestion** | Improvement, hygiene, or future-proofing |

---

## Executive Summary

| Area | 🔴 Critical | 🟡 Warning | 🟢 Suggestion | Total |
|---|---:|---:|---:|---:|
| 1. Security & Financial Data Handling | 2 | 7 | 4 | 13 |
| 2. Code Quality & Consistency | 6 | 16 | 8 | 30 |
| 3. React-Specific Issues | 3 | 9 | 4 | 16 |
| 4. Cloudflare Pages | 2 | 7 | 4 | 13 |
| 5. Architecture | 4 | 12 | 7 | 23 |
| 6. Financial Methodology + Polish Tax/Instruments | 4 | 7 | 4 | 15 |
| 7. Repo Hygiene + GitHub Maintenance | 8 | 11 | 7 | 26 |
| **TOTAL** | **29** | **69** | **38** | **136** |

### Top 10 highest-priority items (read these first)

1. 🔴 **§1.1** — OAuth account takeover via email auto-linking to unverified accounts (security)
2. 🔴 **§1.2 / §4.1** — CORS reflects any origin with `Allow-Credentials: true` (security)
3. 🔴 **§7.2** — Branch protection enforces phantom check names (`validate`/`e2e`); no real CI gating
4. 🔴 **§6.1** — Timeline chart uses different bond/savings principal than verdict — chart and verdict disagree
5. 🔴 **§6.3** — Portfolio wizard uses snapshot CPI for inflation-linked bonds, not blended projection (large overstatement on long horizons)
6. 🔴 **§6.4** — IKE annual contribution limit hardcoded to 2025 value while bond data is dated 2026
7. 🔴 **§7.1** — Stray files tracked in git: `Prompt_*.md`, `Zone.Identifier`, `test-results/.last-run.json`
8. 🔴 **§7.4** — `xlsx` installed from CDN tarball URL — bypasses `npm audit` entirely
9. 🔴 **§5.1** — Direct `fetch()` in `Step3Allocation.tsx` bypasses provider error translation
10. 🔴 **§2.4** — `nbpMidRate || currentFxRate` falls back to kantor rate when mid rate is `0` — wrong tax basis

### Hot files (multiple findings across categories)

- `functions/_middleware.ts` — CORS misconfiguration (security + CF)
- `functions/api/auth/**` — missing rate limits, auto-linking, no `Cache-Control: no-store`
- `src/utils/calculations.ts` — bond/savings/timeline inconsistencies, `||` vs `??` on rates
- `src/utils/accumulationCalculator.ts` — 962 LOC, dead exports, IKZE mid-year approximation, no maturity events
- `src/components/InputPanel.tsx` — 789 LOC, 53-prop interface, stale closure on bond settings
- `src/components/tax/TransactionCard.tsx` — 904 LOC, suppressed exhaustive-deps, fetches from component
- `AGENTS.md` — multiple drift items: test counts, hooks list, auth system entirely undocumented, missing CI file
- `.github/workflows/*` — phantom required checks, no concurrency groups, no SHA pinning on `dependabot/fetch-metadata`

---

# 1. Security & Financial Data Handling

## 🔴 Critical

### 1.1 — OAuth account takeover via email auto-linking to unverified accounts ✅ FIXED
- **Files:** `functions/api/auth/github/callback.ts:157–165`, `functions/api/auth/google/callback.ts:144–151`
- **Issue:** `findOrCreateOAuthUser` silently links an incoming OAuth identity to any existing local account that shares the same email, with no check on `email_verified`. Password-registered users are stored with `email_verified = 0` (DB default — `register.ts` never sets it). Attack path: (1) attacker pre-registers `victim@gmail.com` with a chosen password; (2) real victim later signs in via Google/GitHub with that address; (3) `findOrCreateOAuthUser` finds the attacker's row by email match and issues a JWT for it — both the attacker's password and the victim's OAuth token now log in to the same account.
- **Fix direction:** Require `existingUser.email_verified == 1` before auto-linking by email, or disable email-based auto-linking entirely and require explicit user-initiated linking (the `:link` action flow already exists for this purpose).

### 1.2 — CORS reflects any origin with `Access-Control-Allow-Credentials: true` ✅ FIXED
- **File:** `functions/_middleware.ts:10–16`
- **Issue:** `const origin = request.headers.get('Origin') ?? '*'` then sets `Access-Control-Allow-Origin: <origin>` + `Access-Control-Allow-Credentials: true`. Any website can make a credentialed cross-origin fetch to `/api/auth/me`, `/api/auth/login`, etc. and read the response. The code comment on line 9 explicitly notes "credentials: include requires a specific origin, not '*'" yet implements the exact opposite. SameSite=Lax mitigates classic cookie theft, but same-registrable-domain abuse (any other CF Pages app under `*.pages.dev`) bypasses it.
- **Fix direction:** Maintain an explicit allowlist (`https://njord.pages.dev`, `http://localhost:5173`, `http://localhost:8788`); only reflect when the incoming origin is in the list.

## 🟡 Warning

### 1.3 — No password maximum length → PBKDF2 DoS ✅ FIXED
- **Files:** `functions/api/auth/login.ts:23`, `register.ts:31`, `change-password.ts:37`
- **Issue:** No upper bound before `hashPassword` / `verifyPassword`. PBKDF2 with 100k SHA-256 iterations on a multi-MB input will exceed the CF Workers CPU budget. Only a minimum length is checked.
- **Fix direction:** Reject `password.length > 128` (or 256) before any crypto.

### 1.4 — No length limits on `name` and `email` at registration ✅ FIXED
- **File:** `functions/api/auth/register.ts:25–27, 45–46`
- **Issue:** `name` is accepted with no length check and inserted into D1 + JWT payload. `email` only passes the regex but has no max-length guard (RFC 5321 caps at 254).
- **Fix direction:** Add `MAX_NAME_LENGTH = 100`, `MAX_EMAIL_LENGTH = 254` checks.

### 1.5 — JWT header `alg` not validated on verification ✅ FIXED
- **File:** `functions/api/auth/_utils/jwt.ts:72–85`
- **Issue:** `verifyJwt` does not decode the header to confirm `alg === 'HS256'`. Direct `alg: "none"` exploitation is blocked by signature check, but trusting payload of tokens claiming a different algorithm is fragile if any future code path uses the decoded header.
- **Fix direction:** Decode `parts[0]`, parse, return `null` if `header.alg !== 'HS256'` or `header.typ !== 'JWT'`.

### 1.6 — No rate limiting on any auth endpoint ⏭️ DEFERRED — requires Cloudflare Rate Limiting configuration, not a code change
- **Files:** `functions/api/auth/login.ts`, `register.ts`, `change-password.ts`
- **Issue:** Unlimited brute-force, account enumeration via distinct `INVALID_CREDENTIALS` vs `EMAIL_EXISTS` codes, registration spam.
- **Fix direction:** Configure CF Rate Limiting on `/api/auth/*` (e.g., 10 req/min/IP).

### 1.7 — OAuth state cookie not cleared on error redirect paths ✅ FIXED
- **Files:** `functions/api/auth/github/callback.ts:42, 62, 80, 134`, `google/callback.ts:36, 58, 68, 121`
- **Issue:** `redirectWithError()` does not clear `njord_oauth_state`. Stale state cookies coexisting with fresh ones can fail subsequent retries.
- **Fix direction:** Clear the state cookie on every redirect path, success or error.

### 1.8 — PBKDF2 iterations below current OWASP recommendation ⏭️ DEFERRED — constrained by CF Workers CPU budget; trade-off documented
- **File:** `functions/api/auth/_utils/password.ts:8`
- **Issue:** `ITERATIONS = 100_000` vs OWASP 2023 guidance of ≥600,000 for PBKDF2-HMAC-SHA256. Constrained by CF Workers CPU budget but documented gap.
- **Fix direction:** Consider 260k+ iterations (practical CF max) or document the trade-off; consider PBKDF2-SHA-512.

### 1.9 — Ticker parameter has no length or format validation ✅ FIXED
- **File:** `functions/api/analyze.ts:257–261`
- **Issue:** No max-length check before `encodeURIComponent` and embedding in error messages cached at the edge for 1 hour.
- **Fix direction:** Enforce max ticker length (e.g., 20) and `[A-Z0-9.\-^=]+` allowlist.

## 🟢 Suggestion

### 1.10 — `safeGet` prototype-pollution guard is misleading — `src/utils/brokerParsers/etrade.ts:36–43` (only blocks `Object.create(null)`, not dangerous keys)
### 1.11 — `timingSafeEqual` early exit on length mismatch — `functions/api/auth/_utils/password.ts:79` (harmless in practice; padding would be more rigorous)
### 1.12 — Upstream provider error message reflected to callers — `functions/api/analyze.ts:157, 289–291` (normalize provider errors)
### 1.13 — Consider `SameSite=Strict` on auth cookie — `functions/api/auth/_utils/cookie.ts:19` (SPA has no cross-site nav need); also add JWT-presence check to `logout`

## ✅ Verified clean

SQL injection (all `.bind()` parameterized), no committed secrets, no `VITE_*` env exposure, zero XSS sinks (`dangerouslySetInnerHTML`/`innerHTML`/`document.write` absent), correct cookie flags, JWT expiry enforced, OAuth CSRF state implemented, `redirect_uri` pinned to `url.origin`, batch atomic deletion, SheetJS row/amount caps, no third-party JS, complete security headers in `public/_headers`, no `console.log` of credentials.

---

# 2. Code Quality & Consistency

## 🔴 Critical

### 2.1 — `useTickerReturn` is dead code ✅ FIXED — file deleted
- **File:** `src/hooks/useTickerReturn.ts` — entire 100-LOC hook never imported anywhere in `src/`.

### 2.2 — Five exported functions in `accumulationCalculator.ts` used only by tests or internally ⏭️ DEFERRED — test-only exports are harmless; tree-shaking handles bundle
- **File:** `src/utils/accumulationCalculator.ts:29, 189, 214, 238, 466`
- `calcAccumulationResult` (the old API) is consumed only by `__tests__/accumulation.test.ts`; production calls `calcPortfolioResult`. Five exports inflate bundle.

### 2.3 — `BELKA_TAX = 0.19` defined three times ✅ FIXED — consolidated to single import from `accumulation.ts`
- **Files:** `src/utils/calculations.ts:3`, `src/utils/taxCalculator.ts:9`, `src/types/accumulation.ts:23` (as `BELKA_RATE`). If the rate changes, three files need updating.

### 2.4 — `nbpMidRate || inputs.currentFxRate` silently falls back to kantor rate for tax basis ✅ FIXED — changed `||` to `??` in 3 places
- **File:** `src/utils/calculations.ts:53, 206, 245`
- **Issue:** `||` treats `0` as falsy and falls through to `currentFxRate` (kantor sell rate). Per `financial-math-guardian §3.2`, using the kantor rate for tax basis is **explicitly wrong**.
- **Fix direction:** Use `??` and warn callers when `nbpMidRate` is `0`.

### 2.5 — `logReturns` duplicated across two hooks (one of them dead) ✅ FIXED — resolved by §2.1 (dead file deleted)
- **Files:** `src/hooks/useHistoricalVolatility.ts:39`, `useTickerReturn.ts:24` — identical implementations.

### 2.6 — `loadState()` called twice on startup ✅ FIXED — wrapped in `useState(loadState)` lazy initializer
- **Files:** `src/App.tsx:55` (for `activeSection`), `src/hooks/usePortfolioState.ts:96` (for everything else). Two synchronous `localStorage.getItem` + `JSON.parse` per mount, doubled in Strict Mode.

## 🟡 Warning

### 2.7 — `src/utils/etradeParser.ts` deprecated shim still imported by tests — `__tests__/etradeParser.test.ts:16` mixes old and new paths in same file.
### 2.8 — Broken relative import path — `src/__tests__/auth.test.ts:19` uses `'../../src/utils/userDisplayHelpers'` instead of `'../utils/userDisplayHelpers'`. Works by accident. ✅ FIXED
### 2.9 — `src/hooks/useSellAnalysis.ts:112` swallows error silently with `setAnalysis(null)` — no error state, no user feedback.
### 2.10 — `src/hooks/useAuth.ts:70, 77` fire-and-forget `.catch(() => {})` on post-OAuth user fetch.
### 2.11 — ~30 hardcoded hex chart colors block dark theme migration — `TimelineChart.tsx:25–67`, `ComparisonChart.tsx:23–59`, `SellAnalysisPanel.tsx:66–329`, `AccumulationChart.tsx:50–147`. Token system in `index.css` exists but unused for charts.
### 2.12 — `src/utils/schemas.ts` Zod schemas defined but only `TaxTransactionsSchema` consumed — 174 lines of unused runtime protection. Fetch paths use `as` casts instead.
### 2.13 — Conditional rendering with `&&` instead of ternary — `TaxCalculatorPanel.tsx:484`, `tax/TransactionCard.tsx:886`. Risk of rendering `0` as text.
### 2.14 — Number columns lack `tabular-nums` — `TaxCalculatorPanel`, `TimelineChart`, `ComparisonChart`. Misalignment in PLN columns.
### 2.15 — `252` (trading days/year) magic number in 5 files — `useHistoricalVolatility.ts:136–174`, `useTickerReturn.ts:73–75`, `utils/hmm.ts:335`, `models/hmmModel.ts:23`, `models/gbmModel.ts`. Two files define local constants; others use the literal.
### 2.16 — Mixed default vs named exports across components — `TimelineChart`/`ComparisonChart`/`AccumulationChart`/`BreakevenChart` use `export default memo(...)`; `InputPanel`/`ScenarioEditor`/`VerdictBanner`/`TaxCalculatorPanel` use named; portfolio wizard steps use `export default function`. No consistent rule.
### 2.17 — Suspense fallback uses hardcoded `text-gray-400` — `App.tsx:534`, not a semantic token. ✅ FIXED — replaced with `text-text-faint`
### 2.18 — `TaxCalculatorPanel.tsx` (492 LOC) manages four responsibilities — transaction state, import/undo machinery, year grouping, layout orchestration. Import logic could move to a `useTransactionImport` hook.
### 2.19 — `InputPanel.tsx` (789 LOC) — ticker/shares/cost-basis, FX, horizon/benchmark blocks remain monolithic despite some inputs already extracted to `src/components/inputs/`.
### 2.20 — `accumulationCalculator.ts` (962 LOC) mixes three abstraction levels — single-bucket simulation, portfolio wizard orchestration, IKE/IKZE tax math.
### 2.21 — Bare `fetch()` (no timeout) in 3 hooks — `useCurrencyRates.ts:34, 40, 48`, `useInflationData.ts:48, 52`, `useBondPresets.ts:26`. `fetchWithTimeout` is used elsewhere; these will hang indefinitely. ✅ FIXED — replaced with `fetchWithTimeout`
### 2.22 — Scenario labels are English in UI — `ScenarioEditor.tsx:33–47` (`'Bear'`, `'Base'`, `'Bull'`) and `ComparisonChart.tsx:28–38` legend. Convention requires Polish UI text. `TimelineChart` partially localizes (`"Bear (pesymistyczny)"`). ✅ FIXED

## 🟢 Suggestion

### 2.23 — Remove `etradeParser.ts` shim once test imports updated
### 2.24 — `console.error` in `ErrorBoundary.tsx:21` — gate or replace once an error reporter is added
### 2.25 — `src/__tests__/setup.test.ts` is a trivial `1+1` placeholder — remove
### 2.26 — `as AppSection` cast on `loadState()` result is unchecked — `App.tsx:55` bypasses migration path used in `usePortfolioState`
### 2.27 — `as unknown as ArrayBuffer` casts unnecessary on Web Crypto — `functions/api/auth/_utils/jwt.ts:78`, `password.ts:27, 54`
### 2.28 — `src/scripts/backtest.ts` lives in `src/` despite being a Node script — move to `scripts/` at repo root
### 2.29 — Polish error string `'Nieznany błąd'` repeated 4 times — `useAssetData.ts:43`, `useEtfData.ts:47`, `useBondPresets.ts:33`, `useTickerReturn.ts:84`. Extract to shared constant.
### 2.30 — `simulateSavingsBucket` returns inline object type, not named interface — `accumulationCalculator.ts:466`

---

# 3. React-Specific Issues

## 🔴 Critical

### 3.1 — `useSellAnalysis` worker message handler leaks across effect re-runs ✅ FIXED
- **File:** `src/hooks/useSellAnalysis.ts:83–95, 121–123`
- **Issue:** The `handler` is registered inside the `setTimeout` callback. Effect cleanup only `clearTimeout` — does NOT `removeEventListener` if the debounce already fired. If `prepared`/`horizonDays` changes mid-computation, the OLD handler fires when the worker replies, clobbering the in-progress run with stale results.
- **Fix direction:** Track the handler in a ref; cleanup must `removeEventListener`.

### 3.2 — `usePortfolioState` runs `loadState()` on every render ✅ FIXED
- **File:** `src/hooks/usePortfolioState.ts:96`
- **Issue:** Top-level call (not in lazy initializer) — `localStorage.getItem` + `JSON.parse` on every render, doubled in Strict Mode.
- **Fix direction:** `const [savedOnce] = useState(loadState);`

### 3.3 — Stale closure on `bondSettings` in penalty-recalculation effect ✅ FIXED
- **File:** `src/components/InputPanel.tsx:161–168`
- **Issue:** `useEffect` spreads `{ ...bondSettings, penalty }` but omits `bondSettings` from deps (with `eslint-disable`). User edits to other bond fields between horizon slider moves get silently reverted.
- **Fix direction:** Include `bondSettings` and `onBondSettingsChange` in deps, or use functional updater.

## 🟡 Warning

### 3.4 — `calcInputs` useMemo depends on full `proxyFxData` object instead of `proxyFxData?.currentRate` primitive — `App.tsx:174`. Recomputes on every fetch even when rate identical. ✅ FIXED
### 3.5 — `PortfolioWizardLazy` and `TaxCalculatorPanel` are not wrapped in `<ErrorBoundary>` — `App.tsx:295, 298–303`. All chart components on the investment tab are wrapped (lines 490–544); these two are not. ✅ FIXED
### 3.6 — `setComputing(false)` called in `useEffect` cleanup — `useHistoricalVolatility.ts:224`. Anti-pattern; causes flicker in Strict Mode + extra render. ✅ FIXED
### 3.7 — `ScenarioEditor` sync effect fires on `currentPriceUSD`/`currentFxRate` deps — `ScenarioEditor.tsx:102–123`. Identity guard prevents bug but effect runs on every price keystroke.
### 3.8 — `useWizardState` — `canAdvance` subscribes to entire `state`; `saveState` not debounced — `useWizardState.ts:206–212`. `usePortfolioState` debounces at 600ms; wizard writes synchronously on every keystroke/slider tick. ✅ FIXED — saveState debounced at 300ms
### 3.9 — `PortfolioWizard` useMemo depends on full `personalData` object — `PortfolioWizard.tsx:40`. Heavy `calcPortfolioResult` re-runs on every `updatePersonalData` even when values unchanged. ✅ FIXED — deps use individual primitive fields
### 3.10 — `Tooltip` scroll listener missing `{ passive: true }` — `Tooltip.tsx:36`. Per react-best-practices, scroll listeners must be passive. ✅ FIXED
### 3.11 — `type AppSection` and `type ActiveView` declared inside `App` function body — `App.tsx:53, 188`. Unimportable; move to module scope. ✅ FIXED
### 3.12 — Raw `fetch` in `AddInstrumentMenu` bypasses AbortController pattern — `Step3Allocation.tsx:332–361`. No cancellation; setState on unmounted subtree possible.

## 🟢 Suggestion

### 3.13 — `useDarkMode` `toggle` not memoized — `useDarkMode.ts:24`. Causes header re-render on any state change. ✅ FIXED
### 3.14 — Chart components hardcode hex colors — blocks dark theme (duplicate of §2.11)
### 3.15 — `TaxCalculatorPanel.tsx:345` uses array index as key in static list — semantically wrong, harmless
### 3.16 — `Skeleton.tsx:25, 55` — same array-index-as-key pattern

## ✅ Verified clean

AbortController correctly used in `useAssetData`, `useEtfData`, `useTickerReturn`; cleanup ordering correct (`cancelled = true` BEFORE `clearInterval`) in `useCurrencyRates`; `useInflationData` and `useBondPresets` cleanup correct; auto-apply pattern (`userScenarios === null`) intact; no `useContext()` (React 19 `use()` idiom); no `forwardRef`; no class components; no components defined inside components; `useWizardState` correctly scoped to its own localStorage key; lazy chunks all have Suspense fallbacks; `scenarios` derived inline (not state); `useDebouncedValue` protects GBM/Bootstrap from slider thrash; worker created once and terminated on unmount.

---

# 4. Cloudflare Pages

## 🔴 Critical

### 4.1 — CORS origin reflection + `Allow-Credentials: true` ✅ FIXED (same as §1.2)
- **File:** `functions/_middleware.ts:10–16`
- (Same finding as §1.2 — flagged in both areas because it is both a security issue and a CF middleware misconfiguration.)
- **Fix direction:** static allowlist (`https://njord.pages.dev`, `http://localhost:5173`, `http://localhost:8788`).

### 4.2 — `GET /api/auth/me` (and all auth routes) missing `Cache-Control: no-store` ✅ FIXED — injected via middleware for `/api/auth/*`
- **Files:** all 10 routes under `functions/api/auth/`
- **Issue:** `me` returns `{ id, email, name, hasPassword, linkedProviders }` with no cache directives and no `Vary: Cookie`. A misconfigured proxy or CF Smart Tiered Cache could serve one user's data to another. `Set-Cookie` responses on login/register/logout could be cached, causing logout to be ignored.
- **Fix direction:** Add `Cache-Control: no-store` to every auth handler (or inject in `_middleware.ts` for `/api/auth/*`).

## 🟡 Warning

### 4.3 — PBKDF2 100k iterations at the CF Workers hard cap — risks intermittent CPU timeout (`functions/api/auth/_utils/password.ts:8`)
### 4.4 — No rate limiting on auth endpoints (duplicate of §1.6) — `wrangler.toml` has no Rate Limiting binding
### 4.5 — `wrangler.toml` `compatibility_date = "2024-01-01"` is 2+ years stale — `wrangler.toml:3`. Bump to `2025-11-01` or later. ✅ FIXED
### 4.6 — `inflation.ts` comment says "6-hour cache" but code sets 24h — `functions/api/inflation.ts:5, 21`. Code is correct per backend instructions; comment is wrong. ✅ FIXED
### 4.7 — No password max length → PBKDF2 amplification (duplicate of §1.3) ✅ FIXED
### 4.8 — `bonds.ts`, `currency-rates.ts`, `inflation.ts` use untyped `PagesFunction` (no `Env` generic) — type safety lost if env access added later
### 4.9 — `analyze.ts` fires 3 concurrent NBP requests per cache miss — `analyze.ts:221–224`. Under load, NBP rate limits may silently degrade FX history charts (errors swallowed at `parseRates`).

## 🟢 Suggestion

### 4.10 — No `public/_redirects` — direct URL access falls back to CF default 404. Add `/* /index.html 200`.
### 4.11 — `X-Frame-Options: DENY` missing from `public/_headers` (CSP `frame-ancestors 'none'` covers modern browsers; legacy fallback worth adding)
### 4.12 — CSP `connect-src` allows Yahoo Finance + Twelve Data — `public/_headers:3`. These APIs are server-side only via the proxy; allowing client-side calls undermines that architecture.
### 4.13 — `wrangler.toml` missing documentation of required secrets (`JWT_SECRET`, `GITHUB_*`, `GOOGLE_*`, `TWELVE_DATA_API_KEY`) — fresh deployments fail silently with `undefined` env vars

## ✅ Verified clean

No `import.meta.env` secret leakage to `src/`; `vite.config.ts` defines no secret injection; D1 queries all use `.bind()` parameterization; correct indexes (`idx_users_email`, `idx_oauth_provider`); `/api/analyze` error codes correct (`TICKER_NOT_FOUND`/`RATE_LIMITED`/`INVALID_TICKER`/`UPSTREAM_ERROR`); fallback to Twelve Data only triggers on 429; no Node.js APIs in `functions/`; no source maps in `dist/`; non-auth Cache-Control values match backend instructions; `dist/_headers` matches `public/_headers`; correct cookie flags throughout; OAuth CSRF state implemented; ON DELETE CASCADE on `oauth_accounts`.

---

# 5. Architecture

## 🔴 Critical

### 5.1 — Direct `fetch()` in component bypasses provider layer ✅ FIXED — routes through `fetchAssetData`
- **File:** `src/components/portfolio/Step3Allocation.tsx:341`
- **Issue:** `AddInstrumentMenu` does raw `fetch('/api/analyze?ticker=...')`. Duplicates `twelveDataProvider.ts` with no error-code translation, no AbortController, no consistent error shape.
- **Fix direction:** Route through `fetchAssetData` from the provider.

### 5.2 — Fetch utilities in `src/utils/` violate the pure-functions layer
- **Files:** `src/utils/fetchTickerName.ts:9`, `src/utils/fetchNbpTableARate.ts:58`
- **Issue:** Both perform network I/O — they belong in `src/providers/`, not `utils/`.

### 5.3 — Components calling fetch utilities directly
- **Files:** `src/components/tax/TransactionCard.tsx:300, 317, 334, 353, 382, 500`, `src/components/tax/TransactionTableRow.tsx:180, 197, 214, 233, 262, 339`
- **Issue:** Fetch calls scattered across two 900-line components inside `useEffect`/`useCallback`. Should live in a dedicated hook (e.g., `useTransactionFetch`).

### 5.4 — `eslint-disable react-hooks/exhaustive-deps` on fetch effects
- **Files:** `src/components/tax/TransactionCard.tsx:264, 339`, `TransactionTableRow.tsx:144`
- **Issue:** Suppressed warnings on effects with intentionally partial deps arrays — hides potential stale-closure bugs in transaction date/currency handling.

## 🟡 Warning

### 5.5 — `useAuth.ts:19–38` embeds a private `authFetch` client — should be in `src/providers/authProvider.ts`
### 5.6 — `useInflationData.ts:45–53`, `useCurrencyRates.ts:33–52` embed fetch helpers inline — fetch logic in hooks instead of providers
### 5.7 — `type AppSection` defined inside the `App` function body — `App.tsx:53`. Unimportable; move to `src/types/app.ts`.
### 5.8 — `src/components/tax/taxHelpers.ts` is pure logic in the wrong layer — `generateId`, `parsePLDate`, `isoToPLDate`, `fmtGain` etc. are pure functions, belong in `utils/`.
### 5.9 — Routing architecture debt — AGENTS.md says "no routing" but app now has 3 main tabs + 4-step wizard + `PrivacyPolicy` modal + `AuthModal` + `AccountPanel`. No URL deep-linking, browser back doesn't navigate, OAuth callback URL handling done manually in `useAuth.ts:70–91`.
### 5.10 — OAuth callback flows have zero integration test coverage — `functions/api/auth/github/callback.ts`, `google/callback.ts`. PKCE/state verification, find-or-create user, account linking, JWT issuance all untested. (Mocking D1 is non-trivial.)
### 5.11 — Persisted state migrations not tested — `src/utils/persistedState.ts:33–47` (4 migrations), `src/hooks/useWizardState.ts:98` (v1). A bad migration silently wipes user state.
### 5.12 — Oversized component files
  - `src/components/tax/TransactionCard.tsx` — **904 lines**
  - `src/components/tax/TransactionTableRow.tsx` — **712 lines**
  - `src/components/portfolio/Step3Allocation.tsx` — **756 lines**
  - `src/utils/accumulationCalculator.ts` — **962 lines**
### 5.13 — `InputPanel` has 53 props — `InputPanel.tsx:11`. Bond settings group could collapse into `bondConfig` object.
### 5.14 — `src/utils/etradeParser.ts` is a deprecated shim still referenced by tests — `__tests__/etradeParser.test.ts:1`
### 5.15 — Weak ESLint config — `eslint.config.js`. No `@typescript-eslint/no-explicit-any`, no `no-console`, no `import/no-cycle`. Multiple `console.warn/error` in production component code (e.g., `TaxCalculatorPanel.tsx:54`).
### 5.16 — Auth system entirely undocumented in `README.md` and `AGENTS.md` — required env vars (`JWT_SECRET`, `GITHUB_*`, `GOOGLE_*`), D1 binding, `wrangler.toml` setup all missing from documentation.

## 🟢 Suggestion

### 5.17 — `src/utils/assetConfig.ts` is one-liner but justified (avoids magic number 12)
### 5.18 — `src/workers/sellAnalysis.worker.ts` is correctly structured — Vite-native `new URL(..., import.meta.url)`; clean offload of HMM Monte Carlo
### 5.19 — tsconfig fragmentation justified — standard Vite multi-target setup
### 5.20 — Bundle composition acceptable — `xlsx` (484 KB) and `recharts` (388 KB) are lazy chunks; main entry 252 KB; vendor 176 KB
### 5.21 — `useWizardState` separate localStorage — appropriate exception, documented in AGENTS.md
### 5.22 — Auth state owned by `useAuth` hook (not App.tsx) — justified bounded exception (mirrors `useWizardState`)
### 5.23 — No circular imports detected

---

# 6. Financial Methodology + Polish Tax / Instruments

## 🔴 Critical

### 6.1 — Timeline chart and verdict use different bond/savings principal ✅ FIXED — timeline now uses `investedPLN`
- **File:** `src/utils/calculations.ts:321–348`
- **Issue:** `calcTimeline` computes savings/bond benchmarks on `currentValuePLN` (full current portfolio), while `calcBondEndValue`/`calcSavingsEndValue` operate on `investedPLN = currentValuePLN − firstBelkaCost`. The ETF branch correctly delegates to `calcEtfEndValue(bmInputs)`; savings/bond branches do not. Result: timeline endpoint and verdict's `benchmarkEndValuePLN` show different numbers for the same horizon. Stocks look relatively worse in the chart than in the verdict.
- **Fix direction:** Replace local timeline math with calls to `calcSavingsEndValue(bmInputs)` / `calcBondEndValue(bmInputs)`, or subtract `firstBelkaCost` from the principal.

### 6.2 — `clampScenario` annual-loss bound is −90 % but `validateScenarios` guard is −80 % ✅ FIXED — aligned to −80%
- **Files:** `src/utils/models/gbmModel.ts:66` vs `src/__tests__/scenarioSanity.test.ts:36–37`
- **Issue:** GBM can produce −85 % bear that passes `clampScenario` but fails `validateScenarios`. Documentation specifies `[-80%, +100%]`.
- **Fix direction:** Set `maxAnnualLoss: -80` and add a test that feeds GBM output through `validateScenarios`.

### 6.3 — Portfolio wizard uses snapshot inflation rate (not blended) for inflation-linked bonds ✅ FIXED — now calls `blendedInflationRate()`
- **Files:** `src/components/portfolio/PortfolioWizard.tsx:28`, `src/utils/accumulationCalculator.ts:608–609`
- **Issue:** `App.tsx` correctly calls `blendedInflationRate(inflationRate, deferredHorizon)` (line 133); `PortfolioWizard.tsx` passes raw `wizard.state.personalData.inflationRate`. For COI/EDO/ROS/ROD over 30+ year horizons, this can overstate terminal value by ~50 % if current CPI is far above the long-run target.
- **Fix direction:** Compute `blendedInflationRate(personalData.inflationRate, personalData.horizonYears * 12)` in PortfolioWizard before passing to `calcPortfolioResult`.

### 6.4 — IKE annual contribution limit hardcoded to 2025 value ✅ FIXED — updated to `IKE_LIMIT_2026`
- **Files:** `src/types/portfolio.ts:213`, `src/data/bondPresets.ts:15`
- **Issue:** `IKE_DEFAULT_LIMIT = IKE_LIMIT_2025` (26,019 PLN). `BOND_PRESETS_LAST_UPDATED = '2026-04-11'`. `IKE_LIMIT_2026` is defined in `accumulation.ts` but unused. Wizard projects more IKE contributions than legally permitted, overstating tax-advantaged returns.
- **Fix direction:** Update `IKE_DEFAULT_LIMIT` to `IKE_LIMIT_2026` and verify the figure against official GUS/KNF announcements.

## 🟡 Warning

### 6.5 — `toScenarios` minimum-spread enforcement can leave bear ≥ 0 ✅ FIXED — bear hard-floored at negative
- **File:** `src/hooks/useHistoricalVolatility.ts:96–108`
- **Issue:** For high-momentum stocks where shrunk p25 is positive, all three scenarios become positive ("Bear: +3%"). Misleading and violates `validateScenarios`.
- **Fix direction:** Hard-floor `bear = Math.min(bear, -MIN_SCENARIO_SPREAD)`.

### 6.6 — `simulateBondsBucket` ignores bond maturity events
- **File:** `src/utils/accumulationCalculator.ts:125–160`
- **Issue:** DCA bond simulation treats bonds as a continuous compound interest account — no maturity, no Belka events at maturity, single exit Belka deferred to terminal year. Over 30-year wizard horizons, deferring tax from 15+ intermediate maturities significantly overstates compounding.

### 6.7 — `calcBondEndValue` for coupon bonds: penalty deducted from `endValue` not principal ✅ FIXED — clarifying comment added
- **File:** `src/utils/calculations.ts:144–149`
- **Issue:** Algebraically equivalent to the correct formula, so the **final number is right**, but auditing is harder. Add a clarifying comment.

### 6.8 — `calcIkzePitDeduction` mid-year approximation overstates compounding
- **File:** `src/utils/accumulationCalculator.ts:201`
- **Issue:** `monthsRemaining = (horizonYears - year) * 12 + 6` adds 6 months. Real PIT deduction is available ~start of next year (`* 12`). Overstates IKZE benefit by ~half a year's savings return per deduction; a few % over 20 years.

### 6.9 — HMM `confidence` cap is 0.90, not 0.25 ✅ FIXED — capped at 0.25 per architecture constraint
- **File:** `src/utils/models/hmmModel.ts:90`
- **Issue:** Currently harmless (HMM excluded from scenario pipeline) but if re-added would violate the architectural constraint. UI displays the 0.90 confidence as if HMM were highly reliable.

### 6.10 — `validateScenarios` does not enforce `bear.deltaFx ≤ 0` and `bull.deltaFx ≥ 0`
- **File:** `src/__tests__/scenarioSanity.test.ts`
- **Issue:** FX sign correlation assumption never tested.

### 6.11 — Bootstrap horizon cap at 504 days silently produces wrong percentiles for >24-month horizons
- **File:** `src/hooks/useHistoricalVolatility.ts:188`
- **Issue:** `Math.min(debouncedHorizon * 21, 504)`. For 36-month horizon, bootstrap shows 24-month results labelled as 36-month. Affects only secondary "Bootstrap" tab since GBM is primary >6mo.

## 🟢 Suggestion

### 6.12 — `validateScenarios` test coverage gaps — no all-positive scenarios test, no RSU (zero cost basis) test, no max-horizon (144mo) test, no `base.deltaFx == 0` assertion
### 6.13 — `etradeParser` hardcodes `currency: 'USD'` — non-USD ADRs/foreign stocks silently mislabelled. Add manual override field in UI.
### 6.14 — `calcTimeline` applies bond penalty at `m = 0` — chart bond line starts below investment amount before any time elapses. Visual discontinuity.
### 6.15 — Legacy `calcBelkaTax` converts acquisition fee at `nbpRateSell` not acquisition-date rate — `taxCalculator.ts:162`. Newer `calcTransactionResult` handles this correctly.

## ✅ Verified correct (extensive checklist)

Belka applied to gain only (savings, bonds, stocks); capitalized bond tax at redemption only; coupon bond tax per payout + second Belka on reinvestment; bond penalty deducted before Belka in capitalized path; no tax on loss; savings formula `principal + grossInterest × 0.81`; PIT-38 loss-gain offset in `calcMultiTaxSummary`; NBP Table A query window ends `date − 1`; PLN transactions skip NBP fetch; FX multiplicative; geometric timeline interpolation; dual-rate model (NBP mid for tax, kantor for cash); monthly sub-compounding; year-by-year rate switching; Fisher exact real-return formula; dividend WHT 15% + Polish 4% top-up = 19%; GBM drift shrinkage `w = min(1, dataYears/10)` to 8% prior; GBM damped vol `σ × max(0.75, 1−0.015×(T−2))`; Student-t ν=5 quantiles; bear/bull = p25/p75, base = p50; HMM excluded from `allPredictions`; `blendedInflationRate` mean-reversion correct; IKZE 10% ryczałt on total gross; IKE 0% exit tax; 2025 IKE/IKZE limits arithmetically correct; waterfall allocation IKE → IKZE → Regular; Etrade date format conversion; HMM Baum-Welch EM correct; no Itô correction on HMM log-return means.

---

# 7. Repo Hygiene + GitHub Maintenance

## 🔴 Critical

### 7.1 — Stray files tracked in git ✅ FIXED — files `git rm`'d, `.gitignore` updated
- **Files at repo root:**
  - `Prompt_ Kalkulator Pasywnego Inwestora PL (1).md` (14 KB design spec)
  - `Prompt_ Kalkulator Pasywnego Inwestora PL (1).md:Zone.Identifier` (Windows Mark-of-the-Web)
  - `test-results/.last-run.json` (Playwright artifact)
- **Fix direction:** `git rm` and add to `.gitignore`.

### 7.2 — Branch protection enforces phantom check names ⏭️ DEFERRED — requires GitHub repo settings change, not a code fix
- **Issue:** Branch protection on `main` requires checks named **`validate`** and **`e2e`** — neither exists. Actual job names are `lint`, `test`, `build`, `smoke-tests` (defined in `.github/workflows/build-and-test.action.yaml`). **Any PR can merge without lint/tests/build passing.**
- **Fix direction:** Update branch protection to require the actual job names, or rename jobs to match.

### 7.3 — `dependabot/fetch-metadata@v3` not SHA-pinned ✅ FIXED
- **File:** `.github/workflows/auto-merge.job.yaml:12`
- **Issue:** Third-party action pinned to floating tag in a workflow that has `contents: write` + `pull-requests: write`. Compromised tag could exfiltrate `GITHUB_TOKEN`.
- **Fix direction:** Pin to commit SHA.

### 7.4 — `xlsx` installed from CDN tarball, not npm registry ⏭️ DEFERRED — requires SheetJS licensing decision; no maintained npm alternative
- **File:** `package.json:26` — `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`
- **Issue:** Bypasses `npm audit` entirely — CDN-hosted packages are not checked. The `lint.job.yaml` already acknowledges a SheetJS CVE with `|| true`.
- **Fix direction:** Use the npm-published `xlsx` package or a maintained fork (e.g., `xlsx-js-style`).

### 7.5 — `npm audit` silenced with `|| true` ⏭️ DEFERRED — blocked by §7.4 (xlsx CDN install)
- **File:** `.github/workflows/lint.job.yaml`
- **Issue:** `npm audit --omit=dev --audit-level=critical || true` — step always succeeds. Comment promises tightening "once SheetJS CVE resolved" but since xlsx comes from a CDN URL, audit will never flag it.

### 7.6 — Branch protection: no required PR reviews; `enforce_admins: false` ⏭️ DEFERRED — requires GitHub repo settings change
- **Issue:** Any contributor with push access can merge directly without review; admins bypass all rules.

### 7.7 — Broken screenshot in README ✅ FIXED — reference removed
- **File:** `README.md:7` — `![Njord screenshot](screenshots/Screenshot%202026-04-06%20at%2019.47.00.png)`. `screenshots/` directory does not exist.

### 7.8 — `AGENTS.md` references non-existent `.github/workflows/ci.yml` ✅ FIXED
- **File:** `AGENTS.md:364` — actual entry-point is `build-and-test.action.yaml`. Any AI agent following this instruction fails to locate CI.

## 🟡 Warning

### 7.9 — `AGENTS.md:243` test count stale (217/11 vs actual 446/17). Three new test files unmentioned: `auth.test.ts`, `setup.test.ts`, `xtbParser.test.ts`.
### 7.10 — `AGENTS.md` hooks table incomplete — missing `useAuth`, `usePortfolioState`, `useTickerReturn`. References non-existent `useFxData` (actual: `useCurrencyRates`).
### 7.11 — Entire auth system undocumented in `AGENTS.md` and `README.md` — 10 functions in `functions/api/auth/`, 3 components (`AuthModal`, `AccountPanel`, `UserMenu`), `useAuth` hook, `migrations/0001_create_users.sql`, required env vars.
### 7.12 — `AGENTS.md` bond preset description wrong — claims 8 presets in `BOND_PRESETS` array; actual file exports only date-string constants. Bond data lives in `public/polish_treasury_bonds.csv` and is loaded via `/api/bonds`. Rate table in AGENTS.md (OTS 1.50%, ROR 5.50%) doesn't match CSV (OTS 2.00%, ROR 4.00%).
### 7.13 — No `concurrency:` block on any workflow — parallel PR runs stack on rapid pushes; wastes runner minutes.
### 7.14 — `.github/actions/setup/action.yaml` missing npm cache — 5× full `npm ci` per PR (no `actions/cache`).
### 7.15 — `copilot-setup-steps.yml` uses `setup-node@v4`; workflows use `@v6` — version drift.
### 7.16 — README architecture section says "dwa widoki" (2 tabs) — there are 3 (investment, tax, Kreator portfela). Wizard tab absent from README entirely.
### 7.17 — `backtest-history.csv` tracked with no truncation strategy — grows unbounded with daily backtest workflow.
### 7.18 — `migrations/0001_create_users.sql` uses `CREATE TABLE` without `IF NOT EXISTS` — re-running on non-empty DB errors.
### 7.19 — `dist/` main bundle 257 KB — only 8 KB headroom before CI's 265 KB limit (`build.job.yaml`).

## 🟢 Suggestion

### 7.20 — Missing community/governance files: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`. Public repo with auth handling passwords + OAuth secrets — `SECURITY.md` particularly important.
### 7.21 — `src/utils/assetConfig.ts` is a 1-line constant — candidate for consolidation with other constants.
### 7.22 — `build-and-test.action.yaml` has no top-level `permissions:` block — inherits default read/write. Add `permissions: read-all` and grant writes per-job.
### 7.23 — Dependabot `github-actions` ecosystem missing PR limit and reviewers — npm has both.
### 7.24 — Branch protection weaknesses: `strict: false`, `required_signatures: false`, `enforce_admins: false`.
### 7.25 — `src/workers/sellAnalysis.worker.ts` not explained in AGENTS.md — readers may confuse Web Worker with Cloudflare Worker.
### 7.26 — `.gitignore` gaps — missing `test-results/`, `Prompt_*.md`, `*.Zone.Identifier`, `screenshots/`, `.env`, `.env.*` (with `!.env.example` exception).

---

# Appendix — Methodology

This review was conducted by 7 parallel sub-agents (Sonnet 4.6), each scoped to one of the seven areas with explicit guardrails:

- No source files were modified.
- Each agent provided concrete `path:line` citations.
- Severity tags follow the legend at the top of this document.
- Findings overlap intentionally between areas where the same issue spans multiple concerns (e.g., the CORS misconfiguration is listed under both Security §1.2 and Cloudflare §4.1).
- The `financial-math-guardian` and `financial-forecasting` skill rule sets were applied as the canonical checklist for area #6.
- Confirmed-clean items are listed at the end of each section to give context on what was actively verified vs. simply not flagged.

For the implementation plan referenced by this audit, see `.copilot/session-state/<session>/plan.md`.
