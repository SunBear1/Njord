---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-05-22'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/prd-validation-report.md
  - docs/backtest-methodology.md
  - docs/financial-methodology.md
  - README.md
workflowType: 'architecture'
project_name: 'Njord'
user_name: 'Sir'
date: '2026-05-22'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

42 FR podzielone na 7 domen:
- Zrodlo prawdy o portfelu (FR1-8): konsolidacja holdings, manual-first entry, reconciliation, provenance, freshness, data quality impact
- Ocena decyzji (FR9-15): recommendation engine, porownanie opcji, explanation, assumption adjustment, session history
- Lokalny kontekst finansowy (FR16-21): wynik po podatku, wplyw FX, porownanie z polskimi alternatywami, baseline/horizon
- Preferencje i granice (FR22-27): horizon, risk tolerance, constraints, scope disclaimer, goal-based (Phase 2)
- Wyjasnialnosc i pewnosc (FR28-33): confidence level, reversal factors, stale/conflict data, no-recommendation, rationale, guidance strength
- Monitoring i historia (FR34-38): tracking changes, alerts, recommendation history, scenario history, proactive guidance (Phase 2-3)
- Wsparcie i bezpieczniki (FR39-42): ops quality signals, suppress unreliable recommendations, trace decisions, help repair data

**Non-Functional Requirements:**

| Obszar | Cel | Implikacja architektoniczna |
|--------|-----|---------------------------|
| Wydajnosc | <=2.5s widok, <=3s rekomendacja | Optimistic UI, lazy loading, client-side compute offloading |
| Bezpieczenstwo | 0 nieautoryzowanych ekspozycji, 100% audytowalnosc | Auth layer, audit log, data isolation |
| Skalowalnosc | >=60 aktywnych userow, 0 critical errors | Edge caching, stateless backend, client-side heavy lifting |
| Dostepnosc | WCAG 2.2 AA, 0 keyboard blockers | Semantic HTML, ARIA, focus management, contrast |
| Integracje | Manual-first, kazde zrodlo z provenance | Data source abstraction, freshness tracking, fallback strategy |
| Niezawodnosc | >=99.5% monthly, graceful degradation | Circuit breakers, partial failure handling, no-recommendation over bad recommendation |

**Scale & Complexity:**

- Primary domain: decision-support fintech (web)
- Complexity level: high
- Estimated architectural components: ~12-15 major modules

### Technical Constraints & Dependencies

- Runtime: Cloudflare Pages (V8 isolates) — no fs, path, process; limited compute time per request
- Database: D1 SQLite — eventual consistency, edge-replicated, limited query patterns
- Client compute: Web Workers for heavy Monte Carlo (HMM), main thread for lighter calcs
- Data sources: Yahoo Finance (rate limited), NBP API, ECB, Alior Kantor, Twelve Data (fallback)
- Auth: JWT + OAuth (GitHub, Google) — already partially implemented
- Existing stack: React 19, TypeScript strict, Vite, Tailwind v4, Recharts, Vitest + Playwright
- Solo founder constraint: minimalizacja kosztu operacyjnego, brak dedykowanych ops

### Cross-Cutting Concerns Identified

1. Data provenance & freshness — kazdy wynik musi znac zrodlo, timestamp, status jakosci danych
2. Confidence propagation — od jakosci danych wejsciowych przez obliczenia do verdict UI
3. Graceful degradation — partial data, API failures, stale rates -> nigdy mylacy wynik
4. Audit trail — odtwarzalnosc decyzji: inputs, assumptions, versions, confidence, outcome
5. FX & tax context — przenika kazda warstwe: portfolio, comparison, recommendation, monitoring
6. No-recommendation as first-class outcome — nie error state, lecz pelnoprawny wynik produktowy
7. Manual-first data model — dane deklaratywne vs potwierdzone, reconciliation, conflict resolution

### Architectural Tensions (from roundtable)

