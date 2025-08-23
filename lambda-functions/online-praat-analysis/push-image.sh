#!/bin/bash
# Simplified shell script to build and push a Docker image to AWS ECR.

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
# These values are based on your working commands.
AWS_ACCOUNT_ID="296821242554"
AWS_REGION="us-east-1"
IMAGE_NAME="vfs-tracker-images"
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
FULL_IMAGE_NAME="${ECR_REPO_URI}/${IMAGE_NAME}:latest"

# --- Execution ---

# Step 1: Authenticate Docker to your Amazon ECR registry.
echo "Step 1: Authenticating to AWS ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REPO_URI"

# Step 2: Build the Docker image for linux/arm64 architecture.
echo "Step 2: Building Docker image for linux/arm64..."
docker build --platform linux/arm64 -t "$IMAGE_NAME" .

# Step 3: Tag the local image with the ECR repository URI.
echo "Step 3: Tagging image as $FULL_IMAGE_NAME"
docker tag "${IMAGE_NAME}:latest" "$FULL_IMAGE_NAME"

# Step 4: Push the tagged image to Amazon ECR.
echo "Step 4: Pushing image to ECR..."
docker push "$FULL_IMAGE_NAME"

echo "--- Success! Image has been pushed. ---"
