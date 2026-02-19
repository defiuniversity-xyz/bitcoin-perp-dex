#!/bin/bash
# Initialize Firebase project for Bitcoin Bank

set -e

PROJECT_ID="bitcoin-bank"
FRONTEND_DIR="frontend"

echo "=== Initializing Firebase for Bitcoin Bank ==="
echo ""

cd "$FRONTEND_DIR"

# Check if already initialized
if [ -f ".firebaserc" ]; then
    echo "Firebase already initialized. Skipping..."
    exit 0
fi

echo "Logging into Firebase..."
firebase login

echo ""
echo "Setting up Firebase project..."

# Create .firebaserc manually
cat > .firebaserc <<EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

echo "Firebase project configured: $PROJECT_ID"
echo ""
echo "firebase.json already exists with correct configuration"
echo ""
echo "To deploy, run: cd frontend && firebase deploy --only hosting"
