# Cloud Run Security and Production Readiness

This document covers security hardening and production configuration for running BrickOptima on Google Cloud Run with multi-tenant data isolation.

## Secrets and Configuration
Store all sensitive values in Secret Manager and mount as environment variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `MCP_AUTH_TOKEN` (default org MCP token, if used)
- `TOKEN_ENCRYPTION_KEY` (only if KMS is unavailable)

Recommended Secret Manager mapping:
- `supabase-service-role-key` -> `SUPABASE_SERVICE_ROLE_KEY`
- `supabase-url` -> `SUPABASE_URL`
- `jwt-secret` -> `JWT_SECRET`
- `gemini-api-key` -> `GEMINI_API_KEY`
- `mcp-auth-token` -> `MCP_AUTH_TOKEN`

## KMS Envelope Encryption
Org tokens are encrypted using envelope encryption:
- Data Encryption Key (DEK): AES-256-GCM
- Key Encryption Key (KEK): Cloud KMS

Setup steps:
1. Create a key ring and key:
   ```bash
   gcloud kms keyrings create brickoptima --location=global
   gcloud kms keys create mcp-token-key --location=global --keyring=brickoptima --purpose=encryption
   ```
2. Grant Cloud Run service account access:
   ```bash
   gcloud kms keys add-iam-policy-binding mcp-token-key \
     --location=global --keyring=brickoptima \
     --member=serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com \
     --role=roles/cloudkms.cryptoKeyEncrypterDecrypter
   ```
3. Configure `KMS_KEY_NAME` in Cloud Run:
   `projects/<project>/locations/global/keyRings/brickoptima/cryptoKeys/mcp-token-key`

## Cloud Run Configuration
Recommended settings:
- Ingress: `internal-and-cloud-load-balancing` (preferred) or `internal` for private-only.
- Min instances: 1 (avoid cold start for MCP calls).
- Concurrency: 40-80 (tune based on MCP throughput).
- CPU: 2 vCPU (or higher for high concurrency).
- Memory: 2-4 GB (increase for large SHS payloads).
- Runtime: Node.js 18+ to align with Google Cloud libraries and observability agents.

## Network Controls
- Use a VPC connector if MCP/SHS is in a private network.
- Enforce MCP allowlist via `MCP_ALLOWED_HOSTS`.
- Block SSRF by default; enable `MCP_ALLOW_PRIVATE=true` only for private deployments.
- If public ingress is required, use Cloud Armor for WAF and rate limiting.

## CORS and Browser Security
- Configure `CORS_ORIGIN` with explicit frontend origins only.
- Avoid wildcards in production.
- Keep `helmet` enabled.

## AuthN/AuthZ and Tenant Isolation
- All API endpoints require JWT auth.
- `org_id` is derived from JWT claims or user settings (never from client input).
- Supabase RLS enforces tenant isolation for `historical_analysis` and `org_connections`.
- Admin-only access for org connection management.

## Observability and Audit
- Structured JSON logs with redaction for secrets and headers.
- Request correlation IDs via `X-Correlation-ID` and `X-Request-ID`.
- Metrics:
  - `mcp_call_latency_ms`
  - `mcp_errors_total`
  - `analysis_latency_ms`
- Audit events recorded for analysis and org connection actions.

## Required Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `MCP_SERVER_URL`
- `MCP_AUTH_SCHEME` (optional)
- `MCP_AUTH_TOKEN` (optional)
- `MCP_AUTH_HEADER` (optional)
- `KMS_KEY_NAME` (preferred) or `TOKEN_ENCRYPTION_KEY`
- `MCP_ALLOWED_HOSTS`
- `MCP_ALLOW_PRIVATE`
- `CORS_ORIGIN`
- `HISTORICAL_RATE_LIMIT_USER`
- `HISTORICAL_RATE_LIMIT_ORG`
- `MCP_TIMEOUT_MS`
- `MCP_RETRY_ATTEMPTS`
- `MCP_CIRCUIT_BREAKER_THRESHOLD`

## Deployment Notes
- Run Supabase migrations separately before deploying Cloud Run.
- Validate MCP connection in Admin UI after deploying.
- Do not store or log MCP tokens in plaintext.
