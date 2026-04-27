output "pages_project_subdomain" {
  description = "The *.pages.dev subdomain for the Pages project."
  value       = cloudflare_pages_project.njord.subdomain
}

output "d1_database_id" {
  description = "The D1 database ID. Should match the database_id in wrangler.toml."
  value       = cloudflare_d1_database.users_db.id
}
