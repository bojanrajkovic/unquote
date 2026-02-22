data "aws_caller_identity" "current" {}

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

# ─── CloudFront Distribution ──────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "Unquote web frontend"

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

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400   # 1 day
    max_ttl     = 31536000 # 1 year
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
    cloudfront_default_certificate = true
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
      values   = ["repo:brajkovic/${var.github_repo}:ref:refs/heads/main"]
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
    sid     = "S3List"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
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
