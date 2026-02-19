#!/bin/bash
# Deploy Bitcoin Bank Backend to Google Cloud Run

set -e

PROJECT_ID="bitcoin-bank-defi-u"
SERVICE_NAME="bitcoin-bank-api"
REGION="us-central1"
BUCKET_NAME="bitcoin-bank-defi-u-data"

echo "=== Deploying Bitcoin Bank Backend to Cloud Run ==="
echo ""
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Check if gcloud is configured
if ! gcloud config get-value project &>/dev/null; then
    echo "Error: gcloud not configured. Run ./deploy-setup.sh first"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

echo "Building and deploying to Cloud Run..."
echo "This may take several minutes..."
echo ""

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars="LIGHTNING_BACKEND=mock,GCS_BUCKET=$BUCKET_NAME,GCS_DB_PATH=ledger.db,DEBUG=false" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300 \
  --port=8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Service URL: $SERVICE_URL"
echo ""
echo "Next steps:"
echo "1. Test the health endpoint:"
echo "   curl $SERVICE_URL/health"
echo ""
echo "2. Update the BASE_URL environment variable:"
echo "   gcloud run services update $SERVICE_NAME \\"
echo "     --region $REGION \\"
echo "     --set-env-vars=\"BASE_URL=$SERVICE_URL\""
echo ""
echo "3. Get Firebase hosting URL and update CORS_ORIGINS:"
echo "   gcloud run services update $SERVICE_NAME \\"
echo "     --region $REGION \\"
echo "     --set-env-vars=\"CORS_ORIGINS=https://bitcoin-bank-XXXXX.web.app\""
echo ""
echo "4. Generate and set Nostr keys (see deploy plan)"
echo ""
echo "5. Update frontend config with this URL: $SERVICE_URL"
echo ""

# Save URL to a file for frontend deployment
echo "$SERVICE_URL" > .backend-url.txt
echo "Backend URL saved to .backend-url.txt"
