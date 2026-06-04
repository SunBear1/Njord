# Local Infrastructure — Njord Dev Cluster

Scripts for managing a local 2-node k3d cluster that mirrors the planned
OCI A1.Flex topology for Njord. Use this for all local development of
Helm charts, ArgoCD manifests, and backend services before any cloud spend.

## Cluster Layout

| Node                              | Role             | CPU | RAM   | Purpose                              |
| --------------------------------- | ---------------- | --- | ----- | ------------------------------------ |
| `k3d-njord-dev-cluster-server-0`  | `role=db-control`| 2   | 16 GB | k3s control plane, ArgoCD, Postgres  |
| `k3d-njord-dev-cluster-agent-0`   | `role=app`       | 2   |  8 GB | frontend (nginx), backend (Go)       |

Total: 4 CPU / 24 GB — exact match for the OCI Always Free Tier
(Ampere A1.Flex) we plan to use in Epic 99 production deployment.

## Prerequisites

- **Docker Desktop** with WSL2 backend running
- **k3d** v5.0+ (`k3d version` to verify)
- **kubectl**
- **jq**

The bootstrap script will fail fast with a clear message if any are missing.

## Usage

### Create the cluster

```bash
./infrastructure/local/bootstrap.sh
```

Idempotent: re-running detects an existing cluster and exits 0. To start
fresh, tear down first.

### Tear down the cluster

```bash
./infrastructure/local/teardown.sh
```

### Verify

```bash
kubectl get nodes --show-labels
kubectl describe nodes | grep -E '^Name:|^  cpu:|^  memory:'
```

Expected: two nodes Ready, server node showing `memory: ~16Gi cpu: 2`,
agent node showing `memory: ~8Gi cpu: 2`.

## Implementation Notes

- **Memory limits** are applied natively via `k3d cluster create --servers-memory`
  / `--agents-memory`.
- **CPU limits** require a post-create `docker update --cpus` workaround
  because k3d has no native CPU flag ([k3d#693](https://github.com/k3d-io/k3d/issues/693)).
- **Traefik** is disabled at bootstrap (it'll be reinstalled via Helm in
  Story 0.4 with project-specific IngressRoute configuration).
- **ServiceLB (Klipper)** is disabled because k3d ships its own loadbalancer
  container that handles `--port` mappings; the bundled k3s ServiceLB
  would conflict.
- **Ports 80 and 443** are mapped from host to the k3d loadbalancer container,
  which forwards to the in-cluster ingress (once installed).

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `docker info` fails | Docker Desktop not running | Start Docker Desktop, ensure WSL2 integration enabled |
| Nodes not Ready in 90s | Slow image pull | Re-run; first run downloads the k3s image |
| `docker update` warns | Cgroup v1 host or rootless docker | CPU limit is best-effort; cluster still works |
| Port 80/443 already in use | Local web server | Stop conflicting service or change ports in `bootstrap.sh` |
