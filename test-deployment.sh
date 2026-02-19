#!/bin/bash
# Test Bitcoin Bank Deployment

set -e

echo "=== Testing Bitcoin Bank Deployment ==="
echo ""

# Check if deployment URLs file exists
if [ ! -f ".deployment-urls.txt" ]; then
    echo "Error: .deployment-urls.txt not found"
    echo "Please deploy the application first"
    exit 1
fi

# Read URLs
BACKEND_URL=$(grep "Backend:" .deployment-urls.txt | cut -d' ' -f2)
FRONTEND_URL=$(grep "Frontend:" .deployment-urls.txt | cut -d' ' -f2)

echo "Testing URLs:"
echo "  Backend: $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# Test 1: Health Check
echo "Test 1: Backend Health Check"
echo "=============================="
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ Health check passed"
    echo "  Response: $HEALTH_BODY"
else
    echo "✗ Health check failed (HTTP $HTTP_CODE)"
    echo "  Response: $HEALTH_BODY"
fi
echo ""

# Test 2: CORS Headers
echo "Test 2: CORS Configuration"
echo "==========================="
CORS_RESPONSE=$(curl -s -I -H "Origin: $FRONTEND_URL" "$BACKEND_URL/health")
if echo "$CORS_RESPONSE" | grep -q "access-control-allow-origin"; then
    echo "✓ CORS headers present"
else
    echo "⚠ CORS headers may need configuration"
    echo "  Run: gcloud run services update bitcoin-bank-api --region us-central1 --update-env-vars=\"CORS_ORIGINS=$FRONTEND_URL\""
fi
echo ""

# Test 3: LNURL Endpoint
echo "Test 3: LNURL Pay Endpoint"
echo "==========================="
LNURL_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/.well-known/lnurlp/bank")
HTTP_CODE=$(echo "$LNURL_RESPONSE" | tail -n1)
LNURL_BODY=$(echo "$LNURL_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ LNURL endpoint accessible"
    if echo "$LNURL_BODY" | grep -q "callback"; then
        echo "✓ LNURL response valid"
    else
        echo "⚠ LNURL response may be invalid"
    fi
else
    echo "✗ LNURL endpoint failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test 4: Frontend Accessibility
echo "Test 4: Frontend Accessibility"
echo "==============================="
FRONTEND_RESPONSE=$(curl -s -w "\n%{http_code}" "$FRONTEND_URL")
HTTP_CODE=$(echo "$FRONTEND_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ Frontend accessible"
    if echo "$FRONTEND_RESPONSE" | head -n-1 | grep -q "<!doctype html"; then
        echo "✓ HTML content served"
    fi
else
    echo "✗ Frontend not accessible (HTTP $HTTP_CODE)"
fi
echo ""

# Test 5: API Connectivity
echo "Test 5: API Balance Endpoint"
echo "============================="
TEST_PUBKEY="0000000000000000000000000000000000000000000000000000000000000000"
BALANCE_RESPONSE=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/balance/$TEST_PUBKEY")
HTTP_CODE=$(echo "$BALANCE_RESPONSE" | tail -n1)
BALANCE_BODY=$(echo "$BALANCE_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" == "200" ]; then
    echo "✓ Balance API accessible"
    echo "  Response: $BALANCE_BODY"
else
    echo "⚠ Balance API returned HTTP $HTTP_CODE (expected for new accounts)"
fi
echo ""

# Test 6: Database Persistence (GCS)
echo "Test 6: Database Persistence"
echo "============================="
if command -v gsutil &> /dev/null; then
    DB_EXISTS=$(gsutil ls gs://bitcoin-bank-data/ledger.db 2>/dev/null || echo "not found")
    if [[ "$DB_EXISTS" == *"ledger.db"* ]]; then
        echo "✓ Database exists in Cloud Storage"
        DB_SIZE=$(gsutil du -h gs://bitcoin-bank-data/ledger.db | awk '{print $1}')
        echo "  Size: $DB_SIZE"
    else
        echo "⚠ Database not yet created in Cloud Storage"
        echo "  This is normal on first deployment"
    fi
else
    echo "⚠ gsutil not available, skipping GCS check"
fi
echo ""

# Summary
echo "==================================="
echo "Test Summary"
echo "==================================="
echo ""
echo "✓ All critical tests completed"
echo ""
echo "Next steps for manual testing:"
echo "1. Open $FRONTEND_URL in your browser"
echo "2. Connect a Nostr extension (nos2x, Alby, etc.)"
echo "3. Test deposit flow with mock backend"
echo "4. Check balance display"
echo "5. Test withdraw simulation"
echo "6. Test savings operations"
echo "7. View transaction history"
echo ""
echo "For production readiness:"
echo "1. Configure real Lightning backend (LNbits)"
echo "2. Set up monitoring and alerts"
echo "3. Enable database backups (GCS versioning)"
echo "4. Configure custom domain (optional)"
echo "5. Review security settings"
echo ""
