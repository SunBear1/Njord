# njord-postgres

Single-replica Postgres for Njord, introduced in **Story 0.3** of Epic 0.

## What it deploys

| Resource           | Name              | Notes                                            |
|--------------------|-------------------|--------------------------------------------------|
| `StatefulSet`      | `postgres`        | 1 replica, `postgres:16-alpine`, `nodeSelector: role=db-control` |
| `PersistentVolumeClaim` (via `volumeClaimTemplates`) | `data-postgres-0` | 10Gi, `storageClassName=local-path` |
| `Service` (ClusterIP) | `postgres`     | Port 5432                                        |
| `Secret`           | `postgres-secret` | `POSTGRES_USER=njord`, `POSTGRES_DB=njord`, generated `POSTGRES_PASSWORD` (stable across upgrades) |
| `ConfigMap`        | `postgres-config` | `postgresql.conf` overrides (`max_connections=50`, `shared_buffers=128MB`) |

## Install (local k3d)

```bash
helm install postgres infrastructure/helm/njord-postgres \
  --namespace njord-data --create-namespace

kubectl wait --for=condition=Ready pod/postgres-0 \
  -n njord-data --timeout=120s

# Smoke test
PG_PASS=$(kubectl get secret postgres-secret -n njord-data \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
kubectl exec -n njord-data postgres-0 -- \
  env PGPASSWORD="$PG_PASS" psql -U njord -d njord -c '\dt'
```

Backend pods reach Postgres at:

```
postgres://njord:<PASSWORD>@postgres.njord-data.svc.cluster.local:5432/njord
```

## Password management

The chart generates a 32-character random password on first install (via
`randAlphaNum`), then re-uses the existing Secret on subsequent `helm upgrade`
via the `lookup` template helper — so the password does not rotate on upgrade.

To pin an explicit password:

```yaml
postgres:
  auth:
    password: "super-secret"
```

## SealedSecrets (Epic 99 / cloud)

For the cloud deployment, do **not** generate the password via Helm — it would
end up in the manifest history. Instead:

1. Provision the password out-of-band (e.g. `pwgen 32`).
2. Encrypt with [Sealed Secrets](https://sealed-secrets.netlify.app/):

   ```bash
   kubectl create secret generic postgres-secret \
     --namespace njord-data \
     --from-literal=POSTGRES_USER=njord \
     --from-literal=POSTGRES_DB=njord \
     --from-literal=POSTGRES_PASSWORD="$PG_PASS" \
     --dry-run=client -o yaml \
     | kubeseal --controller-namespace njord-system \
                --format yaml \
     > infrastructure/sealed-secrets/postgres-secret.yaml
   ```

3. Commit `postgres-secret.yaml` and set `postgres.auth.password: ""` so the
   chart skips its own Secret rendering (introduce a `postgres.auth.useSealedSecret`
   toggle when this story is picked up — Epic 99).

## Validation

```bash
helm lint infrastructure/helm/njord-postgres
helm template postgres infrastructure/helm/njord-postgres \
  -n njord-data | kubectl apply --dry-run=client -f -
```
