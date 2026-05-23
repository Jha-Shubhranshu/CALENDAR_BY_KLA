# AWS Production-Ready Infrastructure for CalendarByKla

This infrastructure is designed following the standards of your "How It Works" reference, prioritizing robustness, security, and scalability while remaining mostly within the AWS Free Tier.

## Architecture Overview

- **VPC**: A secure network with public and private subnets across two availability zones.
- **Frontend**: Hosted on S3 and served via CloudFront CDN for global low-latency delivery.
- **Backend**: FastAPI application running on AWS Lambda (Serverless) via API Gateway.
- **Database**: Amazon RDS for PostgreSQL (db.t3.micro - Free Tier eligible).
- **Cache**: Amazon ElastiCache for Redis (cache.t3.micro - Free Tier eligible).
- **Security**:
  - **AWS WAF**: Web Application Firewall protecting the CloudFront distribution with rate-limiting and common rule sets.
  - **OAC (Origin Access Control)**: Restricts S3 access only to CloudFront.
  - **IAM**: Least-privilege roles for Lambda execution.
  - **Secrets Manager**: Secure storage for database credentials and JWT secrets.
- **Resilience**:
  - **SQS & DLQ**: Decouples asynchronous tasks with a Dead Letter Queue and CloudWatch Alarms for failure detection.
  - **DynamoDB**: Used for idempotency tracking and state persistence between stages.

## How to Deploy

### 1. Prerequisites
- [Terraform](https://www.terraform.io/downloads.html) installed.
- [AWS CLI](https://aws.amazon.com/cli/) configured with your account credentials.

### 2. Prepare the Backend
Your FastAPI application needs to be packaged for AWS Lambda. You can use a tool like `mangum` to wrap your FastAPI app.
- Ensure your `main.py` has a handler: `handler = Mangum(app)`
- Create a deployment package: `pip install -t lib -r requirements.txt && zip -r lambda_function_payload.zip .`

### 3. Initialize Terraform
```bash
cd terraform
terraform init
```

### 4. Deploy
Create a `terraform.tfvars` file to provide sensitive values:
```hcl
db_password  = "your-secure-db-password"
jwt_secret   = "your-secure-jwt-secret"
aws_region   = "us-east-1"
```

Then run:
```bash
terraform plan
terraform apply
```

## Production Standards Implemented

- **Decoupling**: SQS queues separate processing stages, preventing cascading failures.
- **Durability**: Data is persisted in RDS, Redis, and DynamoDB.
- **Idempotency**: DynamoDB table is ready for the backend to use for atomic "reserve" operations.
- **Defense in Depth**: Multiple layers of security from WAF at the edge to private subnets for the data layer.
- **Monitoring**: CloudWatch alarms are configured for critical failure points like the SQS DLQ.

## Cost Note
While most resources fit in the Free Tier, **AWS WAF** and **NAT Gateway** carry monthly costs.
- **WAF**: ~$5/month + request fees.
- **NAT Gateway**: ~$32/month.
  - *Optimization*: If you are strictly on a $0 budget, you can move the Lambda to a public subnet (not recommended for production) or use a NAT Instance (t3.micro) instead of a NAT Gateway.
