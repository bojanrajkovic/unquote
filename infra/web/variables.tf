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
