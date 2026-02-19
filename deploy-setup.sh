#!/bin/bash
# Bitcoin Bank GCP & Firebase Setup Script
# Run this script to set up your Google Cloud and Firebase projects

set -e  # Exit on error

echo "=== Bitcoin Bank Deployment Setup ==="
echo ""
echo "This script will help you set up:"
echo "1. Google Cloud project 'bitcoin-bank'"
echo "2. Enable required APIs"
echo "3. Create Cloud Storage bucket"
echo "4. Initialize Firebase project"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="bitcoin-bank-defi-u"
BUCKET_NAME="bitcoin-bank-data"
REGION="us-central1"

echo -e "${YELLOW}Step 1: Authenticate with Google Cloud${NC}"
echo "Opening browser for authentication..."
gcloud auth login

echo ""
echo -e "${YELLOW}Step 2: Create GCP Project${NC}"
echo "Creating project '$PROJECT_ID'..."
if gcloud projects create $PROJECT_ID --set-as-default 2>/dev/null; then
    echo -e "${GREEN}✓ Project created successfully${NC}"
else
    echo -e "${YELLOW}! Project may already exist, setting as default...${NC}"
    gcloud config set project $PROJECT_ID
fi

echo ""
echo -e "${RED}IMPORTANT: Enable billing for this project${NC}"
echo "Visit: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
read -p "Press Enter after you've enabled billing..."

echo ""
echo -e "${YELLOW}Step 3: Enable Required APIs${NC}"
echo "Enabling Cloud Run, Cloud Storage, Cloud Build APIs..."
gcloud services enable run.googleapis.com storage.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com

echo -e "${GREEN}✓ APIs enabled${NC}"

echo ""
echo -e "${YELLOW}Step 4: Create Cloud Storage Bucket${NC}"
echo "Creating bucket 'gs://$BUCKET_NAME' in region '$REGION'..."
if gcloud storage buckets create gs://$BUCKET_NAME --location=$REGION 2>/dev/null; then
    echo -e "${GREEN}✓ Bucket created successfully${NC}"
else
    echo -e "${YELLOW}! Bucket may already exist${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Initialize Firebase${NC}"
echo "Logging into Firebase..."
firebase login

echo ""
echo "Creating Firebase project (this will link to your GCP project)..."
echo "Note: If the project already exists, you can use it."
firebase projects:addfirebase $PROJECT_ID 2>/dev/null || echo "Firebase project may already exist"

echo ""
echo -e "${GREEN}✓ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Run './deploy-backend.sh' to deploy the backend to Cloud Run"
echo "2. Run './deploy-frontend.sh' to deploy the frontend to Firebase"
echo ""
echo "Project details:"
echo "  Project ID: $PROJECT_ID"
echo "  Bucket: gs://$BUCKET_NAME"
echo "  Region: $REGION"
