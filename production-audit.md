---
description: Comprehensive production readiness audit (security, resilience, performance, observability)
version: 2.0
last_updated: 2026-02-01
---

# Production Audit Workflow

Run this workflow before deploying ANY project to production. This is a comprehensive checklist covering security, resilience, performance, and observability.

---

## 🔴 CRITICAL SECURITY CHECKS

### 1. Hardcoded Secrets Scan
**Priority:** CRITICAL
**Time:** 5 minutes

- Search all `.ts`, `.tsx`, `.py`, `.js`, `.json`, `.env`, and `.md` files for:
  - `password = "`
  - `api_key = "`
  - `token = "`
  - `secret = "`
  - `SUPABASE_SERVICE_ROLE_KEY = "`
  - Connection strings with credentials (e.g., `postgres://user:pass@host`)
  - Private keys (BEGIN PRIVATE KEY)

**Tools:**
```bash
# Regex search for secrets
rg -i "(password|api_key|token|secret)\s*=\s*['\"][^'\"]{8,}" --type ts --type js --type py

# Check for AWS/GCP credentials
rg "AKIA[0-9A-Z]{16}" .
rg "AIza[0-9A-Za-z\\-_]{35}" .
```

**Action:** If found → **STOP** deployment and report immediately.

---

### 2. Admin Authentication Audit
**Priority:** CRITICAL
**Time:** 10 minutes

#### Check for WEAK patterns:
- ❌ Base64-encoded tokens: `Buffer.from('admin:' + Date.now()).toString('base64')`
- ❌ Plain text password comparison: `if (password === env.ADMIN_PASSWORD)`
- ❌ Session validation with `.startsWith('admin:')` or similar
- ❌ No expiration on session tokens

#### Verify SECURE patterns:
- ✅ JWT tokens signed with `jose` or similar library
- ✅ Bcrypt/Argon2 password hashing (min 10 rounds for bcrypt)
- ✅ Token expiration (24 hours max for admin sessions)
- ✅ HTTP-only cookies with `secure` flag in production
- ✅ `requireAdmin()` middleware on all admin routes

**Checklist:**
- [ ] JWT_SECRET exists in .env (min 32 bytes)
- [ ] ADMIN_PASSWORD_HASH exists (no plain text password)
- [ ] All `/api/admin/*` routes require authentication
- [ ] Session cookies are HTTP-only and secure
- [ ] Token verification catches expired/tampered tokens

