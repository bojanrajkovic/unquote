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

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL associated with the CloudFront distribution."
  value       = aws_wafv2_web_acl.web.arn
}

output "domain_name" {
  description = "Registered domain name for the web frontend."
  value       = var.domain_name
}

output "hosted_zone_id" {
  description = "Route 53 hosted zone ID for DNS management."
  value       = data.aws_route53_zone.web.zone_id
}

output "hosted_zone_nameservers" {
  description = "Nameservers for the hosted zone."
  value       = data.aws_route53_zone.web.name_servers
}

output "acm_certificate_arn" {
  description = "ARN of the ACM TLS certificate for CloudFront."
  value       = aws_acm_certificate.web.arn
}
