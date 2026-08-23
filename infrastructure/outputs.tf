output "pages_project_subdomain" {
  description = "The *.pages.dev subdomain for the Pages project."
  value       = cloudflare_pages_project.njord.subdomain
}

output "d1_database_id" {
  description = "The AUTH_DB (njord-users-db) database ID. Must match wrangler.toml's AUTH_DB entry."
  value       = cloudflare_d1_database.users_db.id
}

output "finance_db_id" {
  description = "The FINANCE_DB (finance-data-db) database ID. Must match wrangler.toml's FINANCE_DB entry."
  value       = cloudflare_d1_database.finance_data.id
}
