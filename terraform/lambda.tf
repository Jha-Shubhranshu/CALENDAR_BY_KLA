# ----------------------------------------------------------------------------
# ECR repository for the Lambda container image
# ----------------------------------------------------------------------------
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"
  force_delete         = true  # convenience for dev; set false in real prod

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-backend-ecr"
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ----------------------------------------------------------------------------
# Security group for Lambda (egress only — Lambda doesn't accept inbound)
# ----------------------------------------------------------------------------
resource "aws_security_group" "lambda" {
  name        = "${var.project_name}-lambda-sg"
  description = "Security group for Lambda"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-lambda-sg"
  }
}

# ----------------------------------------------------------------------------
# Lambda function (container image)
# ----------------------------------------------------------------------------
resource "aws_lambda_function" "backend" {
  function_name = "${var.project_name}-backend"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.backend.repository_url}:latest"

  timeout     = 60
  memory_size = 1024  # bumped from 512 — CPU scales with RAM on Lambda

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      # Use RDS Proxy endpoint for better connection pooling in Lambda
      DATABASE_URL         = "postgresql+asyncpg://${var.db_username}@${aws_db_proxy.main.endpoint}/${var.db_name}"
      REDIS_HOST           = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT           = "6379"
      JWT_ALGORITHM        = var.jwt_algorithm
      ENVIRONMENT          = var.environment
      SECRETS_NAME         = aws_secretsmanager_secret.app_secrets.name
      S3_BUCKET_NAME       = "${var.project_name}-imports-${data.aws_caller_identity.current.account_id}"
      S3_MEDIA_BUCKET_NAME = aws_s3_bucket.media.bucket
      SQS_IMPORT_QUEUE_URL = "https://sqs.${var.aws_region}.amazonaws.com/${data.aws_caller_identity.current.account_id}/${var.project_name}-import-queue"
    }
  }

  # Lets you redeploy code via `aws lambda update-function-code`
  # without Terraform reverting it on the next `apply`
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-backend"
  }

  depends_on = [aws_ecr_repository.backend]
}

# ----------------------------------------------------------------------------
# Permission for API Gateway to invoke Lambda
# ----------------------------------------------------------------------------
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# ----------------------------------------------------------------------------
# Useful outputs for the deploy script
# ----------------------------------------------------------------------------
output "ecr_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "lambda_function_name" {
  value = aws_lambda_function.backend.function_name
}