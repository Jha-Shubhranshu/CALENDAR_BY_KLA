# redeploy-all.ps1
$ACCOUNT_ID = "099210689603"
$REGION     = "us-east-1"
$REPO_NAME  = "calendar-by-kla-backend"
$ECR_URI    = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"
$LAMBDAS    = @("calendar-by-kla-backend", "calendar-by-kla-import-worker")

cmd /c "aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

docker build --platform linux/amd64 --provenance=false --sbom=false -t "${REPO_NAME}:latest" .
docker tag "${REPO_NAME}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

foreach ($fn in $LAMBDAS) {
  Write-Host "Updating $fn..." -ForegroundColor Cyan
  aws lambda update-function-code --function-name $fn --image-uri "${ECR_URI}:latest" --region $REGION | Out-Null
  aws lambda wait function-updated --function-name $fn --region $REGION
  Write-Host "  $fn ready" -ForegroundColor Green
}

Write-Host "All Lambdas updated." -ForegroundColor Green