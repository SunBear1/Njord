resource "cloudflare_pages_project" "njord" {
  account_id        = var.cf_account_id
  name              = "njord"
  production_branch = "main"

  source = {
    type = "github"
    config = {
      owner                          = var.github_owner
      repo_name                      = var.github_repo
      production_branch              = "main"
      pr_comments_enabled            = true
      production_deployments_enabled = true
      preview_deployment_setting     = "none"
      preview_branch_includes        = ["*"]
      path_includes                  = ["*"]
    }
  }

  build_config = {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = ""
    build_caching   = false
  }

  deployment_configs = {
    production = {
      compatibility_date = "2026-05-03"
      d1_databases = {
        DB = { id = cloudflare_d1_database.users_db.id },
        FINANCE_DB = { id = cloudflare_d1_database.finance_data.id }
      }
      placement = {
        mode = "smart"
      }
    }
    preview = {
      compatibility_date = "2026-05-03"
      d1_databases = {
        DB = { id = cloudflare_d1_database.users_db.id },
        FINANCE_DB = { id = cloudflare_d1_database.finance_data.id }
      }
    }
  }

  lifecycle {
    # Secrets (JWT_SECRET, OAuth keys, TWELVE_DATA_API_KEY) are managed
    # manually in the CF dashboard and must never be overwritten by Terraform.
    ignore_changes = [
      deployment_configs.production.env_vars,
      deployment_configs.preview.env_vars,
    ]
  }
}
