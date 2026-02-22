terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  # Region for S3 + CloudFront resources.
  # CloudFront ACM certificates must be in us-east-1, but CloudFront itself
  # is global. S3 bucket can be in any region.
  region = "eu-west-1"
}

provider "github" {
  # Reads GITHUB_TOKEN from environment at apply time.
  # Token needs: repo (for Actions variables) scope.
  owner = "brajkovic"
}
