#!/bin/bash
# Master Deployment Script for Bitcoin Bank
# Deploys the complete application to Google Cloud and Firebase

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║       Bitcoin Bank - Complete Deployment Script         ║"
echo "║                                                          ║"
echo "║         Deploying to Google Cloud + Firebase            ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ID="bitcoin-bank-defi-u"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_step "Step 0: Checking Prerequisites"

if ! command -v gcloud &> /dev/null; then
    print_error "gcloud CLI not found. Please install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi
print_success "gcloud CLI found"

if ! command -v firebase &> /dev/null; then
    print_error "firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi
print_success "firebase CLI found"

if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install Node.js"
    exit 1
fi
print_success "npm found"

if ! command -v python3 &> /dev/null; then
    print_error "python3 not found. Please install Python 3.9+"
    exit 1
fi
print_success "python3 found"

# Ask for confirmation
echo ""
echo "This script will:"
echo "  1. Set up GCP project '$PROJECT_ID'"
echo "  2. Deploy backend to Cloud Run"
echo "  3. Deploy frontend to Firebase Hosting"
echo "  4. Generate Nostr keys"
echo "  5. Configure CORS"
echo "  6. Test the deployment"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Setup
print_step "Step 1: Setting Up GCP and Firebase"
./deploy-setup.sh
print_success "Setup complete"

# Step 2: Backend
print_step "Step 2: Deploying Backend to Cloud Run"
./deploy-backend.sh

if [ ! -f ".backend-url.txt" ]; then
    print_error "Backend deployment failed - URL not found"
    exit 1
fi

BACKEND_URL=$(cat .backend-url.txt)
print_success "Backend deployed: $BACKEND_URL"

# Step 3: Frontend
print_step "Step 3: Deploying Frontend to Firebase"
./deploy-frontend.sh

if [ ! -f ".deployment-urls.txt" ]; then
    print_error "Frontend deployment failed - URLs not found"
    exit 1
fi

FRONTEND_URL=$(grep "Frontend:" .deployment-urls.txt | cut -d' ' -f2)
print_success "Frontend deployed: $FRONTEND_URL"

# Step 4: Nostr Keys
print_step "Step 4: Generating Nostr Keys"
echo "Generating keys automatically..."

# Generate keys silently
KEYS=$(python3 -c "
from nostr.key import PrivateKey
k = PrivateKey()
print(f'{k.hex()}')
print(f'{k.public_key.hex()}')
" 2>/dev/null || echo "")

if [ -z "$KEYS" ]; then
    print_warning "Failed to generate keys automatically"
    echo "You can generate them later with: ./generate-nostr-keys.sh"
else
    PRIVATE_KEY=$(echo "$KEYS" | sed -n '1p')
    PUBLIC_KEY=$(echo "$KEYS" | sed -n '2p')
    
    # Save keys
    cat > .nostr-keys.txt <<EOF
Bitcoin Bank Nostr Keys
Generated: $(date)

BANK_NOSTR_PRIVATE_KEY=$PRIVATE_KEY
BANK_NOSTR_PUBKEY=$PUBLIC_KEY

⚠️  KEEP THIS FILE SECURE AND NEVER COMMIT TO GIT
EOF
    
    print_success "Nostr keys generated and saved to .nostr-keys.txt"
    
    # Update Cloud Run with keys
    echo "Updating Cloud Run with Nostr keys..."
    gcloud run services update bitcoin-bank-api \
        --region us-central1 \
        --update-env-vars="BANK_NOSTR_PRIVATE_KEY=$PRIVATE_KEY,BANK_NOSTR_PUBKEY=$PUBLIC_KEY" \
        --quiet
    
    print_success "Cloud Run updated with Nostr keys"
fi

# Step 5: Update CORS
print_step "Step 5: Updating CORS Configuration"
echo "Updating backend CORS to allow frontend..."

gcloud run services update bitcoin-bank-api \
    --region us-central1 \
    --update-env-vars="CORS_ORIGINS=$FRONTEND_URL,BASE_URL=$BACKEND_URL" \
    --quiet

print_success "CORS configured"

# Wait for services to update
echo ""
echo "Waiting for services to update..."
sleep 10

# Step 6: Test
print_step "Step 6: Testing Deployment"
./test-deployment.sh

# Final Summary
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║              🎉 Deployment Complete! 🎉                  ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Your Bitcoin Bank is now live!${NC}"
echo ""
echo "📱 Frontend URL:  $FRONTEND_URL"
echo "🔧 Backend URL:   $BACKEND_URL"
echo ""
echo "Next Steps:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Open your app:  $FRONTEND_URL"
echo ""
echo "2. Connect Nostr extension (nos2x, Alby, etc.)"
echo ""
echo "3. Test the mock Lightning backend:"
echo "   - Request deposit"
echo "   - Simulate payment"
echo "   - Check balance"
echo ""
echo "4. Configure real Lightning (when ready):"
echo "   gcloud run services update bitcoin-bank-api \\"
echo "     --region us-central1 \\"
echo "     --update-env-vars=\"LIGHTNING_BACKEND=lnbits,LNBITS_URL=https://your-lnbits.com,LNBITS_INVOICE_KEY=YOUR_KEY\""
echo ""
echo "5. Set up monitoring and alerts"
echo ""
echo "6. Enable database backups:"
echo "   gsutil versioning set on gs://bitcoin-bank-data"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📖 Full documentation: See DEPLOYMENT.md"
echo "🔑 Your Nostr keys: See .nostr-keys.txt (keep secure!)"
echo "📊 View logs:"
echo "   gcloud run services logs read bitcoin-bank-api --region us-central1"
echo ""
echo -e "${GREEN}Happy banking! ⚡${NC}"
echo ""
