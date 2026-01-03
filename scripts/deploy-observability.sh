#!/bin/bash

################################################################################
# GCP Observability Deployment Script
#
# Deploys all Phase 5 observability infrastructure using Terraform
################################################################################

set -e

PROJECT_ID="${GCP_PROJECT_ID:-gen-lang-client-0997977661}"
TERRAFORM_DIR="../terraform"

echo "========================================="
echo "Deploying GCP Observability Infrastructure"
echo "========================================="
echo "Project: $PROJECT_ID"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

################################################################################
# 1. Validate Terraform Configuration
################################################################################
echo -e "${YELLOW}[1/5] Validating Terraform configuration...${NC}"
cd ${TERRAFORM_DIR}
terraform init -upgrade
terraform validate
echo -e "${GREEN}✓ Terraform configuration valid${NC}"

################################################################################
# 2. Plan Infrastructure Changes
################################################################################
echo ""
echo -e "${YELLOW}[2/5] Planning infrastructure changes...${NC}"
terraform plan -out=observability.tfplan
echo -e "${GREEN}✓ Terraform plan created${NC}"

################################################################################
# 3. Apply Infrastructure Changes
################################################################################
echo ""
echo -e "${YELLOW}[3/5] Applying infrastructure changes...${NC}"
read -p "Do you want to apply these changes? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

terraform apply observability.tfplan
rm -f observability.tfplan
echo -e "${GREEN}✓ Infrastructure deployed${NC}"

################################################################################
# 4. Wait for Log Sinks to Initialize
################################################################################
echo ""
echo -e "${YELLOW}[4/5] Waiting for log sinks to initialize (30 seconds)...${NC}"
sleep 30
echo -e "${GREEN}✓ Log sinks should be active${NC}"

################################################################################
# 5. Verify Deployment
################################################################################
echo ""
echo -e "${YELLOW}[5/5] Verifying deployment...${NC}"
cd ../scripts
./test-observability.sh

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
