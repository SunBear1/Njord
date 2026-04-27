resource "cloudflare_pages_project" "njord" {
  account_id        = var.cf_account_id
  name              = "njord"
  production_branch = "main"

  source = {
    type = "github"
    config = {
      owner                         = var.github_owner
      repo_name                     = var.github_repo
      production_branch             = "main"
      pr_comments_enabled           = true
      deployments_enabled           = true
      production_deployment_enabled = true
      preview_deployment_setting    = "custom"
      preview_branch_includes       = ["*"]
      preview_branch_excludes       = ["main"]
    }
  }

  build_config = {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "/"
  }

  deployment_configs = {
    production = {
      compatibility_date = "2024-01-01"
      d1_databases = {
        DB = { id = cloudflare_d1_database.users_db.id }
      }
    }
    preview = {
      compatibility_date = "2024-01-01"
      d1_databases = {
        DB = { id = cloudflare_d1_database.users_db.id }
      }
    }
  }

  lifecycle {
    # Secrets (JWT_SECRET, OAuth keys, TWELVE_DATA_API_KEY) are managed
    # manually in the CF dashboard and must never be overwritten by Terraform.
    ignore_changes = [
      deployment_configs[0].production[0].env_vars,
      deployment_configs[0].preview[0].env_vars,
    ]
  }
}
