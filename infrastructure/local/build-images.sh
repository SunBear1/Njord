#!/usr/bin/env bash
# Build njord-frontend and njord-backend images from the version pinned in
# the repo-root VERSION file, then import them into the local k3d cluster.
#
# Idempotent: re-running rebuilds + re-imports. Cloud-side push (ghcr.io)
# is intentionally out of scope and deferred to Epic 99.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION_FILE="${ROOT_DIR}/VERSION"
CLUSTER_NAME="${NJORD_CLUSTER:-njord-dev-cluster}"

# Image size budgets enforced by acceptance criteria (Story 0.10).
BACKEND_MAX_MB="${BACKEND_MAX_MB:-20}"
FRONTEND_MAX_MB="${FRONTEND_MAX_MB:-30}"

if [[ ! -f "${VERSION_FILE}" ]]; then
  echo "ERROR: ${VERSION_FILE} missing — release-please owns this file." >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.+-]+)?$ ]]; then
  echo "ERROR: VERSION='${VERSION}' is not semver." >&2
  exit 1
fi

MAJOR_MINOR="$(echo "${VERSION}" | awk -F. '{ printf "%s.%s", $1, $2 }')"

echo "==> Building njord-backend ${VERSION}"
docker buildx build \
  --provenance=false --sbom=false \
  --load \
  -f "${ROOT_DIR}/backend/Dockerfile" \
  -t "njord-backend:${VERSION}" \
  -t "njord-backend:${MAJOR_MINOR}" \
  -t "njord-backend:latest" \
  "${ROOT_DIR}/backend"

echo "==> Building njord-frontend ${VERSION}"
docker buildx build \
  --provenance=false --sbom=false \
  --load \
  -f "${ROOT_DIR}/frontend/Dockerfile" \
  -t "njord-frontend:${VERSION}" \
  -t "njord-frontend:${MAJOR_MINOR}" \
  -t "njord-frontend:latest" \
  "${ROOT_DIR}"

# Size enforcement — fail fast if a layer regression blows the budget.
check_size() {
  local image="$1"
  local max_mb="$2"
  local bytes
  bytes="$(docker image inspect "${image}" --format '{{.Size}}')"
  local mb=$(( bytes / 1024 / 1024 ))
  if (( mb > max_mb )); then
    echo "ERROR: ${image} is ${mb} MiB, exceeds ${max_mb} MiB budget." >&2
    return 1
  fi
  printf '    %-40s %s MiB (budget %s)\n' "${image}" "${mb}" "${max_mb}"
}

echo "==> Verifying image size budgets"
check_size "njord-backend:${VERSION}" "${BACKEND_MAX_MB}"
check_size "njord-frontend:${VERSION}" "${FRONTEND_MAX_MB}"

if [[ "${SKIP_IMPORT:-0}" == "1" ]]; then
  echo "==> SKIP_IMPORT=1 — leaving images in local docker daemon only"
else
  if k3d cluster list -o json 2>/dev/null | grep -q "\"name\":[[:space:]]*\"${CLUSTER_NAME}\""; then
    echo "==> Importing images into k3d cluster '${CLUSTER_NAME}'"
    k3d image import \
      "njord-backend:${VERSION}" \
      "njord-backend:latest" \
      "njord-frontend:${VERSION}" \
      "njord-frontend:latest" \
      -c "${CLUSTER_NAME}"
  else
    echo "==> k3d cluster '${CLUSTER_NAME}' not running — skipping import"
  fi
fi

echo
echo "==> Build summary"
echo "    version       : ${VERSION}"
echo "    major.minor   : ${MAJOR_MINOR}"
docker image ls --format '    {{.Repository}}:{{.Tag}}\t{{.Size}}' \
  | grep -E '^\s*njord-(backend|frontend):' \
  | sort
