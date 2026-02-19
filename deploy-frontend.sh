#!/bin/bash
# Build and Deploy Frontend to Firebase Hosting

set -e

PROJECT_ID="bitcoin-bank-defi-u"
FRONTEND_DIR="frontend"

echo "=== Building and Deploying Frontend to Firebase ==="
echo ""

# Check if backend URL file exists
if [ -f ".backend-url.txt" ]; then
    BACKEND_URL=$(cat .backend-url.txt)
    echo "Using backend URL: $BACKEND_URL"
else
    echo "Warning: .backend-url.txt not found"
    echo "Please enter your Cloud Run backend URL:"
    read -p "Backend URL: " BACKEND_URL
fi

cd "$FRONTEND_DIR"

# Check if .firebaserc exists
if [ ! -f ".firebaserc" ]; then
    echo "Error: Firebase not initialized. Run ./deploy-firebase-init.sh first"
    exit 1
fi

echo ""
echo "Step 1: Installing dependencies..."
npm install

echo ""
echo "Step 2: Building frontend for production..."

# Create .env.production with backend URL
cat > .env.production <<EOF
VITE_API_URL=$BACKEND_URL
EOF

echo "Created .env.production with API URL: $BACKEND_URL"

# Build the frontend
npm run build

echo ""
echo "Step 3: Deploying to Firebase Hosting..."
firebase deploy --only hosting

# Get the hosting URL
HOSTING_URL=$(firebase hosting:channel:list 2>/dev/null | grep -o 'https://[^[:space:]]*web.app' | head -1)

if [ -z "$HOSTING_URL" ]; then
    # Fallback: construct URL from project ID
    HOSTING_URL="https://$PROJECT_ID.web.app"
fi

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Frontend URL: $HOSTING_URL"
echo "Backend URL: $BACKEND_URL"
echo ""
echo "Next steps:"
echo "1. Update Cloud Run CORS to allow the frontend URL:"
echo "   cd .."
echo "   gcloud run services update bitcoin-bank-api \\"
echo "     --region us-central1 \\"
echo "     --update-env-vars=\"CORS_ORIGINS=$HOSTING_URL,BASE_URL=$BACKEND_URL\""
echo ""
echo "2. Test the application at: $HOSTING_URL"
echo ""

# Save URLs for reference
cd ..
cat > .deployment-urls.txt <<EOF
Frontend: $HOSTING_URL
Backend: $BACKEND_URL
Deployed: $(date)
EOF

echo "Deployment URLs saved to .deployment-urls.txt"