1. Client-side finance vs audit trail — obliczenia w przegladarce, ale wynik musi byc odtwarzalny
2. Freshness vs rate limits vs performance — swiezosc danych ograniczona limitami API i budzet czasu
3. Explainability vs HMM/Monte Carlo complexity — stochastyczne modele vs deterministic replay
4. Manual-first model vs przyszly import/agregacja — prosty start vs rozszerzalnosc
5. No-recommendation vs presja produktowa — architektura musi chronic przed "zawsze cos pokaz"
6. WCAG AA vs gestosc informacji finansowej — dostepnosc vs data density

### Engine Architecture Direction (validated by roundtable)

Silnik rekomendacji zorganizowany w 4 warstwy z jasna separacja odpowiedzialnosci:

**Warstwa 1: Snapshot Layer**
Zamroza swiata przed obliczeniem. Kazdy snapshot ma: asOf, source, version, freshness, hash. Silnik nigdy nie czyta live data — tylko snapshoty.

**Warstwa 2: Calculation Core**
Czysta, deterministyczna matematyka. Zero Date.now(), zero fetch, zero Math.random() bez seeda. Kazda funkcja zwraca value + assumptions + warnings + provenance.

**Warstwa 3: Scenario Engine**
Buduje warianty porownania (ETF vs bonds vs savings vs hold), uruchamia math core, zwraca ScenarioResult[] w jednolitym formacie z expected return netto, downside, liquidity, tax impact, FX exposure, confidence components.

**Warstwa 4: Decision Policy Layer**
Drzewo decyzyjne = hard gates (eliminacja) + comparative scoring (ranking) + verdict builder. Policy nie liczy finansow — tylko interpretuje gotowe metryki.

Hard Gates (sekwencyjnie):
1. Data Integrity Gate
2. Eligibility Gate
3. Horizon Fit Gate
4. Liquidity Fit Gate
5. Risk Fit Gate
6. Expected Net Advantage Check
7. Confidence Threshold Check
8. Verdict Builder

Verdict = strong | conditional | none + obowiazkowy DecisionTrace.

**Structural Guarantees vs Silent Bugs:**
- Branded types (PLN, USD, FxUsdPln) — kompilator nie pozwoli mieszac
- Stanowy pipeline: Raw -> Normalized -> Validated -> Enriched -> Scored -> Decided
- Result<T> zamiast wyjatkow — degradacja zawsze jawna
- Freshness jako requirement — stale = forced no-recommendation
- Obowiazkowy DecisionTrace w kazdym verdikcie
- Jeden evaluate(snapshot, policyConfig) dla runtime i backtestu
- Exhaustive switch + never — nowy verdict type psuje kompilacje

**Code Organization:**
- src/recommendation/ — nowy bounded context (decision engine)
- src/utils/ — pozostaje czystą matematyką (bez orchestration)
- recommendation -> utils OK; utils -> recommendation NIGDY
- Jedyny publiczny entrypoint: generateRecommendation(input): RecommendationResult

**Confidence Model:**
Confidence rozbite na skladowe: dataConfidence, modelConfidence, assumptionConfidence, stabilityConfidence. Final confidence = kompozycja z karami. Jesli dataConfidence slabe, nie mozna zamaskowac dobrym modelem.

---

## Starter Template Evaluation

### Brownfield Assessment

Njord to istniejacy projekt — brak potrzeby starter template. Obecny stack stanowi baseline:

- **Runtime:** Node 22 LTS, React 19, Vite 6, TypeScript strict
- **Styling:** Tailwind CSS v4 (utility-only, semantic tokens via @theme)
- **Deploy:** Cloudflare Pages (V8 isolates, NOT Node.js)
- **State:** Page-owned, props-down, no global store
- **Tests:** 1268 unit (Vitest) + 31 E2E (Playwright)
- **API:** CF Pages Functions (thin proxy/cache)

### Risk Analysis — Pre-mortem & Chaos Monkey

