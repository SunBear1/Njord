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
