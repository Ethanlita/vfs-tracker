# Simplified PowerShell script to build and push a Docker image to AWS ECR.

# --- Configuration ---
# These values are based on your working commands.
$awsAccountId = "296821242554"
$awsRegion = "us-east-1"
$imageName = "vfs-tracker-images"
$ecrRepoUri = "${awsAccountId}.dkr.ecr.${awsRegion}.amazonaws.com"
$fullImageName = "${ecrRepoUri}/${imageName}:latest"

# --- Execution ---

# Step 1: Authenticate Docker to your Amazon ECR registry.
Write-Host "Step 1: Authenticating to AWS ECR..."
aws ecr get-login-password --region $awsRegion | docker login --username AWS --password-stdin $ecrRepoUri

# Step 2: Build the Docker image with Docker BuildKit DISABLED for Lambda compatibility.
Write-Host "Step 2: Building Docker image..."
$env:DOCKER_BUILDKIT=0; docker build -t $imageName .

# Step 3: Tag the local image with the ECR repository URI.
Write-Host "Step 3: Tagging image as $fullImageName"
docker tag "${imageName}:latest" $fullImageName

# Step 4: Push the tagged image to Amazon ECR.
Write-Host "Step 4: Pushing image to ECR..."
docker push $fullImageName

Write-Host "--- Success! Image has been pushed. ---" -ForegroundColor Green
