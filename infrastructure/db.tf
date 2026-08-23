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

locals {
  # Every migration file, applied in filename order — add a new migrations/000N_*.sql
  # file and it's picked up automatically, no edits needed here.
  auth_migration_files = sort(fileset("${path.module}/../migrations", "*.sql"))
}

resource "null_resource" "auth_db_schema" {
  depends_on = [cloudflare_d1_database.users_db]

  provisioner "local-exec" {
    command = join(" && ", [
      for f in local.auth_migration_files :
      "wrangler d1 execute ${cloudflare_d1_database.users_db.name} --remote --file=../migrations/${f}"
    ])
  }

  triggers = {
    schema_hash = join("-", [
      for f in local.auth_migration_files : filesha256("${path.module}/../migrations/${f}")
    ])
  }
}
