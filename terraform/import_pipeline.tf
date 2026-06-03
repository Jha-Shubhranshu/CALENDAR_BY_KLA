# =============================================================================
# ASYNC IMPORT PIPELINE
# S3 bucket  →  SQS queue  →  Worker Lambda
# The API Lambda drops jobs here; the worker Lambda consumes and processes them.
# =============================================================================

# -----------------------------------------------------------------------------
# S3 – temporary storage for raw import payloads
# Lifecycle rule auto-deletes files after 1 day (processed files are deleted
# immediately by the worker; this is just a safety net).
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "import_payloads" {
  bucket = "${var.project_name}-imports-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project_name}-imports"
  }
}

resource "aws_s3_bucket_public_access_block" "import_payloads" {
  bucket = aws_s3_bucket.import_payloads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "import_payloads" {
  bucket = aws_s3_bucket.import_payloads.id

  rule {
    id     = "delete-after-1-day"
    status = "Enabled"

    expiration {
      days = 1
    }
  }
}

# -----------------------------------------------------------------------------
# SQS – import job queue + dead-letter queue
# Visibility timeout is set to 360 s (> worker Lambda timeout of 300 s)
# so a job is not retried while the worker is still processing it.
# Failed jobs land in the DLQ after 2 attempts; the CloudWatch alarm fires.
# -----------------------------------------------------------------------------
resource "aws_sqs_queue" "import_dlq" {
  name                      = "${var.project_name}-import-dlq"
  message_retention_seconds = 1209600 # 14 days — plenty of time to investigate

  tags = {
    Name = "${var.project_name}-import-dlq"
  }
}

resource "aws_sqs_queue" "import_queue" {
  name                       = "${var.project_name}-import-queue"
  visibility_timeout_seconds = 360     # must be >= worker Lambda timeout
  message_retention_seconds  = 86400   # 1 day
  receive_wait_time_seconds  = 10      # long polling — reduces empty receives

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.import_dlq.arn
    maxReceiveCount     = 2 # retry once, then DLQ
  })

  tags = {
    Name = "${var.project_name}-import-queue"
  }
}

# -----------------------------------------------------------------------------
# IAM – permissions for the import pipeline
# Both the API Lambda (producer) and worker Lambda (consumer) share the same
# execution role, so one policy attachment covers both.
#
# NOTE: s3:GetObject and s3:PutObject on calendar-by-kla-* are already
# granted by the existing lambda_custom policy (wildcard bucket match).
# This policy adds only what is missing: DeleteObject + import queue SQS.
# -----------------------------------------------------------------------------
resource "aws_iam_policy" "import_pipeline" {
  name        = "${var.project_name}-import-pipeline-policy"
  description = "Permissions for the async import pipeline (S3 delete + import SQS)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ImportS3Cleanup"
        Effect   = "Allow"
        Action   = ["s3:DeleteObject"]
        Resource = "${aws_s3_bucket.import_payloads.arn}/*"
      },
      {
        Sid      = "ImportQueueSend"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.import_queue.arn
      },
      {
        Sid    = "ImportQueueConsume"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.import_queue.arn,
          aws_sqs_queue.import_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "import_pipeline" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.import_pipeline.arn
}

# -----------------------------------------------------------------------------
# Worker Lambda – same ECR image as the API Lambda, different CMD
# Runs inside the same VPC / private subnets so it can reach RDS and Redis.
# image_uri uses ignore_changes so `aws lambda update-function-code` works
# without Terraform reverting it (same pattern as the API Lambda).
# -----------------------------------------------------------------------------
resource "aws_lambda_function" "import_worker" {
  function_name = "${var.project_name}-import-worker"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.backend.repository_url}:latest"

  # Override the Dockerfile CMD to call the SQS handler instead of Mangum
  image_config {
    command = ["Cal_Backend.handler_worker.handler"]
  }

  timeout     = 900  # 15 min — SQS visibility timeout matches
  memory_size = 3008  # bumped from 512 to handle ChatGPT ZIPs up to ~300 MB
  ephemeral_storage {
    size = 4096           # 4 GB /tmp; not strictly needed (we stay in-memory)
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
      variables = {
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

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name = "${var.project_name}-import-worker"
  }

  depends_on = [aws_ecr_repository.backend]
}

# -----------------------------------------------------------------------------
# SQS → Worker Lambda trigger
# batch_size = 1: process one import job per invocation so a large job
# cannot block the queue for other users.
# -----------------------------------------------------------------------------
resource "aws_lambda_event_source_mapping" "import_sqs" {
  event_source_arn = aws_sqs_queue.import_queue.arn
  function_name    = aws_lambda_function.import_worker.arn
  batch_size       = 1
  enabled          = true
}

# -----------------------------------------------------------------------------
# CloudWatch – log group + alarm for the worker Lambda
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "import_worker" {
  name              = "/aws/lambda/${aws_lambda_function.import_worker.function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_metric_alarm" "import_worker_errors" {
  alarm_name          = "${var.project_name}-import-worker-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Import worker Lambda threw an error"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.import_worker.function_name
  }
}

resource "aws_s3_bucket_cors_configuration" "imports_cors" {
  bucket = aws_s3_bucket.import_payloads.id   # ← rename to whatever your bucket resource is
 
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = [
      "https://dtdjg3wim5ilk.cloudfront.net",
      "http://localhost:5173",   # remove if you don't want local dev to hit prod S3
    ]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_cloudwatch_metric_alarm" "import_dlq_depth" {
  alarm_name          = "${var.project_name}-import-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Import DLQ has messages — worker failed after 2 attempts"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.import_dlq.name
  }
}
