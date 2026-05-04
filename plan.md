
================================================================================
INSTRUCTIONS REFACTOR PLAN — SunBear1/Njord
================================================================================

================================================================================
PART 0: RESEARCH FINDINGS (grounding the decisions)
================================================================================

KEY FACTS FROM GITHUB DOCS & COMMUNITY:
1. Multiple instruction files CAN activate simultaneously on the same file
   (GitHub Docs: "agent determines which instructions to apply based on applyTo
   pattern OR semantic matching of description to current task")
2. ALL matching files are injected into context — there is NO deduplication
3. Recommended: 5-15 core rules per file, 200-500 tokens each
4. Max recommended single file: ~1,000 lines
5. Shorter files = more likely to be fully processed
6. applyTo supports comma-separated globs: "src/**/*.ts,src/**/*.tsx"
7. Files WITHOUT applyTo may still activate via semantic description matching
8. copilot-instructions.md is ALWAYS injected (no applyTo needed)

IMPLICATION FOR NJORD:
- Current 14 files with overlapping applyTo patterns means some .tsx edits
  inject 12 files simultaneously = ~50KB+ of instructions = massive token waste
- The fix: strict non-overlapping applyTo + consolidation by actual file path

================================================================================
PART 1: CURRENT STATE ANALYSIS
================================================================================

REPO FILE STRUCTURE:
src/
├── __tests__/          *.test.ts files
├── components/         *.tsx UI components
├── data/               Static data files
├── hooks/              *.ts custom hooks
├── pages/              *.tsx page components
├── providers/          *.ts API adapters
├── scripts/            Build/generation scripts
├── tokens/             Token definition files
├── types/              *.ts TypeScript interfaces
├── utils/              Pure calculation functions
│   └── models/         GBM, Bootstrap, HMM
├── workers/            Web Worker files
├── index.css           Tailwind @theme definitions
├── main.tsx            App entry
└── routes.tsx          Route definitions

functions/api/          CF Pages Functions
infrastructure/         Terraform

CURRENT 14 INSTRUCTION FILES & THEIR applyTo SCOPES:

FILE                              | applyTo              | ~SIZE
----------------------------------|----------------------|------
anti-slop-quality                 | **                   | 4 KB
validation-loops                  | **                   | 3.5 KB
efficiency-performance            | src/**               | 3.5 KB
react-best-practices              | src/**/*.{ts,tsx}     | 5 KB
css-tailwind                      | src/**/*.tsx,*.css    | 3 KB
web-interface-guidelines          | src/**/*.{tsx,css}    | 4.5 KB
frontend-design                   | src/components/**    | 3 KB
react-composition-patterns        | src/components/**    | 2.5 KB
ui-colors                         | src/components/**,src/pages/** | 2 KB
hooks-and-state                   | src/hooks/**,src/pages/**,... | 4 KB
design-tokens                     | src/index.css        | 3 KB
financial-math-guardian           | src/utils/**,src/__tests__/**,src/components/**,functions/** | 15 KB
financial-forecasting             | src/utils/models/**,src/hooks/useHistoricalVolatility.ts,src/__tests__/** | 4 KB
backend-api                       | functions/**         | 4 KB
webapp-testing                    | src/__tests__/**     | 1.5 KB

OVERLAP MAP — what activates when editing src/components/SomeChart.tsx:

1. anti-slop-quality (applyTo: **)                    → 4 KB
2. validation-loops (applyTo: **)                     → 3.5 KB
3. efficiency-performance (src/**)                    → 3.5 KB
4. react-best-practices (src/**/*.{ts,tsx})           → 5 KB
5. css-tailwind (src/**/*.tsx)                        → 3 KB
6. web-interface-guidelines (src/**/*.{tsx,css})      → 4.5 KB
7. frontend-design (src/components/**)               → 3 KB
8. react-composition-patterns (src/components/**)    → 2.5 KB
9. ui-colors (src/components/**)                     → 2 KB
10. financial-math-guardian (src/components/**)       → 15 KB
                                                     --------
TOTAL for ONE component edit:                         ~46 KB ≈ 12,000 tokens

This is CATASTROPHIC for cost efficiency.

================================================================================
PART 2: REFACTORED FILE PLAN
================================================================================

DESIGN PRINCIPLES:
- ZERO overlap in applyTo patterns
- Each file path matches EXACTLY ONE instruction file
- Consolidate by actual directory path, not by "topic"
- Maximum 3 KB per file (~750 tokens)
- Move universal rules (anti-slop, validation) into copilot-instructions.md
- Remove content already in copilot-instructions.md from path-specific files

TARGET: 14 files → 7 files (including copilot-instructions.md updates)

================================================================================

NEW FILE #1: react-components.instructions.md
applyTo: "src/components/**/*.tsx,src/pages/**/*.tsx"

CONTENT SOURCES (merged + deduplicated):
- frontend-design (Njord-specific parts only)
- react-composition-patterns (compound component patterns)
- ui-colors (token table + forbidden patterns)
- css-tailwind (class ordering + animation)
- web-interface-guidelines (Njord UI Standards section only)
- react-best-practices (component-level rules only)

WHAT TO KEEP:
- Component architecture: functional + hooks, props via interfaces
- React 19: use(), ref as prop, no forwardRef
- Composition over boolean props
- Color token table (safe/forbidden in dark mode)
- Tailwind class ordering (layout > sizing > spacing > typography > colors > effects > states > responsive)
- Animation whitelist: animate-spin, transition-colors, transition-opacity only
- File size limit: <300 lines per component
- Anti-patterns: no dark:text-faint, no gradient backgrounds, no CSS modules
- Accessibility: aria-label on icon buttons, semantic HTML
- Responsive: mobile-first, md: and lg: only

WHAT TO REMOVE (already in copilot-instructions.md or too generic):
- Generic React performance theory (useMemo article-style explanations)
- Vercel source attribution paragraphs
- "When to Apply" meta-sections
- Rule priority tables (CRITICAL/MEDIUM/LOW — irrelevant noise)
- SSR/RSC disclaimers (this is a Vite SPA)
- Generic "accessibility standards" not specific to this codebase

TARGET SIZE: ~2.5 KB

================================================================================

NEW FILE #2: hooks-state-providers.instructions.md
applyTo: "src/hooks/**/*.ts,src/providers/**/*.ts"

CONTENT SOURCES:
- hooks-and-state (most of it)
- efficiency-performance (network + debounce sections)
- react-best-practices (hook-specific rules only)

WHAT TO KEEP:
- Page-level state ownership pattern
- AbortController pattern (exact code)
- localStorage try/catch guard
- useDebouncedValue rationale (300ms for prediction models)
- API fallback chains (proxy-first, Promise.allSettled)
- Auto-refresh interval rules (60s, clearInterval in cleanup)
- Hook dependency rules (primitive values, stable derived values)
- Provider rules: no React imports, accept AbortSignal, translate errors to Polish

WHAT TO REMOVE:
- Generic "don't subscribe to state only used in callbacks" (Vercel article content)
- Repetition of validation command (in copilot-instructions.md)
- Architecture overview (in copilot-instructions.md)

TARGET SIZE: ~2.5 KB

================================================================================

NEW FILE #3: financial-calculations.instructions.md
applyTo: "src/utils/**/*.ts,src/workers/**/*.ts"

CONTENT SOURCES:
- financial-math-guardian (sections 1-9, trimmed)
- financial-forecasting (model architecture, anti-patterns)
- efficiency-performance (computation budget + worker rules)

WHAT TO KEEP:
- Core principle: stocks are not predictable, scenarios not forecasts
- Belka tax rules (3.1-3.5): what it applies to, basis rule, NBP lookup, PIT-38, RSU
- Bond math invariants table (all 8 types)
- FX multiplicative structure + heatmap hyperbola
- Dividend math (WHT + Polish top-up = 19%)
- Compound interest rules (monthly compounding, Fisher equation)
- Sanity check table (suspicious values)
- Anti-patterns list (9 items)
- Numerical precision rules
- Prediction architecture: <=6m Bootstrap, >6m GBM
- GBM: drift shrinkage formula, damped vol, Student-t quantiles, clampScenario
- Bootstrap: block size 21, 1000 samples, P10/P50/P90
- HMM: informational only, confidence capped at 0.25
- Computation budget: <100ms standard, Monte Carlo in Web Worker
- Worker rules: structured clone, terminate on unmount, progress every 1000 paths

WHAT TO REMOVE:
- Section 2 "What the Models Cannot See" (15+ bullets of generic stock market 
  knowledge — interesting but adds ~3KB of tokens that don't change code behavior)
- Inflation projection details (small, can be inline comment in code)
- Verbose examples that restate what the formula already says
- "Advisory Notes for New Features" (generic, belongs in PR template)

TARGET SIZE: ~4 KB (this is the largest file — justified by domain complexity)

================================================================================

NEW FILE #4: testing.instructions.md
applyTo: "src/__tests__/**/*.ts"

CONTENT SOURCES:
- webapp-testing (Playwright patterns)
- validation-loops (test quality standards section)
- financial-math-guardian (section 10: testing financial logic)

WHAT TO KEEP:
- Test naming: TestXxx_WhenCondition_ExpectsBehavior
- Financial test requirements: zero gain, small positive, negative, long horizon, monotonicity
- Edge cases list: zero shares, negative profit, 1-month/144-month horizon, FX=1.0, all 8 bonds, weekends
- Regression prevention: write failing test first, then fix
- Playwright template (headless, wait for networkidle, base path /)
- Reconnaissance-then-action pattern

WHAT TO REMOVE:
- Generic Vitest/Jest advice (developers know how to write tests)
- "New utility function → new test file" (stated in copilot-instructions.md validation)

TARGET SIZE: ~1.5 KB

================================================================================

NEW FILE #5: backend-api.instructions.md
applyTo: "functions/**/*.ts"

CONTENT SOURCES:
- backend-api (keep as-is, it's already well-scoped and well-sized)

CHANGES:
- Remove financial-math-guardian from functions/** scope (backend doesn't do math)
- Keep all 8 sections (data source strategy, error codes, CF constraints, caching, CORS, error handling, local dev, route structure)

TARGET SIZE: ~3.5 KB (unchanged — already good)

================================================================================

NEW FILE #6: infrastructure.instructions.md
applyTo: "infrastructure/**/*.tf,.github/workflows/**/*.yml"

CONTENT SOURCES:
- validation-loops (infrastructure section only: terraform validate, plan, never apply without approval)

WHAT TO KEEP:
- terraform validate && terraform plan before any change
- Never terraform apply without explicit human approval
- No unexpected destroys
- GitHub Actions: pin action versions to SHA

TARGET SIZE: ~0.5 KB (minimal but prevents catastrophic mistakes)

================================================================================

NEW FILE #7: styling-tokens.instructions.md  
applyTo: "src/index.css,src/tokens/**/*.ts"

CONTENT SOURCES:
- design-tokens (three-layer structure, current tokens, rules)

WHAT TO KEEP:
- Three-layer token architecture (primitive → semantic → component)
- Current brand/scenario/surface/text/border tokens
- Rules: never raw hex, add to @theme, chart colors from CSS vars
- Contrast requirements table
- Dark mode: fix token definition not component
- Forbidden patterns (no gradients, no opacity <0.5 on text)

WHAT TO REMOVE:
- Dark theme migration path (future work, not current rules)
- Token compliance check examples (too basic)

TARGET SIZE: ~2 KB

================================================================================

FILES TO DELETE (content absorbed elsewhere):

1. anti-slop-quality.instructions.md → ABSORBED INTO copilot-instructions.md
   (file size limits, dependency rules, naming patterns — these are universal)
   
2. validation-loops.instructions.md → SPLIT:
   - Universal validation command → copilot-instructions.md (already there)
   - Context-specific checks → each domain file has its own validation
   - Test quality → testing.instructions.md
   - Infrastructure checks → infrastructure.instructions.md
   
3. efficiency-performance.instructions.md → SPLIT:
   - Computation budget + worker → financial-calculations.instructions.md
   - Network/debounce → hooks-state-providers.instructions.md
   - Bundle size + rendering → react-components.instructions.md
   
4. react-best-practices.instructions.md → ABSORBED INTO react-components + hooks-state
   (component rules → react-components, hook rules → hooks-state-providers)
   
5. react-composition-patterns.instructions.md → ABSORBED INTO react-components
   
6. frontend-design.instructions.md → ABSORBED INTO react-components
   
7. web-interface-guidelines.instructions.md → ABSORBED INTO react-components
   (Njord UI Standards kept, generic Vercel guidelines removed)
   
8. ui-colors.instructions.md → ABSORBED INTO react-components
   
9. css-tailwind.instructions.md → ABSORBED INTO react-components
   
10. financial-math-guardian.instructions.md → REPLACED BY financial-calculations

11. financial-forecasting.instructions.md → MERGED INTO financial-calculations

12. hooks-and-state.instructions.md → REPLACED BY hooks-state-providers

13. webapp-testing.instructions.md → MERGED INTO testing

================================================================================
PART 3: OVERLAP VERIFICATION (post-refactor)
================================================================================

PATH                              | FILES THAT ACTIVATE
----------------------------------|-------------------------------------------
src/components/Foo.tsx            | react-components (1 file only)
src/pages/ComparisonPage.tsx      | react-components (1 file only)
src/hooks/useAssetData.ts         | hooks-state-providers (1 file only)
src/providers/nbpProvider.ts      | hooks-state-providers (1 file only)
src/utils/calculations.ts         | financial-calculations (1 file only)
src/utils/models/gbmModel.ts      | financial-calculations (1 file only)
src/workers/sellAnalysis.worker.ts| financial-calculations (1 file only)
src/__tests__/gbmModel.test.ts    | testing (1 file only)
src/index.css                     | styling-tokens (1 file only)
src/tokens/colorPairings.ts       | styling-tokens (1 file only)
functions/api/market-data.ts      | backend-api (1 file only)
infrastructure/main.tf            | infrastructure (1 file only)
.github/workflows/build.yml       | infrastructure (1 file only)

RESULT: Every path maps to EXACTLY ONE instruction file. Zero overlap.

ALWAYS-ON CONTEXT (copilot-instructions.md):
- ~970 tokens (from earlier optimization)
- Contains: platform, commands, architecture, response format, invariants,
  conventions, validation, delivery, security, dependencies, file size limits,
  naming anti-patterns

TOTAL CONTEXT PER INTERACTION:
- copilot-instructions.md: ~970 tokens (always)
- ONE path-specific file: ~500-1000 tokens (varies)
- TOTAL: ~1,500-2,000 tokens

vs. CURRENT: up to ~12,000 tokens for a component edit

SAVINGS: 80-85% reduction in instruction token overhead.

================================================================================
PART 4: copilot-instructions.md UPDATES (what to absorb from deleted files)
================================================================================

ADD to copilot-instructions.md (from anti-slop + validation-loops):

## Code Quality (always enforced)
- File limits: components <300 lines, utils <200, hooks <150
- No catch-all files (utils/helpers.ts, common/index.ts)
- No premature abstractions (factories, DI, interfaces with 1 impl)
- Names: domain-specific (belkaTax, nbpRate), no generics (data, info, item)
- No console.log (only console.error for genuine errors)
- No commented-out code, no TODO without issue reference

This adds ~150 tokens to copilot-instructions.md but REMOVES ~7,500 tokens 
(anti-slop 4KB + validation-loops 3.5KB) from always-on context.

NET SAVINGS: ~7,350 tokens removed from every interaction.

================================================================================
PART 5: IMPLEMENTATION ORDER
================================================================================

PHASE 1 — Create new copilot-instructions.md (already done in prior step)
  → Add Code Quality section from anti-slop

PHASE 2 — Create 7 new instruction files:
  1. react-components.instructions.md
  2. hooks-state-providers.instructions.md
  3. financial-calculations.instructions.md
  4. testing.instructions.md
  5. backend-api.instructions.md (minor edit — keep mostly as-is)
  6. infrastructure.instructions.md
  7. styling-tokens.instructions.md

PHASE 3 — Delete 14 old instruction files

PHASE 4 — Validate:
  - No path matches 0 files (coverage check)
  - No path matches >1 file (overlap check)
  - Each file <3 KB (except financial-calculations at ~4 KB)
  - Total instruction budget: copilot-instructions.md + 1 path file < 2,000 tokens

================================================================================
PART 6: POST-CREATION VALIDATION CRITERIA
================================================================================

For EACH new file, verify:
1. ❓ Is every rule grounded to actual Njord code? (no generic advice)
2. ❓ Does it reference actual file paths, function names, or patterns from the repo?
3. ❓ Would removing any line cause a real regression in code quality?
4. ❓ Is there ANY overlap with another instruction file's applyTo?
5. ❓ Is there ANY overlap with copilot-instructions.md content?
6. ❓ Could any content be removed because it's "obvious to an experienced dev"?
7. ❓ Are there Vercel/Anthropic/GitHub attribution paragraphs that add tokens but no value?

REJECTION CRITERIA (AI slop indicators):
- ❌ "When to Apply" meta-sections
- ❌ Priority tables with CRITICAL/MEDIUM/LOW
- ❌ Source attribution links
- ❌ "Rule Categories by Priority" tables
- ❌ Explanations of WHY a pattern is good (the model doesn't need motivation)
- ❌ Generic best practices not specific to this codebase
- ❌ Examples that restate what a formula already says
- ❌ "Do NOT" lists longer than 10 items (diminishing returns)

================================================================================
PART 7: TOKEN BUDGET SUMMARY
================================================================================

                        CURRENT                 AFTER REFACTOR
copilot-instructions.md ~1,800 tokens          ~1,100 tokens
anti-slop (applyTo:**)  ~1,000 tokens           0 (deleted, core rules in main)
validation-loops (**)   ~900 tokens             0 (deleted, split into domains)
Path-specific (1-10)    ~2,000-10,000 tokens    ~500-1,000 tokens (exactly 1 file)
                        -------------------     ---------------------
WORST CASE TOTAL:       ~13,700 tokens          ~2,100 tokens
TYPICAL CASE:           ~5,000 tokens           ~1,600 tokens

COST REDUCTION: 70-85% per prompt depending on file type being edited.

