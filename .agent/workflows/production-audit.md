---
description: Audit a project for production readiness (secrets, logging, resilience, auth security)
---

# Production Audit Workflow

Run this workflow before deploying ANY project to production.

## Steps

### 1. Scan for Hardcoded Secrets
- Search all `.ts`, `.tsx`, `.py`, `.json`, `.env`, and `.md` files for patterns like:
  - `password = "`
  - `api_key = "`
  - `token = "`
  - `secret = "`
  - Connection strings with credentials
- If found: **STOP** and report immediately.

### 2. Verify .gitignore
- Ensure `.env`, `local.settings.json`, `*.pem`, `*.key` are in `.gitignore`.
- If missing: Add them and warn the user.

### 3. Check Logging Standards
- Scan for `print()` or `console.log()` statements in production code.
- Replace with proper logging (e.g., `logging.info()` in Python).
- **CRITICAL**: Verify no PII (emails, phone numbers, user data) is logged directly.
- Remove or redact any `console.log(email)`, `console.log(user)`, etc.

### 4. Verify Error Handling
- Check that all external API calls have:
  - `try/catch` or `try/except` blocks
  - Timeout parameters
  - Retry logic (preferably with `tenacity` or similar)

### 5. Health Endpoint
- Verify a `/health` or `/api/health` endpoint exists for monitoring.
- Should return status, timestamp, and environment.

### 6. Admin Authentication Audit (NEW)
- **CRITICAL**: Check admin login/session mechanism:
  - ❌ **BAD**: Base64-encoded tokens (e.g., `admin:${timestamp}`) - easily forgeable
  - ❌ **BAD**: Plain text password comparison without hashing
  - ✅ **GOOD**: JWT tokens signed with secret key (use `jose` library)
  - ✅ **GOOD**: Bcrypt password hashing
- Verify all admin-only endpoints require authentication
- Check for `requireAdmin()` or similar middleware on sensitive routes

### 7. API Key Exposure Check (NEW)
- Verify API keys are NOT returned in public GET responses
- API keys should only be revealed on-demand via protected endpoints
- Check that reveal endpoints require admin authentication

### 8. Environment Variables Audit (NEW)
- Verify all required env vars are documented in `.env.example`
- Check that production requires:
  - `JWT_SECRET` (for JWT token signing)
  - `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
  - Any other secrets needed for auth/security

### 9. Endpoint Protection Matrix (NEW)
Review and document which endpoints require authentication:

| Endpoint | Auth Required? | Notes |
|----------|---------------|-------|
| `/api/admin/*` | ✅ Yes | All admin operations |
| `/api/clients` POST | ✅ Yes | Creates resources |
| `/api/clients` GET | ✅ Yes | Exposes client list |
| `/api/automations` POST | ✅ Yes | Creates resources |
| `/api/execution-webhook` | API Key | External integrations |
| `/api/health` | ❌ No | Monitoring only |

### 10. Generate Report
- Create a markdown summary of findings in `.tmp/production_audit_report.md`
- Include:
  - Issues found (with severity: CRITICAL, HIGH, MEDIUM, LOW)
  - Actions taken
  - Remaining recommendations