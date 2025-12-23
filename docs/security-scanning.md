# Security Vulnerability Scanning

This document explains how the automated security vulnerability scanning works in this project.

## Overview

The project uses a comprehensive security scanning approach with two main tools:

1. **NPM Audit** - Scans Node.js dependencies for known vulnerabilities
2. **Trivy** - Scans Docker images and filesystem for vulnerabilities

These scans run automatically via GitHub Actions and generate detailed reports.

## Scanning Tools

### 1. NPM Audit

**What it does:**
- Scans `package.json` and `package-lock.json` for vulnerable dependencies
- Checks against the npm vulnerability database
- Reports known CVEs (Common Vulnerabilities and Exposures)

**What it scans:**
- Frontend dependencies (React, Vite, TypeScript libraries)
- Backend dependencies (NestJS, Prisma, Node libraries)
- Both production and development dependencies

**Severity levels:**
- **Critical**: Immediate action required
- **High**: Address as soon as possible
- **Moderate**: Address in regular maintenance
- **Low**: Optional to fix

### 2. Trivy

**What it does:**
- Scans Docker container images for OS and library vulnerabilities
- Scans filesystem for vulnerable dependencies
- Detects misconfigurations and security issues

**What it scans:**
- Frontend Docker image (nginx + built React app)
- Backend Docker image (Node.js + NestJS app)
- Source code filesystem (package.json, lock files, etc.)
- OS packages in Docker base images

## GitHub Actions Workflow

