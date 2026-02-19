# Bitcoin Bank - Quick Deployment Reference

## One-Command Deployment

```bash
./deploy-all.sh
```

This single command deploys everything: GCP setup, backend, frontend, and configuration.

## Individual Deployment Steps

If you prefer step-by-step deployment:

```bash
./deploy-setup.sh          # Setup GCP and Firebase
./deploy-backend.sh         # Deploy backend to Cloud Run
./deploy-frontend.sh        # Deploy frontend to Firebase
./generate-nostr-keys.sh    # Generate Nostr keys
./test-deployment.sh        # Test the deployment
```

## Quick Commands Reference

### Deployment

| Command | Description |
|---------|-------------|
| `./deploy-all.sh` | Complete deployment (all steps) |
| `./deploy-setup.sh` | Setup GCP and Firebase projects |
| `./deploy-backend.sh` | Deploy backend to Cloud Run |
| `./deploy-frontend.sh` | Build and deploy frontend |
| `./generate-nostr-keys.sh` | Generate production Nostr keys |
| `./test-deployment.sh` | Run deployment tests |

### Monitoring

```bash
# View backend logs
gcloud run services logs read bitcoin-bank-api --region us-central1

# Tail logs (live)
gcloud run services logs tail bitcoin-bank-api --region us-central1

# Check service status
gcloud run services describe bitcoin-bank-api --region us-central1

# List deployments
gcloud run services list --region us-central1
```

### Configuration

```bash
# Update environment variables
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="KEY=value,KEY2=value2"

# View current env vars
gcloud run services describe bitcoin-bank-api \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"

# Configure real Lightning
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="LIGHTNING_BACKEND=lnbits,LNBITS_URL=https://your-lnbits.com,LNBITS_INVOICE_KEY=YOUR_KEY"
```

### Database

```bash
# Check database in Cloud Storage
gsutil ls -lh gs://bitcoin-bank-data/

# Download database backup
gsutil cp gs://bitcoin-bank-data/ledger.db ./backup-ledger.db

# Enable versioning (backups)
gsutil versioning set on gs://bitcoin-bank-data

# List versions
gsutil ls -a gs://bitcoin-bank-data/ledger.db
```

### Frontend

```bash
# Deploy frontend
cd frontend && firebase deploy --only hosting

# Rollback frontend
firebase hosting:rollback

# View hosting status
firebase hosting:channel:list
```

### Costs & Billing

```bash
# View current month costs
gcloud billing accounts list
gcloud billing projects describe bitcoin-bank

# Set budget alerts (via Console)
# https://console.cloud.google.com/billing/budget
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `GCS_BUCKET` | Cloud Storage bucket for SQLite | `bitcoin-bank-data` |
| `BASE_URL` | Backend URL for LNURL | `https://xxx.run.app` |
| `CORS_ORIGINS` | Allowed frontend origins | `https://xxx.web.app` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `LIGHTNING_BACKEND` | `mock` | `mock` or `lnbits` |
| `BANK_NOSTR_PRIVATE_KEY` | (generated) | Nostr private key (hex) |
| `BANK_NOSTR_PUBKEY` | (generated) | Nostr public key (hex) |
| `DEBUG` | `false` | Enable debug logging |
| `SAVINGS_APY` | `0` | Display APY for savings |

## Troubleshooting

### Backend Issues

```bash
# Check health
curl https://YOUR-BACKEND-URL/health

# View recent errors
gcloud run services logs read bitcoin-bank-api \
  --region us-central1 \
  --limit 50 \
  --filter="severity=ERROR"

# Restart service (redeploy)
./deploy-backend.sh
```

### Frontend Issues

```bash
# Check build errors
cd frontend && npm run build

# Clear cache and rebuild
rm -rf frontend/dist frontend/node_modules
cd frontend && npm install && npm run build

# Redeploy
cd frontend && firebase deploy --only hosting
```

### CORS Errors

```bash
# Update CORS to include frontend URL
gcloud run services update bitcoin-bank-api \
  --region us-central1 \
  --update-env-vars="CORS_ORIGINS=https://bitcoin-bank.web.app"
```

### Database Not Persisting

```bash
# Check if bucket exists
gsutil ls gs://bitcoin-bank-data

# Check env vars
gcloud run services describe bitcoin-bank-api \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)" \
  | grep GCS
```

## URLs After Deployment

Your deployment URLs are saved in `.deployment-urls.txt`:

```
Frontend: https://bitcoin-bank-XXXXX.web.app
Backend:  https://bitcoin-bank-api-XXXXX-uc.a.run.app
```

## Security Checklist

- [ ] Nostr keys generated and stored securely
- [ ] CORS configured to only allow frontend domain
- [ ] Cloud Storage bucket versioning enabled
- [ ] Secrets moved to Secret Manager (production)
- [ ] Monitoring and alerts configured
- [ ] Budget alerts set up
- [ ] Lightning backend webhooks secured (production)

## Cost Optimization

### Free Tier Limits

**Cloud Run**: 2M requests/month, 360,000 GB-seconds
**Cloud Storage**: 5 GB, 1 GB egress
**Firebase**: 10 GB storage, 360 MB/day transfer

### Tips

- Keep `--min-instances=0` to scale to zero
- Use `--memory=512Mi` (adequate for most use)
- Enable Cloud Storage lifecycle policies
- Monitor usage in Console

## Support

- **Full Guide**: See `DEPLOYMENT.md`
- **App Documentation**: See `README.md`
- **Cloud Console**: https://console.cloud.google.com
- **Firebase Console**: https://console.firebase.google.com

## Quick Links

- GCP Console: https://console.cloud.google.com/run?project=bitcoin-bank
- Firebase Console: https://console.firebase.google.com/project/bitcoin-bank
- Cloud Storage: https://console.cloud.google.com/storage/browser/bitcoin-bank-data
- Logs: https://console.cloud.google.com/logs/query?project=bitcoin-bank

---

**Need help?** Run `./test-deployment.sh` to diagnose issues.
