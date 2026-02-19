#!/usr/bin/env bash
# Deploy the Bitcoin Perp DEX backend to Google Cloud Run.
# Usage: ./deploy-dex-backend.sh [GCP_PROJECT_ID]

set -euo pipefail

PROJECT_ID="${1:-${GCP_PROJECT_ID:-}}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: GCP_PROJECT_ID not set. Run: ./deploy-dex-backend.sh my-gcp-project"
  exit 1
fi

SERVICE_NAME="bitcoin-perp-dex-api"
REGION="us-central1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"
BACKEND_DIR="$(dirname "$0")/bitcoin-bank-nostr copy"

echo "==> Building Docker image for ${SERVICE_NAME}"
cd "${BACKEND_DIR}"
docker build -t "${IMAGE}" .

echo "==> Pushing image to GCR"
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run"
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "\
LIGHTNING_BACKEND=mock,\
GCS_BUCKET=${PROJECT_ID}-perp-dex-data,\
MAX_LEVERAGE=20,\
INITIAL_MARGIN_PCT=0.05,\
MAINTENANCE_MARGIN_PCT=0.025,\
MAKER_FEE_PCT=0.0002,\
TAKER_FEE_PCT=0.0005,\
INSURANCE_FUND_FEE_PCT=0.001,\
FUNDING_INTERVAL_HOURS=8,\
NOSTR_RELAYS=wss://relay.damus.io,wss://nos.lol,\
NWC_ENABLED=false" \
  --project "${PROJECT_ID}"

echo "==> Getting service URL"
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)")

echo "${SERVICE_URL}" > .backend-url.txt
echo ""
echo "==> Backend deployed: ${SERVICE_URL}"
echo "==> Saved to .backend-url.txt"
echo ""
echo "NEXT STEPS:"
echo "  1. Set BANK_NOSTR_PRIVATE_KEY:"
echo "     gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars BANK_NOSTR_PRIVATE_KEY=<hex>"
echo "  2. Update CORS_ORIGINS after deploying frontend:"
echo "     gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars CORS_ORIGINS=https://bitcoin-perp-dex.web.app,BASE_URL=${SERVICE_URL}"
echo "  3. Run frontend deploy: ./deploy-dex-frontend.sh"
