# S3 bucket for permanent media storage (images)
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-media"
    Environment = var.environment
  }
}

# Block all public access to the media bucket - access should be via CloudFront OAC
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration to allow frontend access for direct interactions
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"] # In production, this should be restricted to your domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 bucket policy to allow CloudFront OAC to access the content
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowCloudFrontServicePrincipal"
        Action   = "s3:GetObject"
        Effect   = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Resource = "${aws_s3_bucket.media.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# OAC for the media bucket
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.project_name}-media-oac"
  description                       = "OAC for media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

output "media_bucket_name" {
  value = aws_s3_bucket.media.bucket
}