8 decyzji stackowych zidentyfikowanych przez analizę failure modes:

| # | Decyzja | Opis |
|---|---------|------|
| 1 | Persistence | localStorage + optional D1 sync za auth gate (faza 2) |
| 2 | Context-aware freshness | Ta sama dana ma różną staleness semantykę per use-case |
| 3 | Sparse/zero-portfolio first-class | Brak danych = pełnoprawny flow, nie edge case |
| 4 | Fast path + partial verdict | Scoring <1s, Worker 3s timeout, partial OK |
| 5 | Complexity budget | Provenance tylko na boundary layers, branded types: PLN/USD/FX |
| 6 | Versioned config params | Bond terms, tax rates, IKZE limits z staleness threshold |
| 7 | Scoring on incomplete candidates | API failure eliminuje opcje, nie łamie flow |
| 8 | Switch cost explicit | Exit penalty (Belka + FX spread) jako scoring factor |

### Priorytetyzacja — Comparative Analysis Matrix

Kryteria: User Value (×3), Implementation Cost (×2), Risk Reduction (×2), Solo Founder (×1)

| # | Decyzja | Score | Tier |
|---|---------|:-----:|------|
| 3 | Sparse/zero-portfolio first-class | 38 | MVP must-have |
| 7 | Scoring on incomplete candidates | 34 | MVP must-have |
| 8 | Switch cost explicit | 33 | MVP must-have |
| 4 | Fast path + partial verdict | 32 | MVP must-have |
| 2 | Context-aware freshness | 30 | Wzmocnienie zaufania |
| 6 | Versioned config params | 26 | Wzmocnienie zaufania |
| 1 | Persistence + D1 sync | 15 | Odroczone (faza 2) |
| 5 | Complexity budget | 15 | Meta-guardrail |

### Kluczowe wnioski

- **Graceful degradation > speed:** poprawny wolniejszy wynik wygrywa z szybkim ale błędnym
- **D1 sync to jedyna decyzja zmieniająca shape systemu** — odroczona do fazy 2
- **Fast path wymaga jawnego partial-state w UI** — user musi widzieć "refinement in progress"
- **Complexity budget = guardrail, nie feature** — działa tylko przy zero wyjątkach

---

## Core Architectural Decisions

### Strategic Direction

**Docelowa architektura:** Cała warstwa biznesowa (obliczenia, scoring, recommendation) migruje do Go/CF Workers. Frontend staje się thin client — disposable, łatwy do wyrzucenia.

**Fazy:**
- Faza 1: Engine w `src/recommendation/` (TypeScript, frontend). Dostarcza wartość natychmiast.
- Faza 2: Przepisanie na Go, backend facade. Frontend hook nie zmienia interfejsu — big bang na backendzie, transparentny dla UI.

### Decision Priority Analysis

**Critical (blokują implementację):**
- Portfolio Snapshot Model, Pipeline topology, API boundary, Verdict taxonomy

**Important (kształtują architekturę):**
- Confidence model, Observability/Trace, State transitions

**Deferred (post-MVP):**
- Backend cache, D1 persistence/sync, Auth gate

### Decisions Table

