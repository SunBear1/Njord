resource "cloudflare_d1_database" "users_db" {
  account_id = var.cf_account_id
  name       = "njord-users-db"
  read_replication = {
    mode = "disabled"
  }
}
