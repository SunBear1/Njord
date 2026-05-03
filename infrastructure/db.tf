resource "cloudflare_d1_database" "users_db" {
  account_id = var.cf_account_id
  name       = "njord-users-db"
  read_replication = {
    mode = "disabled"
  }
}

resource "cloudflare_d1_database" "finance_data" {
  account_id = var.cf_account_id
  name       = "finance-data-db"
  read_replication = {
    mode = "disabled"
  }
}

resource "null_resource" "finance_db_schema" {
  depends_on = [cloudflare_d1_database.finance_data]

  provisioner "local-exec" {
    command = "npx wrangler d1 execute ${cloudflare_d1_database.finance_data.name} --remote --file=./sql/schema.sql"
  }

  triggers = {
    schema_hash = filesha256("${path.module}/../sql/schema.sql")
  }
}
