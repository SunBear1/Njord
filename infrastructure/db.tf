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
    command = "wrangler d1 execute ${cloudflare_d1_database.finance_data.name} --remote --file=./schema.sql"
  }

  triggers = {
    schema_hash = filesha256("${path.module}/schema.sql")
  }
}

resource "null_resource" "auth_db_schema" {
  depends_on = [cloudflare_d1_database.users_db]

  provisioner "local-exec" {
    command = join(" && ", [
      "wrangler d1 execute ${cloudflare_d1_database.users_db.name} --remote --file=../migrations/0001_create_users.sql",
      "wrangler d1 execute ${cloudflare_d1_database.users_db.name} --remote --file=../migrations/0002_create_holdings.sql",
      "wrangler d1 execute ${cloudflare_d1_database.users_db.name} --remote --file=../migrations/0003_add_stock_asset_class.sql",
    ])
  }

  triggers = {
    schema_hash = join("-", [
      filesha256("${path.module}/../migrations/0001_create_users.sql"),
      filesha256("${path.module}/../migrations/0002_create_holdings.sql"),
      filesha256("${path.module}/../migrations/0003_add_stock_asset_class.sql"),
    ])
  }
}
