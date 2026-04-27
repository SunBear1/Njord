variable "cf_account_id" {
  description = "Cloudflare account ID. Found in the CF dashboard URL or the Account Home page."
  type        = string
  sensitive   = true
}

# variable "cf_api_token" {
#   description = "Cloudflare API token. Requires Pages:Edit, D1:Edit, and Account Settings:Read permissions."
#   type        = string
#   sensitive   = true
# }

variable "github_owner" {
  description = "GitHub organization or username that owns the repository."
  type        = string
  default     = "SunBear1"
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "Njord"
}
