data "aws_caller_identity" "current" {}

# ─── Domain Registration ─────────────────────────────────────────────────────

resource "aws_route53domains_domain" "web" {
  domain_name       = var.domain_name
  duration_in_years = 1
  auto_renew        = true
  transfer_lock     = true

  admin_contact {
    first_name     = var.domain_contact.first_name
    last_name      = var.domain_contact.last_name
    email          = var.domain_contact.email
    phone_number   = var.domain_contact.phone_number
    address_line_1 = var.domain_contact.address_line
    city           = var.domain_contact.city
    state          = var.domain_contact.state
    zip_code       = var.domain_contact.zip_code
    country_code   = var.domain_contact.country_code
    contact_type   = var.domain_contact.contact_type
  }

  registrant_contact {
    first_name     = var.domain_contact.first_name
    last_name      = var.domain_contact.last_name
    email          = var.domain_contact.email
    phone_number   = var.domain_contact.phone_number
    address_line_1 = var.domain_contact.address_line
    city           = var.domain_contact.city
    state          = var.domain_contact.state
    zip_code       = var.domain_contact.zip_code
    country_code   = var.domain_contact.country_code
    contact_type   = var.domain_contact.contact_type
  }

  tech_contact {
    first_name     = var.domain_contact.first_name
    last_name      = var.domain_contact.last_name
    email          = var.domain_contact.email
    phone_number   = var.domain_contact.phone_number
    address_line_1 = var.domain_contact.address_line
    city           = var.domain_contact.city
    state          = var.domain_contact.state
    zip_code       = var.domain_contact.zip_code
    country_code   = var.domain_contact.country_code
    contact_type   = var.domain_contact.contact_type
  }

  admin_privacy      = true
  registrant_privacy = true
  tech_privacy       = true

  tags = {
    Project = "unquote"
    Purpose = "domain-registration"
  }
}

# ─── Route 53 Hosted Zone ───────────────────────────────────────────────────
# Route 53 auto-creates a hosted zone when registering a domain. Reference it
# via the ID exported by the registration resource rather than creating a duplicate.

data "aws_route53_zone" "web" {
  zone_id = aws_route53domains_domain.web.hosted_zone_id
}

# ─── ACM Certificate ─────────────────────────────────────────────────────────
# CloudFront requires certificates in us-east-1 (already our default region).

resource "aws_acm_certificate" "web" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  tags = {
    Project = "unquote"
    Purpose = "tls-certificate"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.web.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.record]

  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "web" {
  certificate_arn         = aws_acm_certificate.web.arn
  validation_record_fqdns = [for record in aws_route53_record.acm_validation : record.fqdn]
}

# ─── DNS: Point Domain at CloudFront ─────────────────────────────────────────

resource "aws_route53_record" "web_a" {
  zone_id = data.aws_route53_zone.web.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_aaaa" {
  zone_id = data.aws_route53_zone.web.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

# ─── S3 Bucket ────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "web" {
  bucket = "unquote-web-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project = "unquote"
    Purpose = "static-site"
  }
}

# Block all public access — CloudFront accesses via OAC, not public URLs.
resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── CloudFront OAC ───────────────────────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "unquote-web-oac"
  description                       = "OAC for Unquote web S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── WAF Web ACL ─────────────────────────────────────────────────────────────
# Required for CloudFront flat-rate pricing plans. Default-allow with AWS
# managed common rule set for basic protection (no extra cost on Free plan).

resource "aws_wafv2_web_acl" "web" {
  name        = "unquote-web"
  description = "WAF for Unquote web CloudFront distribution"
  scope       = "CLOUDFRONT" # Must be in us-east-1

  default_action {
    allow {}
  }

  rule {
    name     = "aws-managed-common"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "unquote-web-common-rules"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "unquote-web-waf"
  }

  tags = {
    Project = "unquote"
    Purpose = "static-site-waf"
  }
}

# ─── CloudFront Distribution ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "Unquote web frontend"
  aliases             = [var.domain_name]
  web_acl_id          = aws_wafv2_web_acl.web.arn

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-unquote-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-unquote-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # AWS managed CachingOptimized policy: gzip+brotli compression, no query
    # strings or cookies forwarded, 1-day default / 1-year max TTL.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # SPA fallback: 404 and 403 from S3 → serve /404.html with HTTP 200
  # SvelteKit adapter-static generates 404.html as the app shell fallback.
  # CloudFront returns HTTP 200 so the browser loads the JS bundle,
  # and the SvelteKit client-side router handles the URL.
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/404.html"
    error_caching_min_ttl = 300
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.web.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Project = "unquote"
    Purpose = "static-site-cdn"
  }
}

# ─── S3 Bucket Policy: Allow CloudFront OAC ───────────────────────────────────

data "aws_iam_policy_document" "s3_cloudfront" {
  statement {
    sid     = "AllowCloudFrontOAC"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${aws_s3_bucket.web.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = ["arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.web.id}"]
    }
  }
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = data.aws_iam_policy_document.s3_cloudfront.json
}

# ─── IAM Role: GitHub Actions Deploy ─────────────────────────────────────────

data "aws_iam_policy_document" "github_oidc_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }

    # Audience condition is required by GitHub OIDC spec.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Restrict to main branch of this repo only.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:bojanrajkovic/${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_web_deploy" {
  name               = "github-web-deploy"
  description        = "Assumed by GitHub Actions web-deploy workflow via OIDC"
  assume_role_policy = data.aws_iam_policy_document.github_oidc_trust.json

  tags = {
    Project = "unquote"
    Purpose = "github-actions-deploy"
  }
}

data "aws_iam_policy_document" "github_web_deploy" {
  # Allow listing bucket contents (required for aws s3 sync --delete).
  statement {
    sid       = "S3List"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.web.arn]
  }

  # Allow reading, writing, and deleting objects (sync uploads + --delete removes old files).
  statement {
    sid    = "S3Objects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${aws_s3_bucket.web.arn}/*"]
  }

  # Allow creating CloudFront cache invalidations after deploy.
  statement {
    sid     = "CloudFrontInvalidate"
    effect  = "Allow"
    actions = ["cloudfront:CreateInvalidation"]
    resources = [
      "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.web.id}",
    ]
  }
}

resource "aws_iam_policy" "github_web_deploy" {
  name        = "github-web-deploy"
  description = "Permissions for GitHub Actions to sync S3 and invalidate CloudFront"
  policy      = data.aws_iam_policy_document.github_web_deploy.json
}

resource "aws_iam_role_policy_attachment" "github_web_deploy" {
  role       = aws_iam_role.github_web_deploy.name
  policy_arn = aws_iam_policy.github_web_deploy.arn
}

# ─── GitHub Actions Variables ─────────────────────────────────────────────────
# These are plaintext (not secrets) — the workflow reads them as vars.VARNAME.

resource "github_actions_variable" "s3_bucket" {
  repository    = var.github_repo
  variable_name = "S3_BUCKET"
  value         = aws_s3_bucket.web.id
}

resource "github_actions_variable" "cf_distribution_id" {
  repository    = var.github_repo
  variable_name = "CF_DISTRIBUTION_ID"
  value         = aws_cloudfront_distribution.web.id
}

resource "github_actions_variable" "aws_account_id" {
  repository    = var.github_repo
  variable_name = "AWS_ACCOUNT_ID"
  value         = data.aws_caller_identity.current.account_id
}

resource "github_actions_variable" "api_url" {
  repository    = var.github_repo
  variable_name = "API_URL"
  value         = var.api_url
}