**Files to check:**
- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/check/route.ts`
- `src/lib/auth-admin.ts` or equivalent

---

### 3. Endpoint Protection Matrix
**Priority:** CRITICAL
**Time:** 15 minutes

**Create a matrix of ALL API endpoints and their auth requirements:**

| Endpoint | Method | Auth Type | Protected? | Notes |
|----------|--------|-----------|------------|-------|
| `/api/admin/login` | POST | Public | ❌ No (intentional) | Rate limited? |
| `/api/admin/check` | GET | JWT Cookie | ✅ Yes | |
| `/api/admin/*` | ALL | JWT Cookie | ✅ Yes | All admin operations |
| `/api/clients` | GET | Admin JWT | ✅ Yes | |
| `/api/clients` | POST | Admin JWT | ✅ Yes | |
| `/api/clients/[id]` | DELETE | Admin JWT | ✅ Yes | |
| `/api/automations` | GET | Admin JWT | ✅ Yes | |
| `/api/automations` | POST | Admin JWT | ✅ Yes | |
| `/api/metrics` | GET | Admin OR Client | ✅ Yes | Dual auth |
| `/api/execution-webhook` | POST | API Key | ✅ Yes | External |
| `/api/health` | GET | Public | ❌ No | Monitoring only |

**Verify:**
- [ ] No sensitive endpoints are publicly accessible
- [ ] All DELETE/UPDATE operations require authentication
- [ ] GET endpoints that return PII require authentication
- [ ] External webhooks use API key or HMAC signature

---

### 4. API Key & Secrets Exposure
**Priority:** CRITICAL
**Time:** 10 minutes

#### Check API responses for leaked secrets:
```bash
# Test endpoints that might leak data
curl http://localhost:3000/api/clients | jq . | grep -i "api_key\|secret\|password"
```

**Verify:**
- [ ] GET `/api/clients` does NOT return `api_key` field
- [ ] GET `/api/users` does NOT return `password` or `password_hash`
- [ ] Error messages do NOT expose stack traces in production
- [ ] Environment variables are NOT logged
- [ ] Service role keys are NEVER sent to client

**Best Practice:** Create dedicated reveal endpoints:
- `/api/clients/[id]/reveal-key` (admin only, logged)

---

### 5. Database Security (RLS for Supabase/PostgreSQL)
**Priority:** CRITICAL
**Time:** 20 minutes

**For Supabase projects:**

#### Check RLS policies:
```sql
-- In Supabase SQL Editor, run:
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public';
```

#### Verify NO permissive policies like:
```sql
-- ❌ BAD - Allows anonymous access to everything
CREATE POLICY "Allow public read" ON table_name
FOR SELECT TO anon USING (true);

-- ❌ BAD - Allows anyone to insert
CREATE POLICY "Allow insert" ON table_name
FOR INSERT TO anon WITH CHECK (true);
```

#### Verify RESTRICTIVE policies like:
```sql
-- ✅ GOOD - Users only see their own data
CREATE POLICY "Users see own data" ON clients
FOR SELECT TO authenticated
USING (auth.uid() = auth_user_id);

-- ✅ GOOD - Scoped to user's resources
CREATE POLICY "Users see own automations" ON automation_metadata
FOR SELECT TO authenticated
USING (client_id IN (
    SELECT id FROM clients WHERE auth_user_id = auth.uid()
));
```

**Checklist:**
- [ ] RLS enabled on ALL tables: `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`
- [ ] No `USING (true)` policies for `anon` role
- [ ] Authenticated users can only see their own data
- [ ] Service role operations use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- [ ] INSERT policies prevent data poisoning

**Files to check:**
- `execution/rls_policies.sql` or `supabase/migrations/*.sql`

---

### 6. Rate Limiting
**Priority:** HIGH
**Time:** 15 minutes

#### For Serverless (Vercel/Netlify/AWS Lambda):
**Problem:** In-memory rate limiting does NOT work (each invocation is isolated).

**Solution:** Use distributed storage:
- **Upstash Redis** (recommended for Vercel)
- **Vercel Edge Config** (built-in)
- **Redis/Memcached** (self-hosted)

#### Verify rate limiting on:
- [ ] Admin login (`/api/admin/login`) - 5 attempts per 15 minutes per IP
- [ ] Password reset - 3 attempts per hour per email
- [ ] User registration - 10 per hour per IP
- [ ] Webhook endpoints - 100 per minute per API key
- [ ] Public APIs - 1000 per hour per IP

**Check for:**
```typescript
// ❌ BAD - In-memory (won't work on serverless)
const rateLimitMap = new Map<string, number>();

// ✅ GOOD - Distributed (Upstash)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "15 m"),
});
```

**Test:**
```bash
# Verify rate limiting works
for i in {1..10}; do curl -X POST http://localhost:3000/api/admin/login -d '{"password":"wrong"}'; done
# Should get 429 after 5 attempts
```

---

### 7. Security Headers (Middleware)
**Priority:** HIGH
**Time:** 10 minutes

**Check for `src/middleware.ts` (Next.js) or equivalent:**

```typescript
// ✅ GOOD - Security headers set
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  response.headers.set('Content-Security-Policy', "default-src 'self'; ...");

  return response;
}
```

**Verify headers in production:**
```bash
curl -I https://your-app.vercel.app | grep -E "(X-Frame|Content-Security|Strict-Transport)"
```

**Checklist:**
- [ ] `X-Frame-Options: DENY` (prevents clickjacking)
- [ ] `Content-Security-Policy` set (prevents XSS)
- [ ] `Strict-Transport-Security` in production (enforces HTTPS)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

**Test CSP:**
- Open browser console
- Check for CSP errors (may need to adjust for libraries like Recharts)

---

### 8. HTTPS/TLS Configuration
**Priority:** HIGH
**Time:** 5 minutes

**Verify:**
- [ ] Production URL uses `https://` (not `http://`)
- [ ] HTTP redirects to HTTPS automatically
- [ ] Cookies have `secure: true` in production
- [ ] Mixed content warnings in browser console (check images, scripts)
- [ ] TLS version ≥ 1.2 (check with SSL Labs)

**Test:**
```bash
# Check SSL certificate
curl -vI https://your-app.vercel.app 2>&1 | grep -E "(SSL|TLS)"

# Test HTTP redirect
curl -I http://your-app.vercel.app | grep "Location: https"
```

---

### 9. Input Validation & Sanitization
**Priority:** HIGH
**Time:** 15 minutes

#### Check for validation libraries:
- ✅ **Zod** (TypeScript schema validation)
- ✅ **Joi** (JavaScript validation)
- ✅ **class-validator** (decorators)

#### Verify validation on:
- [ ] Email addresses (regex + DNS check)
- [ ] Passwords (min length, complexity)
- [ ] UUIDs (format validation)
- [ ] Numeric inputs (range checks)
- [ ] File uploads (MIME type, size limits)

**Example with Zod:**
```typescript
// ✅ GOOD
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

const result = schema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ errors: result.error }, { status: 400 });
}
```

**SQL Injection check:**
- [ ] No raw SQL queries with string concatenation
- [ ] Use parameterized queries or ORMs (Prisma, Drizzle, TypeORM)

---

### 10. Environment Variables Audit
**Priority:** HIGH
**Time:** 10 minutes

#### Verify `.env.example` documents ALL required variables:
```env
# ✅ GOOD - Template with explanations
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=<SECRET - Get from Supabase Dashboard>
JWT_SECRET=<Generate with: openssl rand -base64 32>
ADMIN_PASSWORD_HASH=<Generate with bcryptjs>
```

#### Check `.env` is in `.gitignore`:
```bash
grep -q "^\.env$" .gitignore && echo "✅ .env ignored" || echo "❌ .env NOT ignored"
```

#### Verify production secrets are NOT in code:
```bash
# Should return 0 results
rg "sk_live_|pk_live_|AKIA|AIza" --type ts --type js
```

**Checklist:**
- [ ] `.env` in `.gitignore`
- [ ] `.env.local` in `.gitignore`
- [ ] `.env.example` exists and is up-to-date
- [ ] All secrets use environment variables (no hardcoded values)
- [ ] Production uses different secrets than development
- [ ] Secrets rotation policy documented

---

## 🟡 HIGH PRIORITY CHECKS

### 11. Logging Standards
**Priority:** HIGH
**Time:** 10 minutes

#### Check for production logging issues:

**❌ BAD:**
```typescript
console.log(user); // Logs PII
console.log(email); // Logs PII
console.log(password); // CRITICAL - Never log passwords
console.log(apiKey); // Logs secrets
```

**✅ GOOD:**
```typescript
console.log(`User ${userId} logged in`); // No PII
console.error(`Auth failed for email: ${email.substring(0,3)}***`); // Redacted
console.log(`API Key present: ${!!apiKey}`); // Boolean only
```

#### Verify logging library usage:
- [ ] Replace `console.log()` with proper logger (Winston, Pino, Log4js)
- [ ] Log levels configured (debug/info/warn/error)
- [ ] Structured logging (JSON format)
- [ ] No PII in logs (emails, phone numbers, addresses)
- [ ] No secrets in logs (passwords, tokens, keys)

**Scan for violations:**
```bash
# Find console.log in production code
rg "console\.(log|error|warn)" src/ --type ts | grep -v "// "
```

---

### 12. Error Handling
**Priority:** HIGH
**Time:** 15 minutes

**Verify all external calls have:**
- [ ] `try/catch` blocks
- [ ] Timeout parameters
- [ ] Retry logic (with exponential backoff)
- [ ] Error messages don't expose internals

**Example:**
```typescript
// ✅ GOOD
try {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000), // 5s timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.json();
} catch (error) {
  console.error('External API failed:', error.message); // Don't log full error
  return NextResponse.json(
    { error: 'Service temporarily unavailable' }, // Generic message
    { status: 503 }
  );
}
```

**Checklist:**
- [ ] No unhandled promise rejections
- [ ] No `throw` without `try/catch` in API routes
- [ ] Error responses don't expose stack traces in production
- [ ] Database connection errors handled gracefully

---

### 13. Dependency Vulnerabilities
**Priority:** HIGH
**Time:** 5 minutes

**Run security audits:**
```bash
# npm
npm audit
npm audit --production

# yarn
yarn audit

# pnpm
pnpm audit
```

**Check for:**
- [ ] Zero critical vulnerabilities
- [ ] Zero high vulnerabilities
- [ ] Acceptable moderate/low vulnerabilities (document exceptions)
- [ ] Dependencies updated in last 6 months

**Automated scanning:**
```bash
# Install Snyk
npm install -g snyk
snyk test

# GitHub Dependabot
# Enable in repo settings → Security → Dependabot alerts
```

---

### 14. CORS Configuration
**Priority:** MEDIUM
**Time:** 5 minutes

**For APIs consumed by web apps:**

```typescript
// ❌ BAD - Allows all origins
res.setHeader('Access-Control-Allow-Origin', '*');

// ✅ GOOD - Whitelist specific origins
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];

const origin = req.headers.get('origin');
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

**Checklist:**
- [ ] CORS origins whitelisted (not `*` in production)
- [ ] Credentials allowed only for trusted origins
- [ ] Preflight requests handled correctly

---

### 15. Session Management
**Priority:** MEDIUM
**Time:** 10 minutes

**Verify:**
- [ ] Session tokens are random and unpredictable (use `crypto.randomBytes`)
- [ ] Sessions expire after inactivity (30 min typical)
- [ ] Sessions expire after absolute time (24h typical)
- [ ] Logout invalidates session server-side
- [ ] No session fixation vulnerabilities

**For JWT:**
- [ ] Include `iat` (issued at) and `exp` (expiration) claims
- [ ] Refresh token rotation implemented
- [ ] Blacklist for revoked tokens (if needed)

---

### 16. Webhook Signature Verification
**Priority:** MEDIUM
**Time:** 10 minutes

**If your app receives webhooks (from Stripe, GitHub, etc.):**

**❌ BAD:**
```typescript
// Just trust the request
const { data } = await request.json();
processWebhook(data);
```

**✅ GOOD:**
```typescript
// Verify HMAC signature
const signature = request.headers.get('x-webhook-signature');
const body = await request.text();

const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(body)
  .digest('hex');

if (signature !== expectedSig) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

**Checklist:**
- [ ] All webhook endpoints verify signatures (HMAC-SHA256)
- [ ] Webhook secrets stored in environment variables
- [ ] Replay attacks prevented (timestamp validation)

---

## 🟢 MEDIUM PRIORITY CHECKS

### 17. Health/Status Endpoint
**Priority:** MEDIUM
**Time:** 10 minutes

**Create a `/api/health` endpoint:**
```typescript
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
  };

  // Optional: Check database connectivity
  try {
    await supabase.from('clients').select('id').limit(1);
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  return NextResponse.json(health);
}
```

**Checklist:**
- [ ] `/health` or `/api/health` endpoint exists
- [ ] Returns 200 when healthy, 503 when unhealthy
- [ ] Monitors database connectivity
- [ ] Monitors external service dependencies
- [ ] Used by uptime monitoring (Pingdom, UptimeRobot, etc.)

---

### 18. Performance & Resource Limits
**Priority:** MEDIUM
**Time:** 10 minutes

**Verify:**
- [ ] API responses < 2 seconds (median)
- [ ] Database queries optimized (use EXPLAIN)
- [ ] Indexes on foreign keys and frequently queried columns
- [ ] Connection pooling configured
- [ ] Memory leaks checked (use heap snapshots)
- [ ] Large file uploads use streaming (not buffering entire file)

**Database connection pool:**
```typescript
// ✅ GOOD - Connection pooling
const supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { persistSession: false },
  global: {
    headers: { 'x-connection-pool': 'true' },
  },
});
```

---

### 19. Backup & Recovery Strategy
**Priority:** MEDIUM
**Time:** 15 minutes

**Document:**
- [ ] Database backup frequency (daily, hourly?)
- [ ] Backup retention policy (30 days, 90 days?)
- [ ] Disaster recovery plan (RTO/RPO defined)
- [ ] Point-in-time recovery available?
- [ ] Backup restoration tested recently?

**For Supabase:**
- Daily backups included in Pro plan
- Check: Dashboard → Settings → Database → Backups

**For self-hosted:**
```bash
# PostgreSQL backup
pg_dump -U user -h host dbname > backup_$(date +%Y%m%d).sql

# Restore
psql -U user -h host dbname < backup_20260201.sql
```

---

### 20. Observability & Monitoring
**Priority:** MEDIUM
**Time:** 20 minutes

**Verify monitoring setup:**
- [ ] Error tracking (Sentry, Rollbar, LogRocket)
- [ ] Performance monitoring (Vercel Analytics, New Relic)
- [ ] Uptime monitoring (Pingdom, UptimeRobot)
- [ ] Log aggregation (Datadog, Papertrail, Logtail)
- [ ] Alerting configured (PagerDuty, Slack, email)

**Key metrics to track:**
- [ ] Error rate (< 1% typical)
- [ ] Response time (p50, p95, p99)
- [ ] Uptime (99.9% SLA)
- [ ] Database connection pool usage
- [ ] Memory/CPU usage

**Setup alerts for:**
- 5xx errors spike
- Response time > 5 seconds
- Database connection failures
- Rate limit exhaustion

---

## 🔵 LOW PRIORITY (NICE TO HAVE)

### 21. Penetration Testing
**Priority:** LOW
**Time:** 2+ hours

**OWASP Top 10 checklist:**
- [ ] A01: Broken Access Control - Test with different user roles
- [ ] A02: Cryptographic Failures - Verify HTTPS, encrypted storage
- [ ] A03: Injection - Test SQL injection, XSS, command injection
- [ ] A04: Insecure Design - Review architecture decisions
- [ ] A05: Security Misconfiguration - Check default credentials, debug mode off
- [ ] A06: Vulnerable Components - npm audit
- [ ] A07: Authentication Failures - Test brute force, session fixation
- [ ] A08: Data Integrity Failures - Verify signed cookies, CSRF tokens
- [ ] A09: Logging Failures - Check audit logs for sensitive operations
- [ ] A10: SSRF - Test requests to internal services

**Tools:**
- OWASP ZAP (automated scanner)
- Burp Suite (manual testing)
- nuclei (vulnerability scanner)

---

### 22. Accessibility (WCAG)
**Priority:** LOW
**Time:** 1 hour

**Run automated tests:**
- Lighthouse accessibility score
- axe DevTools browser extension

**Check:**
- [ ] All images have alt text
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Keyboard navigation works (tab order)
- [ ] ARIA labels on interactive elements
- [ ] Form inputs have labels
- [ ] Focus indicators visible

---

### 23. Documentation
**Priority:** LOW
**Time:** 30 minutes

**Ensure these docs exist:**
- [ ] README.md with setup instructions
- [ ] CHANGELOG.md with version history
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagram
- [ ] Runbook for common issues
- [ ] Security incident response plan

---

## 📊 FINAL REPORT GENERATION

### Generate Production Audit Report

Create `.tmp/production_audit_report.md` with findings:

```markdown
# Production Audit Report
**Date:** 2026-02-01
**Project:** [Project Name]
**Auditor:** Claude Code

## Summary
- **Critical Issues:** 0
- **High Issues:** 2
- **Medium Issues:** 5
- **Low Issues:** 3
- **Overall Score:** 7.5/10

## Critical Issues (BLOCK DEPLOYMENT)
None found ✅

## High Issues (FIX BEFORE LAUNCH)
1. **No Rate Limiting on Login** (HIGH)
   - File: src/app/api/admin/login/route.ts
   - Impact: Brute force attacks possible
   - Fix: Implement Upstash rate limiter

2. **Missing Security Headers** (HIGH)
   - File: src/middleware.ts (missing)
   - Impact: Clickjacking, XSS vulnerabilities
   - Fix: Create middleware with CSP, X-Frame-Options

## Medium Issues (RECOMMENDED)
[...]

## Passed Checks ✅
- JWT authentication implemented
- RLS policies applied
- No hardcoded secrets found
- Dependencies vulnerability-free
- HTTPS configured

## Deployment Recommendation
⚠️ **CONDITIONAL GO** - Fix 2 high-priority issues before launch.
```

---

## 🎯 QUICK START CHECKLIST

Use this for fast pre-deployment verification:

```bash
# 1. Secrets scan (30 seconds)
rg -i "(password|api_key|secret|token)\s*=\s*['\"]" --type ts --type js

# 2. npm audit (30 seconds)
npm audit --production

# 3. Environment check (10 seconds)
grep "JWT_SECRET\|ADMIN_PASSWORD_HASH" .env

# 4. RLS policies check (manual - 2 minutes)
# Open Supabase → SQL Editor → Run: SELECT * FROM pg_policies WHERE schemaname='public';

# 5. Headers check (30 seconds)
curl -I https://your-app.vercel.app | grep -E "(X-Frame|Content-Security)"

# 6. Rate limiting test (1 minute)
for i in {1..10}; do curl -X POST https://your-app.vercel.app/api/admin/login -d '{"password":"test"}'; done

# 7. Build check (2 minutes)
npm run build
```

**If all pass:** ✅ Safe to deploy
**If any fail:** ⚠️ Review and fix before deployment

---

## 📚 REFERENCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/features/ratelimiting)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last Updated:** 2026-02-01
**Version:** 2.0
**Maintained by:** [Your Team/Organization]
