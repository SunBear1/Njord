Migration Plan: Claude Rules to Copilot Instructions
Repository: https://github.com/SunBear1/Njord  
Goal: Consolidate all AI coding instructions into Copilot-native format only. Remove redundant Claude Code files.  
Target executor: Sonnet (via Copilot CLI)

Context for the Agent

The Njord repo currently has two parallel sets of AI coding instructions that do not talk to each other:

Claude Code files (ignored by Copilot CLI): CLAUDE.md + 9 files in .claude/rules/
Copilot files (the ones actually used): .github/copilot-instructions.md + 10 files in .github/instructions/

The owner uses Copilot CLI exclusively. Claude files are dead weight and the source of confusion. This plan migrates all unique Claude content into the Copilot structure, deduplicates, and deletes the Claude files.

Phase 1: Read All Source Files

Read every file listed below IN FULL before making any changes. Do not start writing until you have read all of them.

Claude files (source -- to be migrated then deleted)

CLAUDE.md
.claude/rules/react-development.md
.claude/rules/css-tailwind.md
.claude/rules/color-palette.md
.claude/rules/ui-ux-design.md
.claude/rules/efficiency-performance.md
.claude/rules/financial-correctness.md
.claude/rules/financial-methodology.md
.claude/rules/validation-loops.md
.claude/rules/anti-slop-quality.md

Copilot files (destination -- to be enriched or left as-is)

.github/copilot-instructions.md
.github/instructions/react-best-practices.instructions.md
.github/instructions/react-composition-patterns.instructions.md
.github/instructions/hooks-and-state.instructions.md
.github/instructions/design-tokens.instructions.md
.github/instructions/frontend-design.instructions.md
.github/instructions/web-interface-guidelines.instructions.md
.github/instructions/financial-math-guardian.instructions.md
.github/instructions/financial-forecasting.instructions.md
.github/instructions/backend-api.instructions.md
.github/instructions/webapp-testing.instructions.md

Phase 2: Merge CLAUDE.md into copilot-instructions.md

CLAUDE.md contains project-wide context. .github/copilot-instructions.md already exists with similar content. Merge them.

Steps

Open both files side by side
Identify content in CLAUDE.md that is not already present in copilot-instructions.md
Append only the missing sections. Likely candidates:
   - The "Critical Invariants" list (8 never-violate rules)
   - The directory structure ASCII diagram (if more detailed than existing)
   - The rules reference table (pointing to instruction files instead of .claude/rules/)
Reword any mention of "Claude" to tool-agnostic language ("you", "the assistant")
Remove the "Rules (detailed in .claude/rules/)" section entirely -- those rules will live in .github/instructions/ instead
Do NOT add YAML frontmatter to this file. It is plain markdown.

Critical Invariants to add (if missing)

These 8 rules from CLAUDE.md are hard constraints. Ensure they appear in copilot-instructions.md:

Belka tax = 19% on PROFIT only, never on principal
FX x stock deltas are multiplicative: (1+dS) * (1+dFX), never additive
NBP rate = last business day BEFORE transaction, never the transaction date
No global state -- pages own state, pass via props
Pure financial functions -- no fetch, no localStorage, no DOM in src/utils/
UI in Polish, code in English -- no mixing
Tailwind tokens only -- no hardcoded colors, no CSS modules
All tests pass before commit: npm run lint && npm test && npm run build

Phase 3: Migrate Claude Rules -- Deduplicate, Don't Duplicate

The .github/instructions/ directory already has 10 instruction files. Several overlap with the Claude rules. For each Claude rule, you must READ the overlapping Copilot file first, then decide: MERGE into existing or CREATE new.

Decision matrix

