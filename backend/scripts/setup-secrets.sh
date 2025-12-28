#!/bin/bash

# BrickOptima Backend - Google Cloud Secret Manager Setup Script
# This script creates and manages secrets for Cloud Run deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: PROJECT_ID environment variable is not set${NC}"
    echo "Usage: export PROJECT_ID=your-gcp-project-id && ./setup-secrets.sh"
    exit 1
fi

echo -e "${GREEN}Setting up secrets for project: $PROJECT_ID${NC}"

# Load .env file
if [ -f ../.env ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    echo -e "${GREEN}Loaded environment variables from .env${NC}"
else
    echo -e "${YELLOW}Warning: .env file not found, using current environment variables${NC}"
fi

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2

    if [ -z "$secret_value" ]; then
        echo -e "${YELLOW}Skipping $secret_name: value is empty${NC}"
        return
    fi

    # Check if secret exists
    if gcloud secrets describe $secret_name --project=$PROJECT_ID &> /dev/null; then
        echo -e "${YELLOW}Secret $secret_name already exists, adding new version...${NC}"
        echo -n "$secret_value" | gcloud secrets versions add $secret_name \
            --data-file=- \
            --project=$PROJECT_ID
    else
        echo -e "${GREEN}Creating secret $secret_name...${NC}"
        echo -n "$secret_value" | gcloud secrets create $secret_name \
            --data-file=- \
            --replication-policy="automatic" \
            --project=$PROJECT_ID
    fi

    # Grant access to Cloud Run service account
    gcloud secrets add-iam-policy-binding $secret_name \
        --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor" \
        --project=$PROJECT_ID \
        --condition=None &> /dev/null

    echo -e "${GREEN}✓ Secret $secret_name configured${NC}"
}

# Prompt for Sentry DSN if not in environment
if [ -z "$SENTRY_DSN" ]; then
    echo -e "${YELLOW}SENTRY_DSN not found in environment${NC}"
    read -p "Enter your Sentry DSN (or press Enter to skip): " SENTRY_DSN
fi

# Create secrets
echo ""
echo -e "${GREEN}Creating/Updating secrets...${NC}"
echo ""

create_or_update_secret "DATABASE_URL" "$DATABASE_URL"
create_or_update_secret "JWT_SECRET" "$JWT_SECRET"
create_or_update_secret "GEMINI_API_KEY" "$GEMINI_API_KEY"
create_or_update_secret "SENTRY_DSN" "$SENTRY_DSN"
create_or_update_secret "SMTP_PASS" "$SMTP_PASS"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}All secrets configured successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "You can now deploy to Cloud Run using:"
echo "  gcloud builds submit --config=cloudbuild.yaml .."
echo ""
echo "Or manually deploy with:"
echo "  gcloud run deploy brickoptima-backend \\"
echo "    --image gcr.io/$PROJECT_ID/brickoptima-backend:latest \\"
echo "    --region us-central1 \\"
echo "    --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,SENTRY_DSN=SENTRY_DSN:latest,SMTP_PASS=SMTP_PASS:latest"
echo ""
