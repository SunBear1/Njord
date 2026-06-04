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

echo "==> Seeding bootstrap secrets in njord-data + njord-app (ArgoCD repo-server can't `lookup`)"
kubectl create namespace njord-data --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace njord-app --dry-run=client -o yaml | kubectl apply -f -

# Helper: annotate the secret so ArgoCD never touches/prunes it. The chart
# templates skip rendering when `lookup` returns nil, so once these secrets
# exist they're owned by this bootstrap script, NOT by Helm/ArgoCD.
annotate_unmanaged() {
  local namespace="$1" secret="$2"
  kubectl -n "${namespace}" annotate secret "${secret}" \
    'argocd.argoproj.io/sync-options=Prune=false' \
    'argocd.argoproj.io/compare-options=IgnoreExtraneous' \
    --overwrite >/dev/null
}

# njord-data/postgres-secret: source of truth for the postgres role password.
if ! kubectl -n njord-data get secret postgres-secret >/dev/null 2>&1; then
  PG_USER="${POSTGRES_USER:-njord}"
  PG_DB="${POSTGRES_DB:-njord}"
  PG_PASS=$(openssl rand -base64 24 | tr -d '\n=+/')
  kubectl -n njord-data create secret generic postgres-secret \
    --from-literal=POSTGRES_USER="${PG_USER}" \
    --from-literal=POSTGRES_DB="${PG_DB}" \
    --from-literal=POSTGRES_PASSWORD="${PG_PASS}"
  echo "    created njord-data/postgres-secret"
else
  echo "    njord-data/postgres-secret already exists; left untouched"
fi
annotate_unmanaged njord-data postgres-secret

# JWT secret: stable across reconciles; only create if missing.
if ! kubectl -n njord-app get secret njord-auth-secret >/dev/null 2>&1; then
  JWT=$(openssl rand -base64 48 | tr -d '\n' | head -c 64)
  kubectl -n njord-app create secret generic njord-auth-secret \
    --from-literal=JWT_SECRET="${JWT}"
  echo "    created njord-auth-secret"
else
  echo "    njord-auth-secret already exists; left untouched"
fi
annotate_unmanaged njord-app njord-auth-secret

# njord-app/postgres-secret: mirror from njord-data.
PG_USER=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)
PG_PASS=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
PG_DB=$(kubectl -n njord-data get secret postgres-secret -o jsonpath='{.data.POSTGRES_DB}' | base64 -d)
kubectl -n njord-app create secret generic postgres-secret \
  --from-literal=POSTGRES_USER="${PG_USER}" \
  --from-literal=POSTGRES_PASSWORD="${PG_PASS}" \
  --from-literal=POSTGRES_DB="${PG_DB}" \
  --dry-run=client -o yaml | kubectl apply -f -
annotate_unmanaged njord-app postgres-secret
echo "    mirrored postgres-secret njord-data -> njord-app"

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
