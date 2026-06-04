#!/usr/bin/env bash
#
# Tear down the local Njord k3d cluster.

set -euo pipefail

CLUSTER_NAME="njord-dev-cluster"

log() { printf '\033[1;34m[teardown]\033[0m %s\n' "$*"; }

if ! command -v k3d >/dev/null 2>&1; then
  echo "ERROR: 'k3d' not found in PATH." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: 'jq' not found in PATH." >&2
  exit 1
fi

if ! k3d cluster list -o json 2>/dev/null | jq -e ".[] | select(.name == \"${CLUSTER_NAME}\")" >/dev/null; then
  log "Cluster '${CLUSTER_NAME}' does not exist. Nothing to do."
  exit 0
fi

log "Deleting cluster '${CLUSTER_NAME}'..."
k3d cluster delete "${CLUSTER_NAME}"
log "Cluster '${CLUSTER_NAME}' deleted."
