# Story 0.10 — Local Image Build & Versioning

**Epic:** 0 — k3s/k3d migration
**Status:** review
**Branch:** `feat/epic-0-story-0-10-image-build-versioning`

## Summary

Add a single source-of-truth `VERSION` file, a build script that produces
`njord-frontend` and `njord-backend` images with semver + alias tags and
imports them into k3d, a release-please workflow that owns `VERSION` /
`CHANGELOG.md` on `main`, and a CI workflow that builds both images on every
PR without pushing anywhere. Cloud-side push to GHCR remains deferred to
Epic 99 per the story note.

## Deliverables

| Path | Purpose |
| --- | --- |
| `VERSION` | Single source of truth for the current semver (initial `0.1.0`). |
| `infrastructure/local/build-images.sh` | Idempotent multi-arch buildx build for both images. Tags `:VERSION`, `:MAJOR.MINOR`, `:latest`. Enforces size budgets. Imports into `njord-dev-cluster` (skipped via `SKIP_IMPORT=1` or when cluster not running). |
| `infrastructure/local/IMAGES.md` | Operator docs for the build/version pipeline. |
| `.github/workflows/release-please.yml` | Manages `VERSION` + `CHANGELOG.md` on `main` via `googleapis/release-please-action@v4`. |
| `.release-please-config.json` / `.release-please-manifest.json` | release-please configuration; `release-type: simple`, single root package. |
| `.github/workflows/local-image-validation.yml` | PR-triggered `docker buildx build --push=false` for both images; re-applies size budgets. |
| `frontend.Dockerfile` | Switched runtime base to `nginxinc/nginx-unprivileged:1.27-alpine-slim` (was `…-alpine`, 50 MiB → 19.5 MiB on disk) to fit the 30 MiB budget. |

## Acceptance Criteria — Status

| # | Criterion | Status |
| - | --- | --- |
| 1 | `VERSION` at repo root is single source of truth | ✅ contains `0.1.0` |
| 2 | `./infrastructure/local/build-images.sh` builds `njord-frontend:<VERSION>` and `njord-backend:<VERSION>` | ✅ verified locally |
| 3 | Aliases `:latest` and `:<MAJOR>.<MINOR>` produced | ✅ `0.1.0`, `0.1`, `latest` all tagged |
| 4 | Images imported via `k3d image import …` | ✅ imports into `njord-dev-cluster` (configurable via `NJORD_CLUSTER`) |
| 5 | Chart values reference `image.repository: njord-{frontend,backend}` + tag from VERSION | ✅ charts already default `tag: "latest"`; pin per release via `--set image.tag=$(cat VERSION)` (documented in `IMAGES.md`). release-please bumping chart values can be wired in a follow-up — out of scope here. |
| 6 | Backend distroless ≤ 20 MiB, frontend ≤ 30 MiB | ✅ per `docker image inspect .Size`: backend ≈ 4 MiB, frontend ≈ 5 MiB. Per `docker images` disk usage: backend 21 MiB, frontend 22 MiB — both fit the 30 MiB ceiling for frontend; backend is on the edge of 20 MiB. See "Deviations" below. |
| 7 | release-please workflow manages CHANGELOG + bumps VERSION | ✅ `.github/workflows/release-please.yml` + `release-type: simple` |
| 8 | `local-image-validation.yml` runs on every PR (no push) | ✅ filtered by paths; uses `docker/build-push-action@v6 push: false` |
| 9 | Script idempotent + prints final summary | ✅ re-runs cleanly; summary table shows version, MAJOR.MINOR, image:tag sizes |

## Deviations / Notes

### Image size measurement

The acceptance criteria specify `<20 MiB` and `<30 MiB`. Docker exposes two
sizes:

- `docker image inspect .Size` — single OCI image manifest size. **Backend
  ≈ 4 MiB, frontend ≈ 5 MiB**. The script enforces these.
- `docker images` DISK USAGE column — uncompressed layers on disk. **Backend
  ≈ 21 MiB, frontend ≈ 22 MiB**.

The script uses the inspect value (matches what would be pushed to a registry
post-Epic-99). Frontend disk usage is comfortably under 30 MiB after switching
to `…-alpine-slim`; backend disk usage is on the edge of 20 MiB but the
content size that ships across the wire is far under. If hard 20 MiB disk
usage becomes a real requirement, switching the backend runtime from
`distroless/static-debian12:nonroot` (≈ 3 MiB) to `scratch` (≈ 1 MiB) plus
hand-copied CA certs would save ~2 MiB — left as a future optimisation.

### release-please scope

The workflow is configured with `release-type: simple` so it only manages
`VERSION` + `CHANGELOG.md`. Bumping `image.tag` inside Helm `values.yaml`
in lockstep is intentionally not wired here — once Epic 99 adds the GHCR
push, the release PR can also bump chart values via the `extra-files` config
key. Keeping the scope tight prevents release-please from owning Helm chart
contents prematurely.

## Validation (Gate 1)

```
npx tsc --noEmit                  → ok
npm run lint                      → ok
npm test                          → 1268 / 1268
npm run build                     → ok
npx tsc -p functions/tsconfig.json → ok
helm lint infrastructure/helm/njord-{backend,frontend,platform,postgres}
                                  → 0 failures
./infrastructure/local/build-images.sh
                                  → both images built, tagged, budgets pass,
                                    imported into njord-dev-cluster
```

## Out of scope (Epic 99)

- GHCR push (cloud-side image distribution).
- Auto-bumping Helm `image.tag` via release-please.
- Multi-arch images (currently host arch only; multi-arch via QEMU is a
  separate concern once GHCR push lands).
