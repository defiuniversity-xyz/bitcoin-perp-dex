#!/usr/bin/env bash
# Build and deploy the DEX frontend to Firebase Hosting.
# Usage: ./deploy-dex-frontend.sh [BACKEND_URL]

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")"
FRONTEND_DIR="${SCRIPT_DIR}/dex-frontend"

# Determine backend URL
BACKEND_URL="${1:-}"
if [[ -z "$BACKEND_URL" && -f "${SCRIPT_DIR}/.backend-url.txt" ]]; then
  BACKEND_URL=$(cat "${SCRIPT_DIR}/.backend-url.txt")
fi
if [[ -z "$BACKEND_URL" ]]; then
  echo "WARNING: BACKEND_URL not set. Using relative /api proxy (dev mode)."
  BACKEND_URL=""
fi

echo "==> Installing dependencies"
cd "${FRONTEND_DIR}"
npm ci

echo "==> Writing .env.production"
cat > .env.production <<EOF
VITE_API_URL=${BACKEND_URL}
VITE_FIREBASE_PROJECT=bitcoin-perp-dex
EOF

echo "==> Building frontend"
npm run build

echo "==> Deploying to Firebase Hosting (project: bitcoin-perp-dex)"
npx firebase deploy --only hosting --project bitcoin-perp-dex

FRONTEND_URL="https://bitcoin-perp-dex.web.app"
echo ""
echo "==> Frontend deployed: ${FRONTEND_URL}"
echo ""
echo "NEXT STEPS:"
echo "  Update backend CORS to allow the frontend origin:"
echo "  gcloud run services update bitcoin-perp-dex-api --region us-central1 \\"
echo "    --update-env-vars CORS_ORIGINS=${FRONTEND_URL}"
