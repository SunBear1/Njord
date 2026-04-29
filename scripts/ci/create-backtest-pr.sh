#!/usr/bin/env bash
set -euo pipefail

git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add backtest-history.csv
if git diff --cached --quiet; then
  printf 'No changes to commit, skipping PR\n'
  exit 0
fi
BRANCH="chore/backtest-$(date -u +%Y-%m-%d)-${RUN_ID}"
git checkout -b "$BRANCH"
git commit -m "chore: backtest metrics $(date -u +%Y-%m-%d)"
git push origin "$BRANCH"

# Detect if we're using a PAT (CI auto-triggers) or GITHUB_TOKEN (it won't)
PR_BODY="Automated daily backtest history update."
if [[ "${USING_PAT:-false}" != "true" ]]; then
  PR_BODY="$PR_BODY

> **Note:** CI checks won't start automatically (created with \`GITHUB_TOKEN\`).
> Close and reopen this PR to trigger checks, or add a \`PAT\` repo secret."
  printf '⚠ No PAT configured — CI will not auto-trigger on this PR.\n'
  printf '  Add a PAT repo secret (repo scope) for full automation.\n'
fi

PR_URL=$(gh pr create \
  --title "chore: backtest metrics $(date -u +%Y-%m-%d)" \
  --body "$PR_BODY" \
  --base main \
  --head "$BRANCH")
gh pr merge --auto --squash "$PR_URL"
