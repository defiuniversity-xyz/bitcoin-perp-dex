#!/bin/bash
# Generate Nostr Keys and Update Cloud Run Environment Variables

set -e

PROJECT_ID="bitcoin-bank-defi-u"
SERVICE_NAME="bitcoin-bank-api"
REGION="us-central1"

echo "=== Generating Nostr Keys for Bitcoin Bank ==="
echo ""

# Check if Python and nostr library are available
if ! python3 -c "import nostr" 2>/dev/null; then
    echo "Error: Python nostr library not found"
    echo "Installing nostr library..."
    pip3 install nostr-sdk || pip3 install nostr
fi

echo "Generating new Nostr key pair..."
echo ""

# Generate keys using Python
KEYS=$(python3 -c "
from nostr.key import PrivateKey
k = PrivateKey()
print(f'{k.hex()}')
print(f'{k.public_key.hex()}')
")

# Parse the output
PRIVATE_KEY=$(echo "$KEYS" | sed -n '1p')
PUBLIC_KEY=$(echo "$KEYS" | sed -n '2p')

echo "Generated Nostr Keys:"
echo "===================="
echo "Private Key (hex): $PRIVATE_KEY"
echo "Public Key (hex): $PUBLIC_KEY"
echo ""
echo "⚠️  IMPORTANT: Save the private key securely!"
echo "   This key controls your bank's Nostr identity."
echo ""

# Save to a secure file
cat > .nostr-keys.txt <<EOF
Bitcoin Bank Nostr Keys
Generated: $(date)

BANK_NOSTR_PRIVATE_KEY=$PRIVATE_KEY
BANK_NOSTR_PUBKEY=$PUBLIC_KEY

⚠️  KEEP THIS FILE SECURE AND NEVER COMMIT TO GIT
EOF

echo "Keys saved to .nostr-keys.txt (gitignored)"
echo ""

# Prompt user to update Cloud Run
read -p "Update Cloud Run service with these keys? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Updating Cloud Run environment variables..."
    
    # Get current env vars
    CURRENT_VARS=$(gcloud run services describe $SERVICE_NAME \
        --region $REGION \
        --format 'value(spec.template.spec.containers[0].env)' 2>/dev/null || echo "")
    
    # Update with new keys
    gcloud run services update $SERVICE_NAME \
        --region $REGION \
        --update-env-vars="BANK_NOSTR_PRIVATE_KEY=$PRIVATE_KEY,BANK_NOSTR_PUBKEY=$PUBLIC_KEY"
    
    echo ""
    echo "✓ Cloud Run service updated with Nostr keys"
else
    echo ""
    echo "Skipped Cloud Run update. To update manually, run:"
    echo ""
    echo "gcloud run services update $SERVICE_NAME \\"
    echo "  --region $REGION \\"
    echo "  --update-env-vars=\"BANK_NOSTR_PRIVATE_KEY=$PRIVATE_KEY,BANK_NOSTR_PUBKEY=$PUBLIC_KEY\""
fi

echo ""
echo "For production, consider using Google Secret Manager:"
echo ""
echo "# Create secret"
echo "echo -n '$PRIVATE_KEY' | gcloud secrets create bank-nostr-key --data-file=-"
echo ""
echo "# Grant access to Cloud Run"
echo "gcloud secrets add-iam-policy-binding bank-nostr-key \\"
echo "  --member='serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com' \\"
echo "  --role='roles/secretmanager.secretAccessor'"
echo ""
echo "# Update Cloud Run to use secret"
echo "gcloud run services update $SERVICE_NAME \\"
echo "  --region $REGION \\"
echo "  --update-secrets=BANK_NOSTR_PRIVATE_KEY=bank-nostr-key:latest"
echo ""
