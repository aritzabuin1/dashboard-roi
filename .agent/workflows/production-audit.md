---
description: Comprehensive production readiness audit (security, resilience, performance, observability)
---

# Production Audit Workflow

Run this workflow before deploying ANY project to production. This is a comprehensive checklist covering security, resilience, performance, and observability.

## Steps

### 1. Hardcoded Secrets Scan (CRITICAL)
- Search all `.ts`, `.tsx`, `.py`, `.js`, `.json`, `.env`, and `.md` files for:
  - `password = "`
  - `api_key = "`
  - `token = "`
  - `secret = "`
  - `SUPABASE_SERVICE_ROLE_KEY = "`
  - Connection strings with credentials
  - Private keys (BEGIN PRIVATE KEY)
- **Tooling**: Use `grep` or `rg` to find patterns.
- **Action**: If found → STOP and report immediately.

### 2. Admin Authentication Audit (CRITICAL)
- Check login logic in `src/app/api/admin/login/route.ts`:
  - ❌ Base64 tokens or simple strings
  - ❌ Plain text password matching (allow ONLY if intentional for specific use case, verify robust fallback)
  - ✅ JWT tokens signed with `jose`
  - ✅ Bcrypt/Argon2 hashing
- Verify `requireAdmin()` middleware exists and is used on ALL admin routes.
- Verify `JWT_SECRET` exists in `.env`.

### 3. API Key & Secrets Exposure (CRITICAL)
- Verify `GET /api/clients` and `GET /api/users` do NOT return API keys, passwords, or hashes.
- Check that error messages do NOT expose stack traces or env vars.
- Verify Service Role keys are NEVER sent to the client.

### 4. Database Security (RLS) (CRITICAL)
- **For Supabase**: Verify Row Level Security (RLS) is enabled on ALL tables.
- Check policies:
  - ❌ No `USING (true)` for `anon` role.
  - ✅ Users only see their own data (`auth.uid() = user_id`).
  - ✅ Service Role used ONLY for admin/webhook bypass.

### 5. Rate Limiting (HIGH)
- Identify critical endpoints (`/login`, `/register`, webhooks).
- Verify distributed rate limiting is used (Upstash/Redis), NOT in-memory maps (which fail on serverless).

### 6. Security Headers (HIGH)
- Check `middleware.ts` or `next.config.js` for:
  - `X-Frame-Options: DENY`
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`

### 7. Dependency Vulnerabilities (HIGH)
- Run `npm audit --production`.
- Report any CRITICAL or HIGH vulnerabilities.

### 8. Environment Variables Audit (HIGH)
- Verify `.env` is in `.gitignore`.
- Verify `.env.example` exists and documents all required vars.
- Check that production uses different secrets than dev.

### 9. Logging Standards (HIGH)
- Scan for `console.log` in production code.
- **CRITICAL**: Verify no PII (email, password, user data) is logged.
- Ensure logging library (if used) handles levels (debug/info/error) correctly.

### 10. CORS Configuration (MEDIUM)
- Verify `Access-Control-Allow-Origin` is NOT `*` in production (unless public API).
- Whitelist specific domains for web apps.

### 11. Webhook Verification (MEDIUM)
- If receiving webhooks (Stripe, GitHub), verify HMAC signature validation is implemented.
- Never trust the webhook body without signature check.

### 12. Health & Observability (MEDIUM)
- Verify `/api/health` endpoint exists.
- Check if error tracking (Sentry) and analytics (Vercel) are set up.

### 13. Generate Report
- Create `.tmp/production_audit_report.md` with:
  - Summary of findings (Critical/High/Medium/Low).
  - List of passed checks.
  - List of failed checks with file paths and recommended fixes.
  - Final Go/No-Go recommendation.