| # | Decyzja | Wybór | Rationale |
|---|---------|-------|-----------|
| 1 | Portfolio Snapshot Model | Hybrid: flat interface + runtime guard na granicy `src/recommendation/` | Zero zmian w istniejącym kodzie. Guard waliduje na wejściu. Evolutionary path do branded types. |
| 2 | Walidacja danych | Domain assertion functions (`assertPositivePLN`, `assertFreshWithin`) | Zero deps, composable, domainowe nazwy. Frontend disposable — nie warto inwestować w schema lib. |
| 3 | Cache | Brak na froncie. Docelowo backend per input hash. | Frontend = disposable. Cache to backend concern. |
| 4 | Pipeline topology | Linear sekwencyjny: snapshot → normalize → calculate → score → decide | Trivialny port do Go. Łatwe testowanie. Early-exit via Result<T,E> return. |
| 5 | State transitions | Result<T, E> = `{ ok: true, value: T } \| { ok: false, error: E }` | Mapuje na Go `(T, error)`. Wymusza obsługę błędów. Composable w pipeline. |
| 6 | Confidence model | 4-składnikowy: dataConfidence, modelConfidence, assumptionConfidence, stabilityConfidence | Granularny — user widzi CO jest słabe. Final confidence = kompozycja z karami. |
| 7 | Verdict taxonomy | strong \| conditional \| none | Mandatory abstention. "none" = nie mamy danych, nie rekomendujemy. Każdy z DecisionTrace. |
| 8 | API boundary | Backend facade: `POST /api/recommend { snapshot }` → `{ verdict, confidence, traceSummary[] }` | FE = 1 call. Wewnętrzna granularność po stronie backendu. FE pozostaje disposable thin client. |
| 9 | Migracja Frontend→Backend | Faza 1: engine na froncie (JS). Faza 2: big bang na backendzie (Go). | Wartość natychmiast (faza 1). Migracja nie blokuje usera. Hook interfejs stabilny. |
| 10 | Observability | Backend produkuje full trace per pipeline stage. FE renderuje traceSummary (progressive disclosure). | Trace = backend concern. UI nie zależy od wewnętrznej architektury backendu. |

### Cross-Decision Implications

- **Facade API + disposable FE:** spójna para. FE woła 1 endpoint, nie orchestruje.
- **Linear pipeline + Result<T,E> + full trace:** trace jest naturalnym produktem pipeline — każdy stage zwraca `Result` z metadata.
- **Hybrid snapshot + guard:** guard jest jedynym punktem walidacji. Po nim dane są zaufane w całym pipeline.
- **Big bang na backendzie, nie na froncie:** faza 1 daje wartość od razu. Faza 2 podmienia backend bez zmiany kontraktu API.
- **4-component confidence + none verdict:** jeśli dataConfidence < threshold → verdict = none (mandatory abstention).

---

## Implementation Patterns & Consistency Rules

### Istniejące konwencje (bez zmian)

Pełne konwencje w README.md i `.github/instructions/`. Kluczowe:
- camelCase vars/functions, PascalCase components/types/interfaces
- PascalCase.tsx components, camelCase.ts utils/hooks
- Tests w `src/__tests__/*.test.ts`, E2E w `e2e/`
- Tailwind tokens only, no CSS modules
- Conventional Commits, no global state
- Components <300 LOC, utils <200, hooks <150

### Nowe wzorce — Recommendation Engine (`src/recommendation/`)

**Pipeline Stage Contract:**
```typescript
type PipelineStage<In, Out, Err> = (input: In) => Result<Out, Err>;
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```
Jeden `Result<T,E>` w `src/types/result.ts` — reusable przez cały pipeline i inne moduły.

**Trace Format (minimalne, produktowe):**
```typescript
type TraceEntry = {
  stage: string;
  summary: string;       // human-readable, PL
  confidence: number;    // 0-1
  durationMs: number;
};
type RecommendationTrace = TraceEntry[];
```
UI renderuje summary + confidence. Debug mode pokazuje pełny trace.

**Error Taxonomy (flat enum):**
```typescript
type RecommendationError =
  | { kind: 'data_missing'; field: string }
  | { kind: 'data_stale'; source: string; ageHours: number }
  | { kind: 'validation_failed'; reason: string }
  | { kind: 'calculation_error'; stage: string; detail: string }
  | { kind: 'timeout'; stage: string; limitMs: number };
```

**Domain Assertions (guard boundary):**
```typescript
// src/recommendation/guard.ts
function assertValidSnapshot(input: PortfolioSnapshot): Result<ValidatedSnapshot, RecommendationError>;
```
Jedyny punkt walidacji. Po nim — dane zaufane.

