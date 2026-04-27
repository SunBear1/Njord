# Terraform Migration Plan

This document describes how to bootstrap Terraform state for the Cloudflare infrastructure
and how to import existing resources into Terraform management.

---

## What is managed by Terraform

| Resource | Terraform resource | Notes |
|----------|-------------------|-------|
| CF Pages project `njord` | `cloudflare_pages_project.njord` | GitHub integration, build config, D1 binding |
| D1 database `njord-users-db` | `cloudflare_d1_database.users_db` | Auth database |
| Terraform state | CF R2 bucket `njord-tf-state` | Must be bootstrapped manually |

**Not managed by Terraform:**
- Secrets (`JWT_SECRET`, OAuth keys, `TWELVE_DATA_API_KEY`) — set manually in CF Pages dashboard.
  The `pages.tf` config uses `lifecycle.ignore_changes` on `env_vars` to ensure Terraform never
  overrides or removes secrets set outside of Terraform.
- D1 migrations — applied with `wrangler d1 migrations apply njord-users-db --remote`
- Deployments — triggered automatically by CF Pages GitHub integration on push to `main`

---

## Step 1 — Create the R2 bucket for Terraform state

Terraform state is stored in a Cloudflare R2 bucket. This bucket must exist before running
`terraform init`.

Create it once via the CF dashboard or with Wrangler:

```bash
npx wrangler r2 bucket create njord-tf-state
```

---

## Step 2 — Create API credentials

You need two separate credentials:

### 2a. Cloudflare API token (for managing Pages + D1)

1. Go to **CF Dashboard → My Profile → API Tokens → Create Token**
2. Use **Custom token** with these permissions:
   - `Cloudflare Pages:Edit` (Account level)
   - `D1:Edit` (Account level)
   - `Account Settings:Read` (Account level)
3. Save the token — this is `CF_API_TOKEN`

### 2b. R2 API token (for Terraform state backend)

1. Go to **CF Dashboard → R2 → Manage R2 API Tokens → Create API Token**
2. Grant **Object Read & Write** permissions on bucket `njord-tf-state`
3. Save the **Access Key ID** and **Secret Access Key**

---

## Step 3 — Create `terraform.tfvars` (gitignored)

```bash
cd infrastructure
cat > terraform.tfvars <<EOF
cf_account_id = "<your CF account ID>"  # Found in CF dashboard URL: dash.cloudflare.com/<ACCOUNT_ID>
cf_api_token  = "<CF_API_TOKEN from step 2a>"
EOF
```

The `github_owner` and `github_repo` variables have defaults (`SunBear1` / `Njord`) and only
need to be set if the repository is ever renamed or transferred.

---

## Step 4 — Initialize Terraform

```bash
cd infrastructure

terraform init \
  -backend-config="endpoints={s3=\"https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com\"}" \
  -backend-config="access_key=<R2_ACCESS_KEY_ID>" \
  -backend-config="secret_key=<R2_SECRET_KEY>"
```

Replace `<CF_ACCOUNT_ID>`, `<R2_ACCESS_KEY_ID>`, and `<R2_SECRET_KEY>` with your values.

---

## Step 5 — Import existing resources

Both the Pages project and D1 database already exist in Cloudflare. Import them into
Terraform state instead of letting Terraform try to recreate them.

```bash
cd infrastructure

# Import the Pages project
terraform import \
  -var="cf_account_id=<CF_ACCOUNT_ID>" \
  cloudflare_pages_project.njord \
  <CF_ACCOUNT_ID>/njord

# Import the D1 database (ID is in wrangler.toml)
terraform import \
  -var="cf_account_id=<CF_ACCOUNT_ID>" \
  cloudflare_d1_database.users_db \
  <CF_ACCOUNT_ID>/7557d670-0d6f-4959-b99d-94b9368dc53d
```

---

## Step 6 — Verify the plan

After importing, run `terraform plan` to confirm Terraform sees no drift between the
`.tf` config and the live Cloudflare state:

```bash
terraform plan
```

The output should show **"No changes. Your infrastructure matches the configuration."**

If there are differences, adjust the values in `pages.tf` or `db.tf` to match the live state
before committing, then re-run `plan` until it is clean.

---

## Day-to-day usage

| Action | Command |
|--------|---------|
| Preview changes | `terraform plan` |
| Apply changes | `terraform apply` |
| Format all `.tf` files | `terraform fmt -recursive` |
| Refresh state from CF | `terraform refresh` |

`terraform apply` is intentionally not automated in CI. Run it manually after reviewing `plan`.

---

## GitHub Actions CI

The workflow `.github/workflows/terraform.yaml` runs `fmt-check → validate → plan` on every
pull request that touches files under `infrastructure/`. It requires the following GitHub
Actions secrets to be configured in the repository settings:

| Secret | Value |
|--------|-------|
| `CF_ACCOUNT_ID` | Your Cloudflare account ID |
| `CF_API_TOKEN` | API token from step 2a |
| `R2_ACCESS_KEY_ID` | R2 access key from step 2b |
| `R2_SECRET_KEY` | R2 secret key from step 2b |
