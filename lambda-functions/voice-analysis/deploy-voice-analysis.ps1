# deploy-voice-analysis.ps1
# Usage: run from the folder that contains your Dockerfile
#   .\deploy-voice-analysis.ps1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- 0) Variables ---
$Region       = 'us-east-1'
$Repo         = 'vfs-tracker-images'
$LocalImage   = 'vfs-tracker-voice-analyzer-lambda:local'
$PushTag      = 'v1'
$FunctionName = 'voice-analysis'
$RoleArn      = 'arn:aws:iam::296821242554:role/service-role/addVoiceEvent-role-l30o387r'
$Arch         = 'x86_64'

Write-Host "==> Region:        $Region"
Write-Host "==> Repo:          $Repo"
Write-Host "==> LocalImage:    $LocalImage"
Write-Host "==> FunctionName:  $FunctionName"
Write-Host "==> RoleArn:       $RoleArn"
Write-Host "==> Arch:          $Arch"

function Assert-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' not found in PATH."
  }
}
Assert-Cmd docker
Assert-Cmd aws

# 1) Build
Write-Host "`n[1/6] Building Docker image..." -ForegroundColor Cyan
& docker build -t $LocalImage .

# 2) Account & ImageUri
Write-Host "`n[2/6] Getting AWS Account ID..." -ForegroundColor Cyan
$AccountId = (& aws sts get-caller-identity --query Account --output text).Trim()
if (-not $AccountId) { throw 'Failed to get AWS Account ID. Run aws configure?' }
$EcrBase = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$EcrBase/$Repo`:$PushTag"  # note the escaped colon
Write-Host "==> ImageUri: $ImageUri"

# 3) Ensure ECR repo
Write-Host "`n[3/6] Ensuring ECR repository exists..." -ForegroundColor Cyan
try {
  & aws ecr describe-repositories --repository-names $Repo --region $Region | Out-Null
  Write-Host "ECR repo exists: $Repo"
} catch {
  Write-Host "Creating ECR repo: $Repo"
  & aws ecr create-repository --repository-name $Repo --image-scanning-configuration scanOnPush=true --region $Region | Out-Null
}

# 4) Login ECR
Write-Host "`n[4/6] Logging in to ECR..." -ForegroundColor Cyan
try {
  & aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $EcrBase | Out-Null
} catch {
  Write-Warning "Pipeline login failed, retry explicit password arg..."
  $pwd = & aws ecr get-login-password --region $Region
  & docker login --username AWS --password $pwd $EcrBase | Out-Null
}

# 5) Tag & Push
Write-Host "`n[5/6] Tagging & pushing image..." -ForegroundColor Cyan
& docker tag $LocalImage $ImageUri
& docker push $ImageUri
Write-Host "✅ Pushed: $ImageUri"

# 6) Create or Update Lambda
Write-Host "`n[6/6] Create/Update Lambda function..." -ForegroundColor Cyan
$exists = $true
try { & aws lambda get-function --function-name $FunctionName --region $Region | Out-Null } catch { $exists = $false }

if ($exists) {
  Write-Host "Updating existing Lambda: $FunctionName"
  & aws lambda update-function-code `
    --function-name $FunctionName `
    --image-uri $ImageUri `
    --region $Region | Out-Null
  Write-Host "✅ Updated Lambda -> $ImageUri"
} else {
  if (-not $RoleArn) { throw "RoleArn is empty. Provide a valid IAM role to create the function." }
  Write-Host "Creating Lambda: $FunctionName"
  & aws lambda create-function `
    --function-name $FunctionName `
    --package-type Image `
    --code ImageUri=$ImageUri `
    --role $RoleArn `
    --architectures $Arch `
    --timeout 15 `
    --memory-size 1024 `
    --region $Region | Out-Null
  Write-Host "✅ Created Lambda -> $ImageUri"
}

Write-Host "`n🎉 Done. Ready to invoke or attach triggers." -ForegroundColor Green