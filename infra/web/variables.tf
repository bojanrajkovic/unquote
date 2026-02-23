variable "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider already registered in this AWS account. Create it once with: aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1"
  type        = string
}

variable "api_url" {
  description = "Base URL of the deployed Unquote API (no trailing slash). Injected as VITE_API_URL at build time via GitHub Actions variable API_URL."
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name (without owner prefix)."
  type        = string
  default     = "unquote"
}

variable "aws_region" {
  description = "AWS region for S3 bucket (CloudFront is global)."
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for the web frontend (e.g. playunquote.com)."
  type        = string
  default     = "playunquote.com"
}

variable "domain_contact" {
  description = "Contact details for domain registration. Used for admin, registrant, and tech contacts."
  type = object({
    first_name   = string
    last_name    = string
    email        = string
    phone_number = string # E.164 format: +1.5555555555
    address_line = string
    city         = string
    state        = string
    zip_code     = string
    country_code = string                     # ISO 3166-1 alpha-2: US, GB, etc.
    contact_type = optional(string, "PERSON") # PERSON, COMPANY, ASSOCIATION, PUBLIC_BODY
  })
  sensitive = true
}