The security scan workflow is defined in [`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml).

### When Scans Run

The security scan workflow runs automatically on:

1. **Every push to `main` branch** - Ensures main branch is always scanned
2. **Every pull request** - Catches vulnerabilities before merging
3. **Weekly schedule** - Monday at 9 AM UTC (for new vulnerabilities)
4. **Manual trigger** - Can be run on-demand from GitHub Actions tab

### Workflow Jobs

The workflow consists of 4 jobs:

#### Job 1: NPM Audit (`npm-audit`)

```yaml
Steps:
1. Checkout code
2. Setup Node.js 20
3. Install frontend dependencies
4. Run npm audit on frontend
5. Install backend dependencies
6. Run npm audit on backend
7. Upload audit reports as artifacts
```

**Outputs:**
- `npm-audit-frontend.txt` - Human-readable frontend report
- `npm-audit-frontend.json` - Machine-readable frontend report
- `npm-audit-backend.txt` - Human-readable backend report
- `npm-audit-backend.json` - Machine-readable backend report

#### Job 2: Trivy Container Scan (`trivy-scan`)

```yaml
Steps:
1. Checkout code
2. Build frontend Docker image
3. Build backend Docker image
4. Scan frontend image with Trivy
5. Scan backend image with Trivy
6. Generate human-readable reports
7. Upload SARIF results to GitHub Security tab
8. Upload reports as artifacts
```

**Outputs:**
- `trivy-frontend.sarif` - Frontend scan results (SARIF format)
- `trivy-backend.sarif` - Backend scan results (SARIF format)
- `trivy-frontend-report.txt` - Human-readable frontend report
- `trivy-backend-report.txt` - Human-readable backend report

#### Job 3: Trivy Filesystem Scan (`trivy-filesystem`)

```yaml
Steps:
1. Checkout code
2. Scan entire filesystem with Trivy
3. Generate reports
4. Upload to GitHub Security tab
5. Upload reports as artifacts
```

**Outputs:**
- `trivy-fs.sarif` - Filesystem scan results (SARIF format)
- `trivy-filesystem-report.txt` - Human-readable report

#### Job 4: Generate Summary (`generate-summary`)

```yaml
Steps:
1. Download all artifacts from previous jobs
2. Combine all reports into a single summary
3. Upload unified security summary
4. Display summary in GitHub Actions UI
```

**Outputs:**
- `security-summary.md` - Unified report with all scan results

## How to View Scan Results

### 1. GitHub Actions Tab

1. Go to the **Actions** tab in your GitHub repository
2. Click on **Security Vulnerability Scan** workflow
3. Select a workflow run to view
4. View the summary at the top of the run page
5. Download artifacts for detailed reports

### 2. GitHub Security Tab

1. Go to the **Security** tab in your GitHub repository
2. Click on **Code scanning alerts**
3. View Trivy findings categorized by:
   - `trivy-frontend` - Frontend container vulnerabilities
   - `trivy-backend` - Backend container vulnerabilities
   - `trivy-filesystem` - Filesystem vulnerabilities

### 3. Download Artifacts

From any workflow run, scroll to the **Artifacts** section at the bottom and download:

- `npm-audit-reports` - NPM audit results (30-day retention)
- `trivy-scan-reports` - Trivy container scan results (30-day retention)
- `trivy-filesystem-report` - Trivy filesystem scan (30-day retention)
- `security-summary-report` - Unified summary (90-day retention)

## Understanding the Reports

### NPM Audit Report Format

```
┌───────────────┬──────────────────────────────────────────────────────────────┐
│ high          │ Vulnerability Title                                           │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Package       │ vulnerable-package                                            │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Patched in    │ >=1.2.3                                                       │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Dependency of │ parent-package                                                │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ Path          │ parent-package > intermediate > vulnerable-package            │
├───────────────┼──────────────────────────────────────────────────────────────┤
│ More info     │ https://github.com/advisories/GHSA-xxxx-xxxx-xxxx            │
└───────────────┴──────────────────────────────────────────────────────────────┘
```

### Trivy Report Format

```
Total: 5 (CRITICAL: 1, HIGH: 2, MEDIUM: 2)

┌────────────────┬────────────────┬──────────┬───────────────────┬───────────────┬────────────────────────────────┐
│    Library     │ Vulnerability  │ Severity │ Installed Version │ Fixed Version │            Title               │
├────────────────┼────────────────┼──────────┼��──────────────────┼───────────────┼────────────────────────────────┤
│ library-name   │ CVE-2024-1234  │ CRITICAL │ 1.0.0             │ 1.0.1         │ Description of vulnerability   │
└────────────────┴────────────────┴──────────┴───────────────────┴───────────────┴────────────────────────────────┘
```

## Fixing Vulnerabilities

### NPM Vulnerabilities

**Automatic fixes:**
```bash
# For non-breaking changes
npm audit fix

# For breaking changes (use with caution)
npm audit fix --force
```

**Manual fixes:**
```bash
# Update specific package
npm install package-name@latest

# Check for outdated packages
npm outdated
```

**Using overrides (package.json):**
```json
{
  "overrides": {
    "vulnerable-package": "^2.0.0"
  }
}
```

### Docker Image Vulnerabilities

**Update base image:**
```dockerfile
# Before
FROM node:20-alpine

# After (use specific version with security patches)
FROM node:20.19.6-alpine3.21
```

**Update OS packages:**
```dockerfile
RUN apk update && apk upgrade
```

**Use minimal images:**
- Prefer `alpine` variants (smaller attack surface)
- Use multi-stage builds to reduce final image size
- Don't include development dependencies in production images

### Filesystem Vulnerabilities

These are typically dependency issues. Fix by:
1. Updating `package.json` dependencies
2. Running `npm install` to update `package-lock.json`
3. Committing the changes

## Best Practices

### 1. Regular Monitoring
- Check the Security tab weekly
- Review scan results in PRs before merging
- Don't ignore warnings - assess and fix or document why it's safe

### 2. Prioritize Fixes
- **Critical/High in production dependencies**: Fix immediately
- **Medium in production dependencies**: Fix in next release
- **Any in development dependencies**: Fix when convenient
- **Low severity**: Optional, fix during maintenance

### 3. Keep Dependencies Updated
- Review Dependabot PRs regularly
- Update major versions in controlled manner
- Test thoroughly after dependency updates

### 4. Pin Versions in Production
- Use exact versions in `package-lock.json`
- Test updates in staging before production
- Document reasons for using older versions

### 5. Use Security Headers
The backend already uses Helmet for security headers. Ensure:
- CORS is properly configured
- CSP headers are set
- Other security headers are in place

## Manual Security Scanning

You can also run security scans locally:

### NPM Audit (Local)

```bash
# Frontend
npm audit
npm audit --audit-level=moderate

# Backend
cd backend
npm audit
npm audit --audit-level=moderate
```

### Trivy (Local)

**Install Trivy:**
```bash
# macOS
brew install trivy

# Linux
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install trivy
```

**Scan Docker images:**
```bash
# Build images
docker build -t brickoptima-frontend:local -f frontend/Dockerfile .
docker build -t brickoptima-backend:local -f backend/Dockerfile ./backend

# Scan with Trivy
trivy image brickoptima-frontend:local
trivy image brickoptima-backend:local
```

**Scan filesystem:**
```bash
# Scan entire project
trivy fs .

# Scan specific directory
trivy fs ./backend
```

## Troubleshooting

### Scan Failing Due to Build Errors

If Docker builds fail during scanning:
1. Check that Dockerfiles are valid
2. Ensure all required files exist
3. Test builds locally first

### False Positives

If a vulnerability is reported but doesn't apply:
1. Check if the vulnerable code path is actually used
2. Document why it's safe (add to README or create issue)
3. Consider using `.trivyignore` for known false positives

### Rate Limiting

If you hit GitHub API rate limits:
1. Scans are scheduled for off-peak hours
2. Consider reducing scan frequency
3. Use personal access token if needed

## Security Scanning Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Trigger Event                                 │
│  (Push to main / PR / Weekly schedule / Manual)                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │                                            │
        ▼                                            ▼
┌───────────────┐                          ┌─────────────────┐
│  NPM Audit    │                          │  Trivy Scans    │
│               │                          │                 │
│ - Frontend    │                          │ - Container     │
│ - Backend     │                          │ - Filesystem    │
└───────┬───────┘                          └────────┬────────┘
        │                                           │
        │                                           │
        └───────────────┬───────────────────────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │  Generate Summary      │
            │                        │
            │ - Combine all reports  │
            │ - Upload artifacts     │
            │ - Display in UI        │
            └───────────┬────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │  Results Available In:       │
          │                              │
          │  1. GitHub Actions Summary   │
          │  2. GitHub Security Tab      │
          │  3. Downloadable Artifacts   │
          └──────────────────────────────┘
```

## Additional Resources

- [NPM Audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Contact

For security concerns or questions about vulnerability scanning:
- Open an issue in the repository
- Review existing security alerts in the Security tab
- Check the security scanning workflow runs in Actions tab
