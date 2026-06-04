---
description: Bash scripting rules for infrastructure and tooling scripts. Apply when editing any .sh file in the repo.
applyTo: "infrastructure/**/*.sh,scripts/**/*.sh"
---

# Bash scripting rules

Tags: **MUST** (enforced) · **SHOULD** (convention).

## Shebang & set flags

- **MUST**: `#!/usr/bin/env bash` — never `#!/bin/bash`.
- **MUST**: `set -euo pipefail` on every non-lib script.
- **MUST**: lib files (`*/lib/*.sh`) use `set -e` only — no `-u`, they are sourced.

## Script structure (non-lib)

- **MUST**: functional structure — define `function main()`, invoke at the bottom as `main "$@"`.
- **MUST**: define `function validateParameters()` for input validation, called first inside `main()`. Sets `readonly` constants derived from inputs.

```bash
function validateParameters() {
  if [[ -z "${CLUSTER_NAME:-}" ]]; then
    printf "Error: CLUSTER_NAME must be set.\n" >&2
    exit 1
  fi
  readonly CLUSTER="${CLUSTER_NAME}"
}

function main() {
  validateParameters
  # ... rest of logic
}

main "$@"
```

## Functions

- **MUST**: use the `function` keyword — `function foo() { ... }`, not `foo() { ... }`.
- **MUST**: declare `local` on a line separate from assignment, to avoid masking exit codes under `set -e`.

```bash
# WRONG — local masks the non-zero exit of the subshell
local result="$(some_command)"

# CORRECT
local result
result="$(some_command)"
```

- **MUST**: `return` inside functions; `exit` only at top-level script logic.
- **SHOULD**: descriptive snake_case names.

## Variables

- **MUST**: always quote: `"${VAR}"` — never bare `$VAR`.
- **MUST**: `set -u` is active — every possibly-unset reference uses default syntax `"${VAR:-}"` or `"${VAR:-default}"`.
- **MUST**: constants declared `readonly UPPER_CASE=...`.
- **MUST**: module-level mutable vars use `UPPER_CASE` without `readonly`.

## Output

- **MUST**: use `printf` — never `echo`.
- **MUST**: error messages to stderr: `printf "Error: ...\n" >&2`.
- **SHOULD**: prefix log lines with bracketed script tag, e.g. `[bootstrap] ...`.

## Error handling

- **MUST**: explicit `exit 1` with a stderr message on failure.
- **SHOULD**: no `trap` usage.
- **SHOULD**: prefer early returns / guard clauses over nested conditionals.

## Conditionals

- **MUST**: `$(...)` for command substitution — never backticks.
- **SHOULD**: `[[ ]]` for conditionals; `[ ]` accepted for simple POSIX checks.
- Pattern matching: `[[ "${VAR}" == *"substring"* ]]`.

## Formatting

- **MUST**: 2-space indentation. If `shfmt` available locally: `shfmt -i 2 -w <file>`.
- **MUST**: validate with `bash -n <file>` before commit.
- **SHOULD**: pass `shellcheck` if installed; suppress per-line only with justification comment.

## Argument parsing

- **MUST**: named flags only — never positional args for required parameters.

```bash
while [[ $# -gt 0 ]]; do
  case "$1" in
  --cluster-name)
    CLUSTER_NAME="$2"
    shift 2
    ;;
  *)
    printf "Error: Unknown argument: %s\n" "$1" >&2
    exit 1
    ;;
  esac
done
```

## Sourcing shared libraries (when added)

- **MUST**: resolve repo root before sourcing; always use absolute paths.
- **MUST**: always `source`, never `.`.

```bash
if [[ -z "${REPO_ROOT:-}" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
fi
export REPO_ROOT
# shellcheck disable=SC1091
source "${REPO_ROOT}/infrastructure/lib/helpers.sh"
```

## Here-docs

- **SHOULD**: use `<<EOF`; unique delimiters when nested (EOF1, EOF2).
- Quote delimiter `'EOF'` to suppress variable expansion.

## Idempotence

- **MUST**: cluster/infra scripts must detect existing state and exit 0 with a clear message — never error on re-run.
