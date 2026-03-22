# Copilot Coding Agent — Repository Instructions

## Repository Overview
This is the **BrickOptima / databricks-plan-optimizer** repository owned by the **Platform** squad.

## Agent Behaviour for Security Remediation
When assigned a security remediation issue (labelled `automated-remediation`):

1. Read `AGENTS.md` at the repository root — it contains the full workflow and PR format.
2. Parse the CVE table in the issue body to identify affected components and target versions.
3. Locate dependency declarations (`package.json`, `package-lock.json`) and apply the minimum version upgrade to fix each CVE.
4. Create a single branch named `copilot/fix-security-<issue_number>`.
5. Open one consolidated PR referencing the issue.

## Stack
- Node.js / TypeScript (NestJS backend)
- Vite (frontend)
- Docker Compose

## Key Files
- `backend/package.json` — backend dependencies
- `frontend/package.json` — frontend dependencies (if present)
- `package.json` — root-level dependencies

## Rules
- Never modify `.github/workflows/`, `CODEOWNERS`, or branch protection config.
- Follow conventional commits: `fix(security): upgrade {component} to {version} (CVE-XXXX-XXXXX)`
- See `AGENTS.md` for full PR description format.
