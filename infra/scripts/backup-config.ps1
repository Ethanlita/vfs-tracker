# VFS-Tracker Configuration Backup Script
# Backs up existing AWS resource configurations before IaC migration

param(
    [string]$OutputDir = "..\backup",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "========================================"
Write-Host "VFS-Tracker AWS Configuration Backup"
Write-Host "Output Directory: $OutputDir"
Write-Host "Region: $Region"
Write-Host "========================================"
Write-Host ""

# Backup timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

# ============================================
# 1. Backup Lambda Function Configurations
# ============================================
Write-Host "[1/8] Backing up Lambda functions..."

$lambdaFunctions = @(
    "addVoiceEvent",
    "getVoiceEvents", 
    "getAllPublicEvents",
    "deleteEvent",
    "autoApproveEvent",
    "getUserProfile",
    "getUserPublicProfile",
    "updateUserProfile",
    "vfsTrackerUserProfileSetup",
    "getUploadUrl",
    "getFileUrl",
    "getAvatarUrl",
    "online-praat-analysis",
    "gemini-proxy",
    "get-song-recommendations",
    "edge-probe"
)

$lambdaConfigs = @()
foreach ($fn in $lambdaFunctions) {
    try {
        $config = aws lambda get-function --function-name $fn --region $Region 2>$null | ConvertFrom-Json
        if ($config) {
            $lambdaConfigs += $config
            Write-Host "  OK: $fn" -ForegroundColor Green
        }
    } catch {
        Write-Host "  SKIP: $fn (not found)" -ForegroundColor Yellow
    }
}

$lambdaConfigs | ConvertTo-Json -Depth 10 | Out-File "$OutputDir\lambda-functions-$timestamp.json" -Encoding UTF8
Write-Host "  Saved to: lambda-functions-$timestamp.json"
Write-Host ""

# ============================================
# 2. Backup API Gateway Configuration
# ============================================
Write-Host "[2/8] Backing up API Gateway..."

$apiId = "2rzxc2x5l8"

# REST API basic info
aws apigateway get-rest-api --rest-api-id $apiId --region $Region | Out-File "$OutputDir\api-gateway-$timestamp.json" -Encoding UTF8
Write-Host "  OK: REST API info" -ForegroundColor Green

# Resources and methods
aws apigateway get-resources --rest-api-id $apiId --region $Region | Out-File "$OutputDir\api-resources-$timestamp.json" -Encoding UTF8
Write-Host "  OK: API Resources" -ForegroundColor Green

# Authorizers
aws apigateway get-authorizers --rest-api-id $apiId --region $Region | Out-File "$OutputDir\api-authorizers-$timestamp.json" -Encoding UTF8
Write-Host "  OK: Authorizers" -ForegroundColor Green

# Stage config
aws apigateway get-stages --rest-api-id $apiId --region $Region | Out-File "$OutputDir\api-stages-$timestamp.json" -Encoding UTF8
Write-Host "  OK: Stages" -ForegroundColor Green

Write-Host ""

# ============================================
# 3. Backup DynamoDB Table Structure
# ============================================
Write-Host "[3/8] Backing up DynamoDB tables..."

$tables = @("VoiceFemEvents", "VoiceFemUsers", "VoiceFemTests")
foreach ($table in $tables) {
    aws dynamodb describe-table --table-name $table --region $Region | Out-File "$OutputDir\dynamodb-$table-$timestamp.json" -Encoding UTF8
    Write-Host "  OK: $table" -ForegroundColor Green
}
Write-Host ""

# ============================================
# 4. Backup S3 Configuration
# ============================================
Write-Host "[4/8] Backing up S3 configuration..."

$bucket = "vfs-tracker-objstor"

# CORS
aws s3api get-bucket-cors --bucket $bucket --region $Region 2>$null | Out-File "$OutputDir\s3-cors-$timestamp.json" -Encoding UTF8
Write-Host "  OK: CORS config" -ForegroundColor Green

# Lifecycle
try {
    aws s3api get-bucket-lifecycle-configuration --bucket $bucket --region $Region 2>$null | Out-File "$OutputDir\s3-lifecycle-$timestamp.json" -Encoding UTF8
    Write-Host "  OK: Lifecycle config" -ForegroundColor Green
} catch {
    Write-Host "  SKIP: No lifecycle config" -ForegroundColor Yellow
}

# Policy
try {
    aws s3api get-bucket-policy --bucket $bucket --region $Region 2>$null | Out-File "$OutputDir\s3-policy-$timestamp.json" -Encoding UTF8
    Write-Host "  OK: Bucket Policy" -ForegroundColor Green
} catch {
    Write-Host "  SKIP: No bucket policy" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# 5. Backup Cognito Configuration
# ============================================
Write-Host "[5/8] Backing up Cognito..."

$userPoolId = "us-east-1_Bz6JC9ko9"

# User Pool
aws cognito-idp describe-user-pool --user-pool-id $userPoolId --region $Region | Out-File "$OutputDir\cognito-pool-$timestamp.json" -Encoding UTF8
Write-Host "  OK: User Pool" -ForegroundColor Green

# App Clients
aws cognito-idp list-user-pool-clients --user-pool-id $userPoolId --region $Region | Out-File "$OutputDir\cognito-clients-$timestamp.json" -Encoding UTF8
Write-Host "  OK: App Clients" -ForegroundColor Green

Write-Host ""

# ============================================
# 6. Backup IAM Roles
# ============================================
Write-Host "[6/8] Backing up IAM roles..."

$roles = @(
    "addVoiceEvent-role-l30o387r",
    "getAllPublicEvents-role-33fp67ha",
    "gemini-proxy-role-cegcoi6x",
    "edge-probe-role-ttc3yql4"
)

$roleConfigs = @()
foreach ($role in $roles) {
    try {
        $roleInfo = aws iam get-role --role-name $role 2>$null | ConvertFrom-Json
        $policies = aws iam list-attached-role-policies --role-name $role 2>$null | ConvertFrom-Json
        $inlinePolicies = aws iam list-role-policies --role-name $role 2>$null | ConvertFrom-Json
        
        $roleConfigs += @{
            Role = $roleInfo.Role
            AttachedPolicies = $policies.AttachedPolicies
            InlinePolicies = $inlinePolicies.PolicyNames
        }
        Write-Host "  OK: $role" -ForegroundColor Green
    } catch {
        Write-Host "  SKIP: $role (not found)" -ForegroundColor Yellow
    }
}

$roleConfigs | ConvertTo-Json -Depth 10 | Out-File "$OutputDir\iam-roles-$timestamp.json" -Encoding UTF8
Write-Host ""

# ============================================
# 7. Backup ECR Repository
# ============================================
Write-Host "[7/8] Backing up ECR repository..."

aws ecr describe-repositories --repository-names vfs-tracker-images --region $Region 2>$null | Out-File "$OutputDir\ecr-repo-$timestamp.json" -Encoding UTF8
Write-Host "  OK: vfs-tracker-images" -ForegroundColor Green
Write-Host ""

# ============================================
# 8. Backup CloudWatch Log Groups
# ============================================
Write-Host "[8/8] Backing up CloudWatch Log Groups..."

$logGroups = @()
foreach ($fn in $lambdaFunctions) {
    $logGroupName = "/aws/lambda/$fn"
    try {
        $logGroup = aws logs describe-log-groups --log-group-name-prefix $logGroupName --region $Region 2>$null | ConvertFrom-Json
        if ($logGroup.logGroups.Count -gt 0) {
            $logGroups += $logGroup.logGroups[0]
        }
    } catch {}
}

$logGroups | ConvertTo-Json -Depth 5 | Out-File "$OutputDir\cloudwatch-logs-$timestamp.json" -Encoding UTF8
Write-Host "  OK: Recorded $($logGroups.Count) Log Groups" -ForegroundColor Green
Write-Host ""

# ============================================
# Complete
# ============================================
Write-Host "========================================"
Write-Host "Backup Complete!" -ForegroundColor Green
Write-Host "========================================"
Write-Host ""
Write-Host "Backup files location: $OutputDir"
Write-Host "Timestamp: $timestamp"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Verify backup files are complete"
Write-Host "  2. Ensure backup/ is in .gitignore"
Write-Host "  3. Continue with Phase 1: SAM template creation"
