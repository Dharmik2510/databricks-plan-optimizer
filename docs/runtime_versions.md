# Dynamic Databricks Runtime (DBR) Version Catalog

This feature provides a dynamically populated list of Databricks Runtime versions for the analysis configuration, replacing the previous hardcoded list.

## Overview

We need to present the user with a list of valid DBR versions (e.g., "15.4 LTS", "16.1"). Since we do not connect to a specific Databricks workspace, we cannot fetch the "available versions" from a workspace API. Instead, we maintain a **Global Catalog** based on the official Databricks documentation.

## Architecture

### Backend (`DbrService`)

1.  **Source**: The customized parser fetches the official release notes page:
    *   URL: `https://docs.databricks.com/en/release-notes/runtime/index.html`
2.  **Parsing**: We use `cheerio` to parse the HTML and extract the "All supported Databricks Runtime releases" table.
    *   We extract: Version, LTS status, Release Date, EOL Date.
    *   We normalize the version string (e.g. "15.4") and the display label (e.g. "15.4 LTS").
3.  **Caching**:
    *   **Strategy**: In-Memory + Persisted DB (Postgres/Prisma).
    *   **TTL**: Defaults to 24 hours.
    *   On a request:
        1.  Check DB cache (`dbr_version_cache` table). return if valid.
        2.  If expired or missing, fetch from URL.
        3.  Update DB cache.
        4.  If fetch fails, serve stale cache if available, or error.
4.  **API**:
    *   `GET /api/v1/runtime-versions?cloud=aws`
    *   Response:
        ```json
        {
          "source": "databricks-docs",
          "cloud": "aws",
          "versions": [
            { "majorMinor": "15.4", "displayLabel": "15.4 LTS", "isLts": true, ... }
          ]
        }
        ```

### Frontend (`DashboardRoute`)

*   Fetches from the API on mount (or when cloud provider changes).
*   Displays a loading spinner while fetching.
*   **Fallback**: If the API fails, it renders a hardcoded list of common LTS versions to ensure the UI remains usable.
*   **Grouping**: Groups versions into "Latest", "LTS", and "Other" for better UX.

## Limitations

1.  **Not Workspace-Specific**: The list typically includes *all* supported versions. A specific user's workspace might restrict available versions via policy, which we cannot know.
2.  **HTML Parsing Fragility**: If Databricks significantly changes the release notes HTML structure, the parser might fail.
    *   *Mitigation*: We reuse the last successful cache if parsing fails.
3.  **Cloud Specificity**: Currently we only fetch the general list. Azure/GCP specific runtimes might have slight variations, but usually the core versions match.

## Troubleshooting

If the dropdown is empty or only showing "Fallback":
1.  Check backend logs for `DbrService` errors (parsing failures).
2.  Verify the server can reach `docs.databricks.com`.
3.  Check if `cheerio` dependency is installed correctly.
