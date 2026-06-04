# Njord — Local Image & Versioning

## Single source of truth

- `VERSION` at repo root holds the current semver string (e.g. `0.1.0`).
- `release-please` (`.github/workflows/release-please.yml`) opens / merges
  release PRs that bump `VERSION` and `CHANGELOG.md` based on conventional
  commits merged to `main`. See `.release-please-config.json` and
  `.release-please-manifest.json`.

## Local build pipeline

```bash
./infrastructure/local/build-images.sh
```

What it does:

1. Reads `VERSION`.
2. Builds `njord-backend:<VERSION>` (multi-stage, distroless) and
   `njord-frontend:<VERSION>` (multi-stage, nginx-unprivileged:alpine).
3. Tags additional aliases: `:latest` and `:<MAJOR>.<MINOR>` (e.g. `0.1`).
4. Enforces image size budgets — backend ≤ 20 MiB, frontend ≤ 30 MiB. Override
   with `BACKEND_MAX_MB=… FRONTEND_MAX_MB=…`.
5. Imports `:<VERSION>` and `:latest` into the local k3d cluster
   (`NJORD_CLUSTER` env var, default `njord-dev-cluster`). Skips import if the
   cluster isn't running, or if `SKIP_IMPORT=1`.
6. Prints summary table (image, size).

Idempotent — re-running rebuilds + re-imports without manual cleanup.

## CI validation

`.github/workflows/local-image-validation.yml` runs on every PR that touches
backend, frontend, Dockerfiles, the build script, or the workflow itself. It
builds both images with `docker/build-push-action` (`push: false`) and
re-applies the size budgets. No registry push happens in CI — pushing to
ghcr.io is deferred to Epic 99.

## Helm chart wiring

Both charts default to `image.tag: "latest"` for local development so a fresh
`./infrastructure/local/build-images.sh` + `argocd app sync` picks up the new
image without modifying values. For pinning a release, override with
`--set image.tag=$(cat VERSION)` or let release-please bump the chart values
in a follow-up story.
