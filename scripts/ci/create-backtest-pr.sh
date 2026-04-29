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
PR_URL=$(gh pr create \
  --title "chore: backtest metrics $(date -u +%Y-%m-%d)" \
  --body "Automated daily backtest history update." \
  --base main \
  --head "$BRANCH")
gh pr merge --auto --squash "$PR_URL"