### API Contract (docelowo Go backend)

**Request/Response:**
```typescript
// POST /api/recommend
Request:  { snapshot: PortfolioSnapshot }
Response: { verdict: Verdict; confidence: ConfidenceBreakdown; trace: TraceEntry[] }

type Verdict = { type: 'strong' | 'conditional' | 'none'; summary: string; conditions?: string[] };
type ConfidenceBreakdown = { data: number; model: number; assumption: number; stability: number; overall: number };
```

**Zasady:**
- camelCase JSON fields (spójne z istniejącym API)
- ISO 8601 daty
- HTTP 200 zawsze (error w body jako `Result`), HTTP 5xx tylko na infra failure
- Backend w Go — osobne repo docelowo. Obecne `functions/api/*.ts` = thin proxy (bez zmian).

### Enforcement

Agenci AI MUSZĄ:
1. Każda nowa funkcja w `src/recommendation/` zwraca `Result<T, RecommendationError>`
2. Zero `console.log` — tylko structured trace entries
3. Każdy pipeline stage ma odpowiadający test w `src/__tests__/recommendation/`
4. Import direction: `recommendation/ → utils/` OK; `utils/ → recommendation/` NIGDY

---

## Project Structure & Boundaries

### Istniejąca struktura (bez zmian)

```
src/
├── pages/           # Page components (own state, <300 LOC)
├── components/      # UI (props only, <300 LOC)
├── hooks/           # Data fetching + state (<150 LOC)
├── utils/           # Pure calculations (<200 LOC)
├── utils/models/    # GBM, Bootstrap, HMM
├── providers/       # API adapters
├── workers/         # Web Worker (HMM Monte Carlo)
├── types/           # TypeScript interfaces
├── __tests__/       # Unit tests (Vitest)

functions/api/       # CF Pages Functions (thin proxy, stays as-is)
e2e/                 # Playwright E2E tests
infrastructure/      # Terraform (CF Pages + D1)
```

### Nowa struktura — Recommendation Engine

```
src/recommendation/
├── index.ts              # PUBLIC API (guard, pipeline, types only)
├── guard.ts              # assertValidSnapshot — single validation point
├── pipeline.ts           # Linear orchestrator (<200 LOC, only orchestrates)
├── stages/
│   ├── normalize.ts      # Raw → Normalized
│   ├── calculate.ts      # Normalized → Calculated (calls utils/)
│   ├── score.ts          # Calculated → Scored (per candidate)
│   └── decide.ts         # Scored → Verdict
├── confidence.ts         # 4-component confidence model
├── thresholds.ts         # Wagi, progi, staleness limits (versioned config)
├── trace.ts              # Trace assembly/formatting
├── types.ts              # Domain types (Verdict, Snapshot, etc.)
└── errors.ts             # RecommendationError taxonomy

src/types/
└── result.ts             # Shared Result<T,E> (reusable)

src/__tests__/recommendation/
├── fixtures/             # Canonical snapshots for regression
├── guard.test.ts
├── pipeline.test.ts
├── stages/
│   ├── normalize.test.ts
│   ├── calculate.test.ts
│   ├── score.test.ts
│   └── decide.test.ts
└── confidence.test.ts
```

### Docelowy Go backend (osobne repo, faza 2)

```
njord-api/
├── cmd/api/main.go
├── internal/
│   ├── recommendation/    # Mirror semantyczny (nie plikowy 1:1)
│   │   ├── guard.go
│   │   ├── pipeline.go
│   │   ├── stages/
│   │   └── confidence.go
│   ├── market/            # Yahoo/NBP adapters
│   └── fx/                # FX conversion
├── api/
│   └── handler.go         # POST /api/recommend
└── go.mod
```

### Integration Boundaries

