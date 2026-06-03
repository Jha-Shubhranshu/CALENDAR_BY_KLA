# S3 bucket for frontend
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.project_name}-frontend-${data.aws_caller_identity.current.account_id}"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = "s3:GetObject"
        Effect   = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Data sources for managed policies to avoid hardcoded ID issues
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

resource "aws_cloudfront_distribution" "frontend" {

    origin {
      domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
      origin_id                = "media-bucket"
      origin_access_control_id = aws_cloudfront_origin_access_control.media.id
    }
  
    # NEW behavior — route /conversations/* to the media bucket
    # MUST be listed BEFORE the default behavior; ordered_cache_behavior matches
    # in declaration order, then falls through to default_cache_behavior.
    ordered_cache_behavior {
      path_pattern           = "/conversations/*"
      target_origin_id       = "media-bucket"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true
  
      cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
      response_headers_policy_id = null
  
      # No forwarded headers/cookies/query-strings; media is static-by-hash.
    }
  
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }
  # New: API Gateway origin
  
  origin {
    domain_name              = replace(aws_apigatewayv2_api.main.api_endpoint, "https://", "")
    origin_id                = "APIGW-${aws_apigatewayv2_api.main.id}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
      origin_keepalive_timeout = 60
    }
  }

  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.media.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }
  

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  web_acl_id          = aws_wafv2_web_acl.main.arn

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.bucket}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "APIGW-${aws_apigatewayv2_api.main.id}"
  
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
  
    # Use AWS-managed AllViewerExceptHostHeader to ensure API Gateway receives the correct Host header
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    response_headers_policy_id = aws_cloudfront_response_headers_policy.api_cors.id

  }

  ordered_cache_behavior {
    path_pattern     = "/media/*"
    target_origin_id = "S3-${aws_s3_bucket.media.bucket}"

    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Use AWS-managed Optimized Caching policy for media
    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id
  }


  # SPA support: redirect 403 and 404 to index.html
  # This is necessary because when a user refreshes on a route like /sign-in, 
  # S3 looks for a folder/file that doesn't exist and returns 403 (due to private bucket) 
  # or 404. We need CloudFront to serve index.html so React Router can take over.
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
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
    Name = "${var.project_name}-frontend-cdn"
  }
}

output "cloudfront_url" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "api_url" {
  value = aws_apigatewayv2_api.main.api_endpoint
}



resource "aws_cloudfront_response_headers_policy" "api_cors" {
  name = "${var.project_name}-api-cors-policy"

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["Authorization",
                "Content-Type",
                "X-Requested-With",
                "X-Source",
                "X-Account",
                "X-Trigger",
              ]
    }

    access_control_allow_methods {
      items = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    }

    access_control_allow_origins {
      items = ["https://claude.ai",
    "https://chatgpt.com"]
    }

    access_control_max_age_sec = 86400
    origin_override = false   # false = respect headers from FastAPI, only add if missing
  }
}
