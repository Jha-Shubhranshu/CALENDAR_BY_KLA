# SQS Queue for asynchronous processing (e.g., AI analysis, notifications)
resource "aws_sqs_queue" "main" {
  name                      = "${var.project_name}-main-queue"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 864000
  receive_wait_time_seconds = 10
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "dlq" {
  name = "${var.project_name}-main-dlq"
}

# Alarm for DLQ depth
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_alarm" {
  alarm_name          = "${var.project_name}-sqs-dlq-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This alarm fires if there are any messages in the DLQ"
  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }
}
