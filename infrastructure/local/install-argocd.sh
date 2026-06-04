#!/usr/bin/env bash
# Install ArgoCD into the local k3d cluster with a local admin/test login.
# Idempotent: re-running upgrades to the same chart version.

set -euo pipefail

ARGOCD_CHART_VERSION="${ARGOCD_CHART_VERSION:-9.5.18}"
NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"

# bcrypt hash of the literal string "test" (cost=10). LOCAL DEV ONLY.
# Cloudflare Access SSO is the production story (Epic 99); the hash is
# inlined so the script has no Python/htpasswd runtime dependency.
ADMIN_PASSWORD_HASH='$2b$10$KPJTlkpsXgjF1mBX9soKYO3pCP84gMSuZby6CmH3Nr96GZiTauhMu'

echo "==> Adding argo helm repo"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
helm repo update argo >/dev/null

echo "==> Installing argo-cd ${ARGOCD_CHART_VERSION} into ${NAMESPACE}"
helm upgrade --install argocd argo/argo-cd \
  --version "${ARGOCD_CHART_VERSION}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  --set "configs.secret.argocdServerAdminPassword=${ADMIN_PASSWORD_HASH}" \
  --set 'configs.secret.argocdServerAdminPasswordMtime=2026-06-04T00:00:00Z' \
  --set 'server.extraArgs={--insecure}' \
  --wait --timeout 5m

echo "==> Seeding bootstrap secrets in njord-app (ArgoCD repo-server can't `lookup`)"
kubectl create namespace njord-app --dry-run=client -o yaml | kubectl apply -f -

# JWT secret: stable across reconciles; only create if missing.
if ! kubectl -n njord-app get secret njord-auth-secret >/dev/null 2>&1; then
  JWT=$(openssl rand -base64 48 | tr -d '\n' | head -c 64)
  kubectl -n njord-app create secret generic njord-auth-secret \
    --from-literal=JWT_SECRET="${JWT}"
  echo "    created njord-auth-secret"
else
  echo "    njord-auth-secret already exists; left untouched"
fi

# Postgres mirror: copy from njord-data if it exists.
if kubectl -n njord-data get secret postgres-secret >/dev/null 2>&1; then
  PG_USER=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)
  PG_PASS=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
  PG_DB=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_DB}' | base64 -d)
  kubectl -n njord-app create secret generic postgres-secret \
    --from-literal=POSTGRES_USER="${PG_USER}" \
    --from-literal=POSTGRES_PASSWORD="${PG_PASS}" \
    --from-literal=POSTGRES_DB="${PG_DB}" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "    mirrored postgres-secret from njord-data"
else
  echo "    njord-data/postgres-secret not yet present; app-postgres will create it, re-run this script after."
fi

echo "==> Bootstrapping app-of-apps"
helm template app-of-apps "$(dirname "$0")/../argocd" \
  --set global.repoURL="${REPO_URL:-https://github.com/SunBear1/Njord}" \
  --set global.targetRevision="${TARGET_REVISION:-main}" \
  | kubectl apply -n "${NAMESPACE}" -f -

cat <<EOF

ArgoCD is installed.

UI:  kubectl port-forward -n ${NAMESPACE} svc/argocd-server 8080:443
     Then visit http://localhost:8080 (admin / test).

CLI: argocd login localhost:8080 --username admin --password test --insecure
EOF
