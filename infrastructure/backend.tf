terraform {
  backend "s3" {
    bucket = "njord-tf-state"
    key    = "terraform.tfstate"
    region = "auto"

    # Cloudflare R2 endpoint
    endpoints = {
      s3 = "https://${var.cf_account_id}.r2.cloudflarestorage.com"
    }

    # R2 doesn't support these features
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
  }
}
