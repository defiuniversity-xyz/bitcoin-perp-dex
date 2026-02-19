# Bitcoin Bank - Google Cloud Deployment Guide

Complete guide to deploy Bitcoin Bank on Google Cloud Platform (Cloud Run) and Firebase Hosting.

## Quick Start

Deploy the entire application in 4 steps:

```bash
# 1. Setup GCP and Firebase projects
./deploy-setup.sh

# 2. Deploy backend to Cloud Run
./deploy-backend.sh

# 3. Deploy frontend to Firebase Hosting
./deploy-frontend.sh

# 4. Generate Nostr keys for production
./generate-nostr-keys.sh
```

## Prerequisites

Before deploying, ensure you have:

- **Google Cloud account** with billing enabled
- **gcloud CLI** installed and configured ([Install Guide](https://cloud.google.com/sdk/docs/install))
- **Firebase CLI** installed: `npm install -g firebase-tools`
- **Node.js** and **npm** installed (v18 or later)
- **Python 3.9+** with pip

## Architecture

The deployment consists of:

- **Backend**: Python Flask API on Cloud Run (serverless containers)
- **Frontend**: React/TypeScript SPA on Firebase Hosting (free tier)
- **Database**: SQLite persisted to Cloud Storage bucket
- **Lightning**: Mock backend (configurable to LNbits for production)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       v                 v
┌─────────────┐   ┌─────────────┐
│  Firebase   │   │  Cloud Run  │
│  Hosting    │   │   Backend   │
└─────────────┘   └──────┬──────┘
                         │
                         v
                  ┌─────────────┐
                  │   Cloud     │
                  │   Storage   │
                  │  (SQLite)   │
                  └─────────────┘
```

## Detailed Deployment Steps

### Step 1: GCP and Firebase Setup

Run the setup script to create and configure your Google Cloud project:

```bash
./deploy-setup.sh
```

This script will:
1. Authenticate with Google Cloud
2. Create project "bitcoin-bank"
3. Enable required APIs (Cloud Run, Cloud Storage, Cloud Build)
4. Create Cloud Storage bucket for database
5. Initialize Firebase project

**Important**: You'll need to enable billing in the Google Cloud Console when prompted.

### Step 2: Deploy Backend

Deploy the Python Flask backend to Cloud Run:

```bash
./deploy-backend.sh
```

This will:
1. Build the Docker container from source
2. Deploy to Cloud Run in `us-central1` region
3. Configure environment variables (mock Lightning backend, GCS bucket)
4. Set up autoscaling (0-10 instances)
5. Save the backend URL to `.backend-url.txt`

**Expected output**: Backend URL like `https://bitcoin-bank-api-xxxxx-uc.a.run.app`

### Step 3: Deploy Frontend

Build and deploy the React frontend to Firebase Hosting:

```bash
./deploy-frontend.sh
```

This will:
1. Install frontend dependencies
2. Create `.env.production` with backend URL
3. Build the React app for production
4. Deploy to Firebase Hosting
5. Display the frontend URL

**Expected output**: Frontend URL like `https://bitcoin-bank.web.app`

The script will also output a command to update CORS settings on the backend.

### Step 4: Generate Nostr Keys

Generate production Nostr keys for the bank's identity:

```bash
./generate-nostr-keys.sh
```

This will:
1. Generate a new Nostr key pair
2. Save keys securely to `.nostr-keys.txt` (gitignored)
3. Optionally update Cloud Run with the keys

**⚠️ IMPORTANT**: Keep the private key secure! This controls your bank's Nostr identity.

### Step 5: Update CORS (Required)

After frontend deployment, update the backend to allow requests from the frontend:

```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://bitcoin-bank.web.app,BASE_URL=https://bitcoin-bank-api-xxxxx-uc.a.run.app"
```

Replace with your actual URLs from the deployment outputs.

## Testing the Deployment

Run the automated test suite:

```bash
./test-deployment.sh
```

This tests:
- ✓ Backend health endpoint
- ✓ CORS configuration
- ✓ LNURL pay endpoint
- ✓ Frontend accessibility
- ✓ API connectivity
- ✓ Database persistence

### Manual Testing Checklist

1. **Open the frontend** at your Firebase URL
2. **Connect Nostr extension** (nos2x, Alby, etc.)
3. **Test deposit flow**:
   - Request deposit invoice
   - Simulate payment (mock backend)
   - Verify balance update
4. **Test withdrawals**:
   - Create Lightning invoice
   - Withdraw from balance
   - Check transaction history
5. **Test savings**:
   - Move sats to savings
   - Check APY display
   - Move sats back to spendable
6. **Test card features** (if using Brahma integration)

## Configuration

### Environment Variables

The backend supports these environment variables (set via Cloud Run):

| Variable | Default | Description |
|----------|---------|-------------|
| `LIGHTNING_BACKEND` | mock | `mock` or `lnbits` |
| `GCS_BUCKET` | bitcoin-bank-data | Cloud Storage bucket name |
| `GCS_DB_PATH` | ledger.db | Database path in bucket |
| `BASE_URL` | (required) | Backend URL for LNURL callbacks |
| `CORS_ORIGINS` | (required) | Comma-separated allowed origins |
| `BANK_NOSTR_PRIVATE_KEY` | (generated) | Bank's Nostr private key (hex) |
| `BANK_NOSTR_PUBKEY` | (generated) | Bank's Nostr public key (hex) |
| `DEBUG` | false | Enable debug logging |

### Update Environment Variables

```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="KEY1=value1,KEY2=value2"
```

### Configure Real Lightning (LNbits)

To use real Lightning instead of mock:

1. **Get LNbits API key** from your LNbits instance
2. **Update Cloud Run**:

```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="LIGHTNING_BACKEND=lnbits,LNBITS_URL=https://your-lnbits.com,LNBITS_INVOICE_KEY=YOUR_API_KEY"
```

3. **Configure webhook** in LNbits to point to: `https://your-backend-url/api/webhook/lightning`

## Cost Estimates

### Google Cloud (Free Tier)

**Cloud Run:**
- 2M requests/month free
- 360,000 GB-seconds memory free
- Estimated: **$0-5/month** for low traffic

**Cloud Storage:**
- 5 GB storage free
- 1 GB network egress free
- Estimated: **$0/month** for database

### Firebase Hosting (Spark Plan - Free)

- 10 GB storage
- 360 MB/day data transfer
- Estimated: **$0/month**

**Total**: $0-5/month for low to moderate traffic

## Monitoring

### View Logs

**Backend logs:**
```bash
gcloud run services logs read bitcoin-bank-api --region us-central1 --limit 50
```

**Live tail:**
```bash
gcloud run services logs tail bitcoin-bank-api --region us-central1
```

**Firebase logs:**
Visit Firebase Console → Hosting → Usage

### Set Up Alerts

1. Go to [Cloud Monitoring](https://console.cloud.google.com/monitoring)
2. Create alert policies for:
   - High error rate (>5%)
   - High latency (>2 seconds)
   - Storage quota exceeded

## Security Best Practices

### 1. Use Secret Manager for Sensitive Data

Instead of environment variables, use Google Secret Manager:

```bash
# Create secret
echo -n "YOUR_SECRET_VALUE" | gcloud secrets create secret-name --data-file=-

# Grant Cloud Run access
PROJECT_NUMBER=$(gcloud projects describe bitcoin-bank --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding secret-name \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use secret
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-secrets=ENV_VAR_NAME=secret-name:latest
```

### 2. Enable Database Backups

Enable versioning on the Cloud Storage bucket:

```bash
gsutil versioning set on gs://bitcoin-bank-data
```

This automatically keeps backup versions of your database.

### 3. Restrict CORS

In production, only allow your specific frontend domain:

```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://bitcoin-bank.web.app"
```

### 4. Set Up Custom Domain (Optional)

Requires Firebase Blaze (pay-as-you-go) plan:

1. Upgrade to Blaze plan in Firebase Console
2. Add custom domain in Hosting settings
3. Update Cloud Run custom domain
4. Update CORS and BASE_URL accordingly

## Troubleshooting

### Backend Not Responding

```bash
# Check service status
gcloud run services describe bitcoin-bank-api --region us-central1

# View recent logs
gcloud run services logs read bitcoin-bank-api --region us-central1 --limit 50

# Test health endpoint
curl https://your-backend-url/health
```

### Frontend Not Loading

```bash
# Check Firebase deployment
firebase hosting:channel:list

# Redeploy
cd frontend && firebase deploy --only hosting
```

### CORS Errors

Ensure CORS_ORIGINS includes your frontend URL:

```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://bitcoin-bank.web.app"
```

### Database Not Persisting

Check if GCS sync is enabled:

```bash
# View Cloud Run env vars
gcloud run services describe bitcoin-bank-api \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Verify bucket exists
gsutil ls gs://bitcoin-bank-data
```

## Rollback

If deployment fails or has issues:

**Backend rollback:**
```bash
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --image=gcr.io/bitcoin-bank/bitcoin-bank-api:PREVIOUS_TAG
```

**Frontend rollback:**
```bash
cd frontend
firebase hosting:rollback
```

## Updating the Application

To update after making code changes:

```bash
# Update backend
./deploy-backend.sh

# Update frontend
./deploy-frontend.sh
```

The scripts handle building and deploying the updated code.

## CI/CD Setup (Optional)

For automatic deployments on git push, set up GitHub Actions:

1. Add secrets to GitHub repository:
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY` (Service Account JSON)
   - `FIREBASE_TOKEN`

2. Create `.github/workflows/deploy.yml` with deployment workflow

3. Push to main branch to trigger automatic deployment

## Support

For issues or questions:

- **Documentation**: See main README.md for application features
- **Deployment Plan**: See the deployment plan file for architecture details
- **Logs**: Check Cloud Run and Firebase logs for errors
- **Testing**: Run `./test-deployment.sh` to diagnose issues

## Next Steps

After successful deployment:

1. **Test all features** thoroughly with the mock backend
2. **Configure real Lightning** when ready for production
3. **Set up monitoring** and alerts
4. **Enable database backups** with GCS versioning
5. **Consider custom domain** for professional branding
6. **Review security settings** and use Secret Manager
7. **Monitor costs** in Google Cloud Console

Congratulations! Your Bitcoin Bank is now deployed on Google Cloud! 🎉
