output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnets" {
  value = aws_subnet.public[*].id
}

output "private_subnets" {
  value = aws_subnet.private[*].id
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "frontend_bucket_name" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.main.api_endpoint
}

output "import_bucket_name" {
  value       = aws_s3_bucket.import_payloads.bucket
  description = "S3 bucket that holds raw import payloads"
}

output "import_queue_url" {
  value       = aws_sqs_queue.import_queue.url
  description = "SQS queue URL consumed by the import worker Lambda"
}

output "import_worker_function_name" {
  value       = aws_lambda_function.import_worker.function_name
  description = "Name of the import worker Lambda function"
}
