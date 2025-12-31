#!/bin/bash

# ============================================================================
# Production Setup Script for Databricks Plan Optimizer
# ============================================================================

set -e  # Exit on error

echo "🚀 Setting up Production Environment for Databricks Plan Optimizer"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ----------------------------------------------------------------------------
# Step 1: Check Prerequisites
# ----------------------------------------------------------------------------
echo "📋 Checking prerequisites..."

# Check if Docker is running (optional)
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is running${NC}"
    DOCKER_AVAILABLE=true
else
    echo -e "${YELLOW}⚠️  Docker is not running (optional for in-memory mode)${NC}"
    DOCKER_AVAILABLE=false
fi

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file"
        ENV_EXISTS=true
    else
        ENV_EXISTS=false
    fi
else
    ENV_EXISTS=false
fi

# ----------------------------------------------------------------------------
# Step 2: Configure Environment Variables
# ----------------------------------------------------------------------------
if [ "$ENV_EXISTS" = false ]; then
    echo ""
    echo "🔧 Configuring environment variables..."

    # Ask for OpenAI API key
    echo ""
    echo "OpenAI API Key is required for semantic matching (85-95% accuracy)"
    echo "Get your key from: https://platform.openai.com/api-keys"
    echo "Cost: ~$0.01-$0.20/month for typical repositories"
    read -p "Enter your OpenAI API key: " OPENAI_KEY

    # Ask for ChromaDB setup preference
    echo ""
    echo "ChromaDB Options:"
    echo "1) Docker (Recommended - persistent storage)"
    echo "2) In-Memory (Development only - data lost on restart)"
    echo "3) ChromaDB Cloud (Easiest for production)"
    read -p "Choose ChromaDB option (1/2/3): " CHROMA_OPTION

    # Create .env file
    cp .env.production.example .env

    # Update OpenAI key
    if [ ! -z "$OPENAI_KEY" ]; then
        sed -i '' "s|OPENAI_API_KEY=sk-proj-your-actual-key-here|OPENAI_API_KEY=$OPENAI_KEY|g" .env
    fi

    # Update ChromaDB config based on choice
    case $CHROMA_OPTION in
        1)
            echo "Using Docker for ChromaDB"
            # Keep default CHROMA_URL=http://localhost:8000
            ;;
        2)
            echo "Using in-memory ChromaDB"
            sed -i '' 's|CHROMA_URL=http://localhost:8000|# CHROMA_URL=|g' .env
            ;;
        3)
            echo "Using ChromaDB Cloud"
            read -p "Enter ChromaDB Cloud URL: " CHROMA_CLOUD_URL
            read -p "Enter ChromaDB API Key: " CHROMA_API_KEY
            read -p "Enter ChromaDB Tenant ID: " CHROMA_TENANT

            sed -i '' "s|CHROMA_URL=http://localhost:8000|CHROMA_URL=$CHROMA_CLOUD_URL|g" .env
            echo "CHROMA_API_KEY=$CHROMA_API_KEY" >> .env
            echo "CHROMA_TENANT=$CHROMA_TENANT" >> .env
            ;;
    esac

    echo -e "${GREEN}✅ .env file created${NC}"
fi

# ----------------------------------------------------------------------------
# Step 3: Start ChromaDB (if Docker option selected)
# ----------------------------------------------------------------------------
if [ "$CHROMA_OPTION" = "1" ] && [ "$DOCKER_AVAILABLE" = true ]; then
    echo ""
    echo "🐳 Starting ChromaDB with Docker..."

    if docker-compose -f docker-compose.chroma.yml up -d; then
        echo -e "${GREEN}✅ ChromaDB started successfully${NC}"

        # Wait for ChromaDB to be ready
        echo "⏳ Waiting for ChromaDB to be ready..."
        for i in {1..30}; do
            if curl -s http://localhost:8000/api/v1/heartbeat > /dev/null 2>&1; then
                echo -e "${GREEN}✅ ChromaDB is ready${NC}"
                break
            fi
            echo -n "."
            sleep 1
        done
    else
        echo -e "${RED}❌ Failed to start ChromaDB${NC}"
        echo "Please check Docker and try again"
    fi
fi

# ----------------------------------------------------------------------------
# Step 4: Install Dependencies
# ----------------------------------------------------------------------------
echo ""
echo "📦 Installing dependencies..."

if npm install --legacy-peer-deps; then
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# ----------------------------------------------------------------------------
# Step 5: Build Application
# ----------------------------------------------------------------------------
echo ""
echo "🔨 Building application..."

if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# ----------------------------------------------------------------------------
# Step 6: Summary
# ----------------------------------------------------------------------------
echo ""
echo "============================================================================"
echo -e "${GREEN}🎉 Production Setup Complete!${NC}"
echo "============================================================================"
echo ""
echo "📊 Configuration Summary:"
echo "  • OpenAI API Key: $([ ! -z "$OPENAI_KEY" ] && echo "Configured ✅" || echo "Not configured ⚠️")"
echo "  • ChromaDB: $( [ "$CHROMA_OPTION" = "1" ] && echo "Docker (http://localhost:8000) ✅" || [ "$CHROMA_OPTION" = "2" ] && echo "In-Memory ⚠️" || echo "Cloud ✅")"
echo "  • Dependencies: Installed ✅"
echo "  • Build: Success ✅"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Start your application:"
echo "   npm run start:dev"
echo ""
echo "2. Look for initialization messages:"
echo "   ✅ Semantic matching service initialized successfully"
echo "   ✅ AST Parser Service initialized"
echo ""
echo "3. Test semantic search:"
echo "   curl -X POST http://localhost:3002/api/agent/test-semantic \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"query\": \"find function that reads parquet files\"}'"
echo ""
echo "4. Check metrics:"
echo "   curl http://localhost:3002/metrics"
echo ""
echo "📚 Documentation:"
echo "  • Quick Start: README_ENHANCEMENTS.md"
echo "  • OpenAI Setup: OPENAI_SETUP.md"
echo "  • ChromaDB Setup: CHROMADB_PRODUCTION_SETUP.md"
echo "  • Implementation Guide: IMPLEMENTATION_GUIDE.md"
echo ""
echo "============================================================================"
