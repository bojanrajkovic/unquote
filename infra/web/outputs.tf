output "s3_bucket_name" {
  description = "S3 bucket name hosting the static files."
  value       = aws_s3_bucket.web.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (used in cache invalidations)."
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (e.g. d1234abcd.cloudfront.net)."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "github_deploy_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions for deployment."
  value       = aws_iam_role.github_web_deploy.arn
}