```
┌─────────────────────────────────────────────┐
│ Frontend (React, disposable)                 │
│  pages/ → hooks/useRecommendation           │
│         → POST /api/recommend               │
└──────────────────────┬──────────────────────┘
                       │ JSON { verdict, confidence, trace[] }
┌──────────────────────▼──────────────────────┐
│ Faza 1: src/recommendation/ (local TS)      │
│ Faza 2: njord-api/ (Go, CF Workers)         │
└──────────────────────┬──────────────────────┘
                       │ imports
┌──────────────────────▼──────────────────────┐
│ src/utils/ (pure math, unchanged)           │
│ Faza 2: internal/ (Go equivalent)           │
└─────────────────────────────────────────────┘
```

### Import & Boundary Rules

1. `recommendation/ → utils/` ✅
2. `recommendation/ → types/` ✅
3. `utils/ → recommendation/` ❌ NIGDY
4. `pages/ → recommendation/` ❌ (tylko via `hooks/useRecommendation`)
5. Stage'y nie importują siebie nawzajem — tylko `pipeline.ts` je zna
6. `index.ts` eksportuje: `generateRecommendation`, `assertValidSnapshot`, typy publiczne
7. Każdy plik w `src/recommendation/` < 200 LOC
8. Kontrakty (typy, fixtures) wspólne semantycznie między TS i Go — nie plikowy mirror

---

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** Wszystkie decyzje współgrają. Facade API + linear pipeline + Result<T,E> + full trace = spójna architektura. Korekta roundtable (facade zamiast granular FE) usunęła jedyną niespójność.

**Pattern Consistency:** Istniejące konwencje (camelCase, Tailwind, page-owned state) zachowane. Nowe wzorce dotyczą wyłącznie `src/recommendation/` i nie kolidują z resztą.

**Structure Alignment:** Bounded context z jasnymi import rules. Stage'y izolowane (tylko pipeline je zna). Public API przez index.ts.

### Requirements Coverage ✅

**42 FR w 7 domenach — pełne pokrycie architektoniczne:**
- Portfolio (FR1-8): guard.ts + normalize.ts + existing hooks
- Ocena decyzji (FR9-15): pipeline → score → decide
- Scenariusze (FR16-21): calculate.ts (calls utils/models/)
- Zaufanie (FR22-26): confidence.ts + trace.ts + progressive UI
- Benchmark (FR27-32): existing utils/calculations.ts
- Podatki (FR33-37): existing tax utils + thresholds.ts
- UX (FR38-42): existing pages/

**NFR Coverage:**
- Performance (<5s): linear pipeline, Worker 3s timeout
- Accuracy (Belka 19%): thresholds.ts versioned, guard validates
- Trust: full trace, confidence breakdown, mandatory abstention
- Maintainability: <200 LOC/file, bounded context, import rules

### Gap Analysis

**Critical Gaps:** Brak

**Important Gaps (non-blocking):**
1. `hooks/useRecommendation.ts` — bridge page↔engine (trivial, implementacja przy pierwszym story)
2. Go API repo OpenAPI spec — deferred do fazy 2
3. Session persistence schema (localStorage) — deferred

**Nice-to-Have:**
- ADR log format dla przyszłych zmian
- Shared test fixture format TS↔Go

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS
**Confidence Level:** High

**Key Strengths:**
- Jasny bounded context z enforceable granicami
- Disposable frontend — zero lock-in na TS implementation
- Full trace jako naturalny produkt linear pipeline
- Mandatory abstention (none verdict) chroni przed cichymi błędami
- Roundtable-validated decisions (3 korekty po Party Mode)

**Areas for Future Enhancement:**
- Go API spec (faza 2)
- Session persistence design
- Observability dashboard (production monitoring)

**First Implementation Priority:**
1. `src/types/result.ts` — Result<T,E> type
2. `src/recommendation/types.ts` — domain types
3. `src/recommendation/guard.ts` + test
4. `src/recommendation/stages/` — one stage at a time
5. `src/recommendation/pipeline.ts` — wire it together
6. `src/hooks/useRecommendation.ts` — connect to UI