| # | Claude rule | Overlapping Copilot file(s) | Action |
|---|---|---|---|
| 1 | react-development.md | react-best-practices.instructions.md, react-composition-patterns.instructions.md, hooks-and-state.instructions.md | MERGE -- Read all 3 Copilot files. Append any rules from the Claude file that are missing. Do NOT create a 4th React file. |
| 2 | css-tailwind.md | frontend-design.instructions.md | MERGE if frontend-design covers Tailwind. Otherwise CREATE css-tailwind.instructions.md with applyTo: "src//.tsx,src//.css" |
| 3 | color-palette.md | design-tokens.instructions.md | MERGE -- Append missing color definitions, contrast rules, dark mode tokens |
| 4 | ui-ux-design.md | frontend-design.instructions.md, web-interface-guidelines.instructions.md | MERGE -- Distribute rules to the most appropriate existing file |
| 5 | efficiency-performance.md | None | CREATE efficiency-performance.instructions.md with applyTo: "src/" |
| 6 | financial-correctness.md | financial-math-guardian.instructions.md | MERGE -- Append tax law, FX, rounding constraints |
| 7 | financial-methodology.md | financial-forecasting.instructions.md | MERGE -- Append GBM, Bootstrap, HMM model specs |
| 8 | validation-loops.md | webapp-testing.instructions.md (partial) | CHECK overlap. If webapp-testing covers lint/build gates, MERGE. If it only covers Vitest/Playwright, CREATE validation-loops.instructions.md with applyTo: "" |
| 9 | anti-slop-quality.md | None | CREATE anti-slop-quality.instructions.md with applyTo: "" |

Copilot instruction file format

Every .instructions.md file must have this structure:

applyTo: "<glob>"
Title

<instruction content>


The applyTo glob tells Copilot CLI when to load this file. Use commas for multiple patterns: "src//.tsx,src//.css".

Content rewriting rules

Replace "Claude" with "you" or remove the reference
Remove meta-instructions about Claude's reasoning process
Keep ALL technical rules, conventions, code examples exactly as-is
Preserve markdown formatting
Keep files under 200 lines each -- Copilot context windows are limited

Phase 4: Verify Consistency

After all merges and creates are done:

List all files in .github/instructions/ -- confirm no duplicates by topic
Check that every applyTo glob is valid and does not conflict with another file's glob in a contradictory way
Confirm copilot-instructions.md does NOT duplicate rules that already exist in scoped instruction files -- keep it focused on project-wide context
Run find .claude -type f -- should return nothing (directory should be deleted in Phase 5)
Confirm CLAUDE.md content has been fully absorbed

Phase 5: Delete Claude Files

rm CLAUDE.md
rm -rf .claude/


Then verify:

These should exist:
ls .github/copilot-instructions.md
ls .github/instructions/*.instructions.md
ls .github/agents/
ls .github/skills/

These should NOT exist:
test -f CLAUDE.md && echo "ERROR: CLAUDE.md still exists"
test -d .claude && echo "ERROR: .claude/ still exists"


Phase 6: Commit

Create a single commit with a clear message:

chore: migrate Claude rules to Copilot instructions

Merge CLAUDE.md content into .github/copilot-instructions.md
Merge 9 Claude rule files into existing Copilot instruction files
Create new instruction files for rules with no existing counterpart
Delete CLAUDE.md and .claude/ directory

The repo now uses only Copilot-native instruction formats.


Final File Inventory

Expected state after migration

.github/
  copilot-instructions.md              # Enriched with CLAUDE.md content
  copilot-setup-steps.yml              # Unchanged
  agents/                              # Unchanged
  skills/polish-belka-tax/             # Unchanged
  instructions/
    react-best-practices.instructions.md       # Enriched from react-development.md
    react-composition-patterns.instructions.md # Enriched from react-development.md
    hooks-and-state.instructions.md            # Enriched from react-development.md
    design-tokens.instructions.md              # Enriched from color-palette.md
    frontend-design.instructions.md            # Enriched from css-tailwind.md + ui-ux-design.md
    web-interface-guidelines.instructions.md   # Enriched from ui-ux-design.md
    financial-math-guardian.instructions.md    # Enriched from financial-correctness.md
    financial-forecasting.instructions.md      # Enriched from financial-methodology.md
    backend-api.instructions.md                # Unchanged
    webapp-testing.instructions.md             # Possibly enriched from validation-loops.md
    efficiency-performance.instructions.md     # NEW
    anti-slop-quality.instructions.md          # NEW
    validation-loops.instructions.md           # NEW (only if webapp-testing doesn't cover it)


Deleted

CLAUDE.md                              # Deleted
.claude/                               # Deleted (entire directory)
