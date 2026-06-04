#!/usr/bin/env bash
#
# Bootstrap a local 2-node k3d cluster for Njord development.
# Mirrors the planned OCI A1.Flex topology:
#   - server node (role=db-control): 2 CPU / 16 GB RAM
#   - agent  node (role=app):        2 CPU /  8 GB RAM
#
# Re-run is idempotent: detects existing cluster and exits 0.
# To start fresh: run `./infrastructure/local/teardown.sh` first.

set -euo pipefail

CLUSTER_NAME="njord-dev-cluster"
SERVER_MEM="16g"
AGENT_MEM="8g"
SERVER_CPUS="2"
AGENT_CPUS="2"

# --- helpers -----------------------------------------------------------------

log()  { printf '\033[1;34m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[bootstrap]\033[0m WARN: %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[bootstrap]\033[0m ERROR: %s\n' "$*" >&2; }

require_cmd() {
  local name="$1" hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    err "'$name' not found in PATH. $hint"
    exit 1
  fi
}

# --- prereq checks -----------------------------------------------------------

log "Checking prerequisites..."
require_cmd docker  "Install Docker Desktop with WSL2 backend."
require_cmd k3d     "Install: https://k3d.io/#installation"
require_cmd kubectl "Install: https://kubernetes.io/docs/tasks/tools/"
require_cmd jq      "Install: sudo apt install jq"

if ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not reachable. Is Docker Desktop running?"
  exit 1
fi

# --- idempotence check -------------------------------------------------------

if k3d cluster list -o json 2>/dev/null | jq -e ".[] | select(.name == \"${CLUSTER_NAME}\")" >/dev/null; then
  log "Cluster '${CLUSTER_NAME}' already exists. Skipping create."
  log "To start fresh, run: ./infrastructure/local/teardown.sh"
  exit 0
fi

# --- cluster create ----------------------------------------------------------

log "Creating k3d cluster '${CLUSTER_NAME}' (1 server + 1 agent)..."
log "  server: ${SERVER_CPUS} CPU / ${SERVER_MEM} RAM (role=db-control)"
log "  agent : ${AGENT_CPUS} CPU / ${AGENT_MEM} RAM (role=app)"

k3d cluster create "${CLUSTER_NAME}" \
  --servers 1 --agents 1 \
  --servers-memory "${SERVER_MEM}" \
  --agents-memory "${AGENT_MEM}" \
  --k3s-arg "--disable=traefik@server:0" \
  --k3s-arg "--disable=servicelb@server:0" \
  --k3s-arg "--node-label=role=db-control@server:0" \
  --k3s-arg "--node-label=role=app@agent:0" \
  --port "80:80@loadbalancer" \
  --port "443:443@loadbalancer" \
  --wait

# --- CPU constraints (k3d lacks native flag, apply via docker update) --------

log "Applying CPU constraints via docker update..."
if ! docker update --cpus="${SERVER_CPUS}" "k3d-${CLUSTER_NAME}-server-0" >/dev/null; then
  warn "Failed to apply CPU limit to server-0. Cluster is still usable."
fi
if ! docker update --cpus="${AGENT_CPUS}" "k3d-${CLUSTER_NAME}-agent-0" >/dev/null; then
  warn "Failed to apply CPU limit to agent-0. Cluster is still usable."
fi

# --- readiness wait ----------------------------------------------------------

log "Waiting for nodes to be Ready (timeout 90s)..."
if ! kubectl wait --for=condition=Ready node --all --timeout=90s; then
  err "Nodes did not reach Ready state in time."
  kubectl get nodes
  exit 1
fi

# --- summary -----------------------------------------------------------------

echo
log "Cluster ready. Summary:"
echo "  Name:       ${CLUSTER_NAME}"
echo "  Kubeconfig: $(k3d kubeconfig write "${CLUSTER_NAME}")"
echo
log "Nodes:"
kubectl get nodes -L role -o wide
echo
log "Capacity (verify limits applied):"
kubectl describe nodes | grep -E '^Name:|^  cpu:|^  memory:' | head -20
echo
log "Next step:"
echo "  kubectl get nodes"
echo "  # then proceed to Story 0.3 (Postgres Helm chart)"
