# redeploy-all.ps1
$ErrorActionPreference = "Stop"
$ACCOUNT_ID = "099210689603"
$REGION     = "us-east-1"
$REPO_NAME  = "calendar-by-kla-backend"
$ECR_URI = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"
$LAMBDAS = @(
    "calendar-by-kla-backend",
    "calendar-by-kla-import-worker"
)
Write-Host "Logging into ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $REGION 
| docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
if ($LASTEXITCODE -ne 0) {
    throw "ECR login failed"
}
# Use git commit hash as image tag
$GIT_SHA = (git rev-parse HEAD).Trim()
Write-Host "Building image $GIT_SHA ..." -ForegroundColor Cyan
docker build 
    --platform linux/amd64 
    --provenance=false 
    --sbom=false 
    --pull 
    --no-cache 
    -t "${REPO_NAME}:$GIT_SHA" 
    .
if ($LASTEXITCODE -ne 0) {
    throw "Docker build failed"
}
docker image inspect "${REPO_NAME}:$GIT_SHA" | Out-Null
Write-Host "Tagging image..." -ForegroundColor Cyan
docker tag "${REPO_NAME}:$GIT_SHA" "${ECR_URI}:$GIT_SHA"
if ($LASTEXITCODE -ne 0) {
    throw "Docker tag failed"
}
Write-Host "Pushing image..." -ForegroundColor Cyan
docker push "${ECR_URI}:$GIT_SHA"
if ($LASTEXITCODE -ne 0) {
    throw "Docker push failed"
}
Write-Host "Fetching pushed image digest..." -ForegroundColor Cyan
$DIGEST = aws ecr describe-images 
    --repository-name $REPO_NAME 
    --image-ids imageTag=$GIT_SHA 
    --query 'imageDetails[0].imageDigest' 
    --output text
if (-not $DIGEST) {
    throw "Unable to retrieve ECR image digest"
}
$IMAGE_URI = "${ECR_URI}@${DIGEST}"
Write-Host ""
Write-Host "Deploying image:" -ForegroundColor Yellow
Write-Host $IMAGE_URI
Write-Host ""
foreach ($fn in $LAMBDAS) {
    Write-Host "Updating $fn ..." -ForegroundColor Cyan
    aws lambda update-function-code 
        --function-name $fn 
        --image-uri $IMAGE_URI 
        --region $REGION 
        | Out-Null
    aws lambda wait function-updated 
        --function-name $fn 
        --region $REGION
    $DEPLOYED = aws lambda get-function 
        --function-name $fn 
        --query "Code.ResolvedImageUri" `
        --output text
    Write-Host "  Verified: $DEPLOYED" -ForegroundColor Green
}
Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Git SHA : $GIT_SHA"
Write-Host "Digest  : $DIGEST"

