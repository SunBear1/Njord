#!/usr/bin/env bash
set -euo pipefail

git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add backtest-history.csv
if git diff --cached --quiet; then
  printf 'No changes to commit.\n'
  exit 0
fi
git commit -m "chore: backtest metrics $(date -u +%Y-%m-%d)"
git push origin HEAD:refs/heads/main
