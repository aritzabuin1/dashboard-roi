---
description: Audit a project for production readiness (secrets, logging, resilience)
---

# Production Audit Workflow

Run this workflow before deploying ANY project to production.

## Steps

1. **Scan for Hardcoded Secrets**
   - Search all `.py`, `.json`, `.env`, and `.md` files for patterns like:
     - `password = "`
     - `api_key = "`
     - `token = "`
     - Connection strings with credentials
   - If found: **STOP** and report immediately.

2. **Verify .gitignore**
   - Ensure `.env`, `local.settings.json`, `*.pem`, `*.key` are in `.gitignore`.
   - If missing: Add them and warn the user.

3. **Check Logging Standards**
   - Scan for `print()` statements in production code (not in tests).
   - Replace with `logging.info()` or `logging.error()`.
   - Verify no PII (phone numbers, emails) is logged directly.

4. **Verify Error Handling**
   - Check that all external API calls (`requests.post`, `requests.get`) have:
     - `try/except` blocks
     - Timeout parameters
     - Retry logic (preferably with `tenacity`)

5. **Health Endpoint**
   - Verify a `/health` or `/ping` endpoint exists for monitoring.

6. **Generate Report**
   - Create a markdown summary of findings in `.tmp/production_audit_report.md`.S