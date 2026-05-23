# Deployment Script for CalendarByKla on AWS

# Use the environment specified by the user
& "C:\Users\shubh\Desktop\VENVs\bookly_env\Scripts\Activate.ps1"

$PROJECT_NAME = "calendar-by-kla"
$REGION = "us-east-1"

# 1. Build Frontend
Write-Host "--- Building Frontend ---" -ForegroundColor Cyan
cd Cal_TS_Frontend
npm install
npm run build
cd ..

# 2. Package Backend for Lambda
Write-Host "--- Packaging Backend ---" -ForegroundColor Cyan
if (Test-Path "dist_lambda") { Remove-Item -Recurse -Force "dist_lambda" }
New-Item -ItemType Directory -Path "dist_lambda"

# Install dependencies into dist_lambda
pip install -r requirements.txt -t dist_lambda

# Copy application code
Copy-Item -Recurse "Cal_Backend" "dist_lambda/"

# Create ZIP
if (Test-Path "terraform/lambda_function_payload.zip") { Remove-Item "terraform/lambda_function_payload.zip" }
Compress-Archive -Path "dist_lambda/*" -DestinationPath "terraform/lambda_function_payload.zip" -Force

# 3. Terraform Apply
Write-Host "--- Applying Infrastructure ---" -ForegroundColor Cyan
cd terraform
terraform init
# Note: This will prompt for variables if not provided via -var or a .tfvars file
terraform apply -auto-approve
cd ..

# 4. Sync Frontend to S3
Write-Host "--- Syncing Frontend to S3 ---" -ForegroundColor Cyan
$BUCKET_NAME = terraform -chdir=terraform output -raw frontend_bucket_name
aws s3 sync Cal_TS_Frontend/dist "s3://$BUCKET_NAME" --delete

# 5. Invalidate CloudFront Cache
Write-Host "--- Invalidating CloudFront Cache ---" -ForegroundColor Cyan
$DIST_ID = terraform -chdir=terraform output -raw cloudfront_distribution_id
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"

Write-Host "--- Deployment Complete! ---" -ForegroundColor Green
$DOMAIN = terraform -chdir=terraform output -raw cloudfront_domain_name
Write-Host "Your app is live at: https://$DOMAIN" -ForegroundColor Green
