# Terraform Configuration for BrickOptima Secrets

This Terraform configuration manages all Google Cloud Secret Manager secrets for the BrickOptima application in a single, unified way.

## Prerequisites

1. **Install Terraform**: [Download Terraform](https://www.terraform.io/downloads)
2. **Install gcloud CLI**: [Install gcloud](https://cloud.google.com/sdk/docs/install)
3. **Authenticate with GCP**:
   ```bash
   gcloud auth application-default login
   ```

## Setup Instructions

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Create Your Variables File

Copy the example file and fill in your actual values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your actual secret values. **Never commit this file!**

### 3. Review the Plan

See what Terraform will create:

```bash
terraform plan
```

### 4. Apply the Configuration

Create all secrets and resources:

```bash
terraform apply
```

Type `yes` when prompted to confirm.

## What Gets Created

This Terraform configuration creates:

1. **6 Secrets in Secret Manager**:
   - `database-url` - PostgreSQL connection string
   - `jwt-secret` - JWT signing secret
   - `gemini-api-key` - Google Gemini API key
   - `SMTP_PASS` - SMTP password
   - `smtp-user` - SMTP username
   - `frontend-url` - Frontend URL

2. **IAM Permissions**:
   - Grants Cloud Run service account access to all secrets
   - Grants GitHub Actions service account access to all secrets

3. **Artifact Registry**:
   - Docker repository for BrickOptima images

4. **Enabled APIs**:
   - Secret Manager API
   - Cloud Run API
   - Artifact Registry API

## Updating Secrets

To update a secret value:

1. Edit the value in `terraform.tfvars`
2. Run `terraform apply`
3. Terraform will create a new version of the secret
4. Redeploy your Cloud Run services to pick up the new value

## Managing Secrets Individually (Alternative Approach)

If you prefer to manage secrets individually instead of all together, you can use `terraform apply -target`:

### Update only database URL:
```bash
terraform apply -target=google_secret_manager_secret_version.database_url
```

### Update only JWT secret:
```bash
terraform apply -target=google_secret_manager_secret_version.jwt_secret
```

### Update only Gemini API key:
```bash
terraform apply -target=google_secret_manager_secret_version.gemini_api_key
```

## Using Environment Variables (Alternative to tfvars)

Instead of using `terraform.tfvars`, you can set environment variables:

```bash
export TF_VAR_database_url="postgresql://..."
export TF_VAR_jwt_secret="your-jwt-secret"
export TF_VAR_gemini_api_key="your-api-key"
export TF_VAR_smtp_pass="your-smtp-password"
export TF_VAR_smtp_user="brickoptima@gmail.com"
export TF_VAR_frontend_url="https://your-frontend.run.app"

terraform apply
```

## Viewing Current State

### List all secrets:
```bash
terraform state list | grep google_secret_manager_secret
```

### Show details of a specific secret:
```bash
terraform state show google_secret_manager_secret.database_url
```

### View outputs:
```bash
terraform output
```

## Importing Existing Secrets

If you already created secrets manually, you can import them:

```bash
# Import secret resource
terraform import google_secret_manager_secret.database_url projects/gen-lang-client-0997977661/secrets/database-url

# Import secret version
terraform import google_secret_manager_secret_version.database_url projects/gen-lang-client-0997977661/secrets/database-url/versions/latest
```

## Security Best Practices

1. **Never commit `terraform.tfvars`** - It contains sensitive data
2. **Use remote state** - Consider storing Terraform state in GCS bucket
3. **Rotate secrets regularly** - Update values every 90 days
4. **Review IAM permissions** - Ensure least privilege access
5. **Enable audit logging** - Monitor secret access in Cloud Console

## Troubleshooting

### Authentication Issues
```bash
gcloud auth application-default login
gcloud config set project gen-lang-client-0997977661
```

### Permission Denied
Ensure your account has these roles:
- `roles/secretmanager.admin`
- `roles/iam.securityAdmin`
- `roles/artifactregistry.admin`

### State Lock Issues
If Terraform state is locked, you can force unlock (use carefully):
```bash
terraform force-unlock <LOCK_ID>
```

## Cleanup

To destroy all resources created by Terraform:

```bash
terraform destroy
```

**Warning**: This will delete all secrets and the artifact registry repository!

## Next Steps

After applying this configuration:

1. Update your GitHub workflow to use the secrets
2. Redeploy Cloud Run services to pick up the new secret references
3. Verify services can access secrets: `gcloud run services describe brickoptima-backend`
