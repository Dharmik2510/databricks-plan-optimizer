# Google Cloud Secret Manager Setup Guide

This guide explains how to set up and manage secrets for BrickOptima using Google Cloud Secret Manager.

## Prerequisites

1. Google Cloud SDK installed and configured
2. Access to the GCP project: `gen-lang-client-0997977661`
3. Required IAM permissions:
   - `secretmanager.secrets.create`
   - `secretmanager.versions.add`
   - `secretmanager.versions.access`

## Step 1: Enable Secret Manager API

```bash
gcloud services enable secretmanager.googleapis.com --project=gen-lang-client-0997977661
```

## Step 2: Enable Artifact Registry API

```bash
gcloud services enable artifactregistry.googleapis.com --project=gen-lang-client-0997977661
```

## Step 3: Create Artifact Registry Repository

```bash
gcloud artifacts repositories create brickoptima \
  --repository-format=docker \
  --location=us-central1 \
  --description="BrickOptima Docker images" \
  --project=gen-lang-client-0997977661
```

## Step 4: Create Secrets in Secret Manager

### Database URL (Supabase Connection String)

```bash
echo -n "postgresql://user:password@host:5432/database" | \
  gcloud secrets create database-url \
    --replication-policy="automatic" \
    --data-file=- \
    --project=gen-lang-client-0997977661
```

**Important**: Replace the connection string with your actual Supabase PostgreSQL connection string.

### JWT Secret

Generate a secure random secret:

```bash
openssl rand -base64 64 | tr -d '\n' | \
  gcloud secrets create jwt-secret \
    --replication-policy="automatic" \
    --data-file=- \
    --project=gen-lang-client-0997977661
```

### Gemini API Key

```bash
echo -n "your-gemini-api-key" | \
  gcloud secrets create gemini-api-key \
    --replication-policy="automatic" \
    --data-file=- \
    --project=gen-lang-client-0997977661
```

## Step 5: Create Service Account for GitHub Actions

### Create the service account

```bash
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer" \
  --project=gen-lang-client-0997977661
```

### Grant necessary permissions

```bash
PROJECT_ID=gen-lang-client-0997977661
SA_EMAIL=github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com

# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

# Service Account User (to deploy as another service account)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer"

# Secret Manager Accessor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### Create and download service account key

```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions-deployer@gen-lang-client-0997977661.iam.gserviceaccount.com
```

> ⚠️ **Security Note**: Keep this key file secure. Delete it after adding to GitHub Secrets.

## Step 6: Configure GitHub Repository Secrets

Add these secrets to your GitHub repository at:
`https://github.com/YOUR_USERNAME/databricks-plan-optimizer/settings/secrets/actions`

| Secret Name | Value |
|-------------|-------|
| `GCP_SA_KEY` | Contents of `github-actions-key.json` |
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |

### How to add secrets in GitHub:

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret from the table above

## Step 7: Grant Cloud Run Service Account Access to Secrets

When Cloud Run deploys, it uses its own service account. Grant it access to secrets:

```bash
PROJECT_ID=gen-lang-client-0997977661
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to each secret
for SECRET in database-url jwt-secret gemini-api-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$COMPUTE_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID
done
```

## Updating Secrets

To update a secret value, add a new version:

```bash
echo -n "new-secret-value" | \
  gcloud secrets versions add SECRET_NAME \
    --data-file=- \
    --project=gen-lang-client-0997977661
```

The Cloud Run services will automatically pick up the latest version on the next deployment.

## Verifying Secrets

List all secrets:

```bash
gcloud secrets list --project=gen-lang-client-0997977661
```

View secret metadata:

```bash
gcloud secrets describe jwt-secret --project=gen-lang-client-0997977661
```

List secret versions:

```bash
gcloud secrets versions list jwt-secret --project=gen-lang-client-0997977661
```

## Security Best Practices

1. **Rotate secrets regularly**: Update secrets every 90 days
2. **Use least privilege**: Only grant necessary permissions
3. **Audit access**: Review Secret Manager audit logs regularly
4. **Don't log secrets**: Ensure secrets never appear in logs
5. **Use Workload Identity Federation**: For enhanced security, consider using Workload Identity Federation instead of service account keys

## Troubleshooting

### "Permission denied" errors

Ensure the service account has the `secretmanager.secretAccessor` role:

```bash
gcloud secrets get-iam-policy SECRET_NAME --project=gen-lang-client-0997977661
```

### Secret not found in Cloud Run

Verify the secret name matches exactly (case-sensitive):

```bash
gcloud run services describe brickoptima-backend \
  --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### Debugging secret access

Test secret access with the service account:

```bash
gcloud auth activate-service-account --key-file=github-actions-key.json
gcloud secrets versions access latest --secret=jwt-secret
```
