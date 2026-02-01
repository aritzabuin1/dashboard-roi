# Security & Functionality Improvement Plan
## AI-Mate ROI Dashboard

---

## Executive Summary

This plan addresses **6 critical security vulnerabilities** and **10 high-value functionality improvements** for the Next.js 16 dashboard application. The security issues pose immediate risks (forgeable admin tokens, unauthenticated endpoints, exposed API keys), while functionality improvements will enhance user experience and operational reliability.

**Priority:** Address Critical security issues first (Phases 1-3), then High priority items, followed by Medium enhancements.

---

## Part A: SECURITY IMPROVEMENTS

### Phase 1: CRITICAL - Admin Authentication Overhaul

**Current Risk:** Admin sessions use base64-encoded timestamps that can be trivially forged. Anyone can generate `admin:${timestamp}` and gain full admin access.

**Files to Modify:**
- `src/app/api/admin/login/route.ts` (lines 18, 26)
- `src/app/api/admin/check/route.ts` (line 16)
- Create new: `src/lib/auth-admin.ts`

**Implementation Steps:**

1. **Install JWT library:**
   ```bash
   npm install jose bcryptjs
   npm install -D @types/bcryptjs
   ```

2. **Create JWT utility (`src/lib/auth-admin.ts`):**
   - Sign tokens with HS256 using `process.env.JWT_SECRET`
   - Include claims: `{ role: "admin", iat, exp }` with 24h expiration
   - Verify function returns payload or null
   - Use `jose` library (Edge-compatible, not `jsonwebtoken`)

3. **Update login route:**
   - Generate bcrypt hash of new strong admin password offline
   - Replace plain text comparison with `bcrypt.compare()`
   - Replace base64 token with signed JWT
   - Add rate limiting (covered in Phase 5)

4. **Update check route:**
   - Replace `startsWith('admin:')` check with JWT verification
   - Validate expiration and signature
   - Return 401 if verification fails

**Environment Variables Needed:**
```env
JWT_SECRET=<generate with: openssl rand -base64 32>
ADMIN_PASSWORD_HASH=<bcrypt hash of new password>
```

**Verification:**
- Test forging old base64 token → should fail
- Test valid login → should receive JWT
- Decode JWT in jwt.io → verify claims
- Test expired token → should reject

---

### Phase 2: CRITICAL - Protect Admin-Only Endpoints

**Current Risk:** Critical endpoints have NO authentication checks. Attackers can generate password reset links, change user passwords, and create clients without credentials.

**Vulnerable Endpoints:**
- `src/app/api/admin/generate-link/route.ts` - Generates password reset links
- `src/app/api/admin/system-password-reset/route.ts` - Changes user passwords
- `src/app/api/clients/route.ts` (POST) - Creates clients with API keys
- `src/app/api/automations/route.ts` (POST) - Creates automation metadata

**Implementation Steps:**

1. **Create auth helper (`src/lib/require-admin.ts`):**
   ```typescript
   // Extract JWT from admin_session cookie
   // Verify using jose
   // Return { authenticated: true } or { authenticated: false, response: NextResponse }
   ```

2. **Apply to all admin endpoints:**
   - Add at start of POST handlers: `const auth = await requireAdmin(request); if (!auth.authenticated) return auth.response;`
   - Apply to: generate-link, system-password-reset, clients POST, automations POST

3. **Protect GET endpoints too:**
   - `/api/clients` GET currently exposes all data including API keys
   - `/api/automations` GET should also require auth
   - `/api/metrics` GET should require auth or session

**Verification:**
- Call each endpoint without cookie → expect 401
- Call with forged cookie → expect 401
- Login as admin, then call → expect success

---

### Phase 3: CRITICAL - Fix API Key Exposure

**Current Risk:** GET `/api/clients` returns all API keys to unauthenticated users (line 159 in `clients/route.ts`).

**Files to Modify:**
- `src/app/api/clients/route.ts`
- Create new: `src/app/api/clients/[id]/key/route.ts`
- `src/app/admin/page.tsx`

**Implementation Steps:**

1. **Remove API key from GET response:**
   ```typescript
   .select('id, name, created_at, auth_user_id')  // Remove api_key
   ```

2. **Create reveal endpoint (`src/app/api/clients/[id]/key/route.ts`):**
   - Require admin authentication
   - Return single client's API key
   - Log access for audit trail
   - Rate limit to prevent scraping

3. **Update admin UI:**
   - Replace API key display with "Reveal Key" button
   - Fetch key on-demand via new endpoint
   - Show in modal/tooltip, allow copy
   - Clear from memory after use

**Verification:**
- GET `/api/clients` response should not contain `api_key` field
- Reveal endpoint requires admin auth
- Frontend button fetches and displays key correctly

---

### Phase 4: HIGH - Implement Proper RLS Policies

**Current Risk:** Database has `USING (true)` policies allowing anonymous users to read/write all tables.

**Files to Modify:**
- Create new: `execution/rls_policies_v2.sql`
- `src/app/api/execution-webhook/route.ts`
- `src/lib/supabase.ts`
- `src/app/api/metrics/route.ts`

**Implementation Steps:**

1. **Create restrictive RLS policies (`execution/rls_policies_v2.sql`):**
   ```sql
   -- Drop overly permissive policies
   DROP POLICY IF EXISTS "Allow public read on executions" ON executions;
   DROP POLICY IF EXISTS "Allow public read on automation_metadata" ON automation_metadata;
   DROP POLICY IF EXISTS "Allow public read on clients" ON clients;

   -- Clients: authenticated users see only their own client record
   CREATE POLICY "Users see own client"
   ON clients FOR SELECT TO authenticated
   USING (auth.uid() = auth_user_id);

   -- Automation Metadata: users see only their client's automations
   CREATE POLICY "Users see own automations"
   ON automation_metadata FOR SELECT TO authenticated
   USING (client_id IN (
       SELECT id FROM clients WHERE auth_user_id = auth.uid()
   ));

   -- Executions: users see only their client's executions
   CREATE POLICY "Users see own executions"
   ON executions FOR SELECT TO authenticated
   USING (automation_id IN (
       SELECT id FROM automation_metadata
       WHERE client_id IN (SELECT id FROM clients WHERE auth_user_id = auth.uid())
   ));

   -- Webhook inserts use service_role key (no anon access)
   ```

2. **Update webhook to use service role:**
   - Modify `execution-webhook/route.ts` to use `SUPABASE_SERVICE_ROLE_KEY`
   - Add helper function to get admin Supabase client

3. **Update metrics endpoint:**
   - Check for authenticated Supabase session
   - Auto-filter to authenticated client's data
   - Allow admin session to view all data

4. **Run migration in Supabase SQL Editor**

**Verification:**
- Anonymous API calls to Supabase should return empty arrays
- Authenticated client can only see their own data
- Webhook with service role can insert executions
- Admin can view all data

---

### Phase 5: HIGH - Serverless-Compatible Rate Limiting

**Current Risk:** In-memory rate limiter won't work on Vercel. Each serverless invocation is isolated, so rate limit state is lost.

**Files to Modify:**
- Create new: `src/lib/rate-limit-upstash.ts`
- `src/app/api/admin/login/route.ts`
- `src/app/api/execution-webhook/route.ts`
- `src/app/api/clients/route.ts` (POST)

**Implementation Steps:**

1. **Add Upstash Redis dependency:**
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

2. **Create Upstash rate limiter (`src/lib/rate-limit-upstash.ts`):**
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { Redis } from "@upstash/redis";

   const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL!,
     token: process.env.UPSTASH_REDIS_REST_TOKEN!,
   });

   export const loginRateLimiter = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 min
     prefix: "ratelimit:login",
   });

   export const webhookRateLimiter = new Ratelimit({
     redis,
     limiter: Ratelimit.slidingWindow(100, "1 m"),
     prefix: "ratelimit:webhook",
   });
   ```

3. **Apply to endpoints:**
   - Admin login: 5 attempts per 15 minutes per IP
   - Webhook: 100 requests per minute per API key
   - Client creation: 10 per hour per IP

4. **Fallback for local dev:**
   - Check if Redis env vars exist
   - Use in-memory limiter if missing (dev only)

**Environment Variables:**
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Setup:** Create free account at [upstash.com](https://upstash.com), create Redis database, copy credentials.

**Verification:**
- Call login endpoint 6 times rapidly → 6th should return 429
- Wait 15 minutes → should work again
- Verify rate limit persists across different serverless instances

---

### Phase 6: MEDIUM - Add Security Headers

**Current Risk:** Missing security headers leave application vulnerable to clickjacking, XSS, and other attacks.

**Files to Modify:**
- Create new: `src/middleware.ts`

**Implementation Steps:**

1. **Create middleware (`src/middleware.ts`):**
   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';

   export function middleware(request: NextRequest) {
     const response = NextResponse.next();

     response.headers.set('X-Frame-Options', 'DENY');
     response.headers.set('X-Content-Type-Options', 'nosniff');
     response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
     response.headers.set('X-XSS-Protection', '1; mode=block');

     if (process.env.NODE_ENV === 'production') {
       response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
     }

     response.headers.set(
       'Content-Security-Policy',
       "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co;"
     );

     return response;
   }

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
   };
   ```

2. **Test CSP compatibility:**
   - Verify Recharts works (may need `unsafe-inline` for scripts)
   - Ensure Supabase connections whitelisted

**Verification:**
- Check response headers in browser DevTools → all headers present
- No CSP errors in console
- Try embedding in iframe → should be blocked
- Run Lighthouse security audit → improved score

---

## Part B: FUNCTIONALITY IMPROVEMENTS

### Phase 7: HIGH - Enhanced Error Handling & User Feedback

**Current Issue:** Errors logged to console but users see generic messages or silent failures.

**Files to Modify:**
- All API routes (add descriptive error responses)
- `src/app/page.tsx` (add error toast notifications)
- Create new: `src/components/ui/toast.tsx` (using shadcn/ui)

**Implementation Steps:**

1. **Add toast notification system:**
   ```bash
   npx shadcn@latest add toast
   ```

2. **Update API error responses:**
   - Return specific error codes and user-friendly messages
   - Distinguish between validation errors (400), auth errors (401), and server errors (500)
   - Example: "Client with this email already exists" vs "Internal Server Error"

3. **Add toast notifications in frontend:**
   - Success: "Client created successfully"
   - Error: Display API error message
   - Loading: "Generating password reset link..."

**Verification:**
- Test various error scenarios → user sees helpful message
- No cryptic "Internal Server Error" messages

---

### Phase 8: HIGH - Real-Time Execution Updates

**Current Issue:** Dashboard requires manual refresh to see new executions. Users don't know when automations run.

**Files to Modify:**
- `src/app/page.tsx`
- Consider: Supabase Realtime subscription or polling

**Implementation Steps:**

1. **Add Supabase Realtime subscription:**
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('executions-changes')
       .on('postgres_changes',
         { event: 'INSERT', schema: 'public', table: 'executions' },
         (payload) => {
           // Update local state with new execution
           // Show toast: "New automation executed: {name}"
         }
       )
       .subscribe();

     return () => supabase.removeChannel(channel);
   }, []);
   ```

2. **Alternative: Polling every 30 seconds:**
   - Less resource-intensive than websockets
   - Simpler implementation
   - Good enough for non-critical updates

3. **Add visual indicator:**
   - Pulse animation when new execution arrives
   - Badge showing "X new executions"

**Verification:**
- Trigger webhook from external automation
- Dashboard updates automatically without refresh
- Toast notification appears

---

### Phase 9: MEDIUM - Data Export Functionality

**Current Issue:** No way to export metrics for reporting/presentations.

**Files to Modify:**
- `src/app/page.tsx` (add export buttons)
- Create new: `src/lib/export.ts` (CSV generation)
- Create new: `src/app/api/export-pdf/route.ts` (optional PDF export)

**Implementation Steps:**

1. **Add CSV export:**
   ```typescript
   // Button in dashboard: "Export CSV"
   // Generate CSV from current metrics and execution history
   // Download as: `roi-report-${clientName}-${date}.csv`
   ```

2. **Add Excel export (optional):**
   ```bash
   npm install xlsx
   ```
   - Generate formatted Excel file with charts

3. **Add PDF export (optional):**
   ```bash
   npm install jspdf jspdf-autotable
   ```
   - Render dashboard snapshot as PDF report

**Verification:**
- Click "Export CSV" → downloads file with correct data
- Open in Excel → formatting preserved
- Includes all visible metrics and executions

---

### Phase 10: MEDIUM - Email Notifications for Failed Automations

**Current Issue:** No alerts when automations fail. Users must manually check dashboard.

**Files to Modify:**
- `src/app/api/execution-webhook/route.ts`
- Add email service (Resend, SendGrid, or Supabase Auth emails)

**Implementation Steps:**

1. **Install email library:**
   ```bash
   npm install resend
   ```

2. **Update webhook handler:**
   - When `status: 'error'` execution is logged
   - Send email to client user (from `clients.auth_user_id` → Supabase user email)
   - Subject: "⚠️ Automation Failed: {automation_name}"
   - Body: Include error details, timestamp, link to dashboard

3. **Add user preferences:**
   - Allow users to opt in/out of notifications
   - Add column to `clients` table: `email_notifications_enabled`

**Environment Variables:**
```env
RESEND_API_KEY=re_...
NOTIFICATION_FROM_EMAIL=noreply@ai-mate.com
```

**Verification:**
- POST error execution to webhook → email sent
- Check spam folder and deliverability
- Opt-out preference works

---

### Phase 11: MEDIUM - Search & Filter in Transparency Table

**Current Issue:** No way to search executions or filter by status/automation.

**Files to Modify:**
- `src/components/dashboard/TransparencyTable.tsx`

**Implementation Steps:**

1. **Add search input:**
   - Filter by automation name (client-side)
   - Debounced search (300ms delay)

2. **Add status filter:**
   - Dropdown: "All", "Success", "Error"
   - Filter executions by selected status

3. **Add date range picker:**
   ```bash
   npx shadcn@latest add popover calendar
   ```
   - Allow custom date range beyond 7d/30d/365d presets

**Verification:**
- Type in search → table filters instantly
- Select "Error" status → only errors shown
- Pick custom date range → data refreshes

---

### Phase 12: MEDIUM - Pagination for Transparency Table

**Current Issue:** Table may become slow with thousands of executions.

**Files to Modify:**
- `src/components/dashboard/TransparencyTable.tsx`
- `src/app/api/metrics/route.ts` (add pagination params)

**Implementation Steps:**

1. **Add pagination to API:**
   - Accept `?page=1&limit=50` query params
   - Return total count and pages

2. **Add pagination UI:**
   ```bash
   npx shadcn@latest add pagination
   ```
   - Show: "Showing 1-50 of 342"
   - Prev/Next buttons
   - Page number buttons

**Verification:**
- Create 100+ test executions
- Page loads quickly with 50 items
- Navigation works correctly

---

### Phase 13: LOW - Mobile Responsiveness Audit

**Current Issue:** Dashboard designed for desktop, may have mobile issues.

**Files to Modify:**
- `src/app/page.tsx`
- `src/components/dashboard/*.tsx`

**Implementation Steps:**

1. **Test on mobile viewports:**
   - iPhone SE (375px)
   - iPad (768px)
   - Desktop (1920px)

2. **Fix common issues:**
   - Horizontal scroll
   - Tiny touch targets (buttons < 44px)
   - Overlapping elements
   - Charts not responsive

3. **Add mobile-specific optimizations:**
   - Hamburger menu for navbar on mobile
   - Stack metrics vertically
   - Simplify chart on small screens

**Verification:**
- Test in Chrome DevTools responsive mode
- No horizontal scroll on any viewport
- All interactive elements easily tappable

---

### Phase 14: LOW - API Documentation

**Current Issue:** Webhook integration not documented. External developers must read code.

**Files to Modify:**
- Create new: `docs/webhook-api.md`
- Consider: Add OpenAPI spec

**Implementation Steps:**

1. **Create webhook documentation:**
   ```markdown
   # Webhook API Documentation

   ## POST /api/execution-webhook

   Records an automation execution.

   **Headers:**
   - `x-api-key`: Your client API key

   **Body:**
   ```json
   {
     "automation_id": "uuid",
     "status": "success" | "error",
     "timestamp": "ISO 8601 date"
   }
   ```

   **Rate Limit:** 100 requests/minute per API key
   ```

2. **Add example code:**
   - Python example using `requests`
   - JavaScript example using `fetch`
   - cURL example

3. **Optional: OpenAPI spec:**
   - Create `openapi.yaml`
   - Use Swagger UI or Redoc for interactive docs

**Verification:**
- Developer can integrate without reading source code
- All endpoints documented
- Examples work when copy-pasted

---

### Phase 15: LOW - Accessibility Audit

**Current Issue:** Unknown WCAG compliance level.

**Files to Modify:**
- All component files as needed

**Implementation Steps:**

1. **Run automated audit:**
   - Lighthouse accessibility score
   - axe DevTools browser extension

2. **Fix common issues:**
   - Missing alt text on images
   - Insufficient color contrast
   - Missing ARIA labels on buttons/icons
   - Keyboard navigation (tab order)
   - Focus indicators

3. **Test with screen reader:**
   - NVDA (Windows) or VoiceOver (Mac)
   - Ensure all content readable
   - Form inputs properly labeled

**Verification:**
- Lighthouse accessibility score > 95
- Can navigate entire dashboard with keyboard only
- Screen reader announces all content correctly

---

### Phase 16: LOW - Webhook Signature Verification (HMAC)

**Current Issue:** API keys passed in header but not cryptographically verified. Vulnerable to replay attacks.

**Files to Modify:**
- `src/app/api/execution-webhook/route.ts`
- Update docs: `docs/webhook-api.md`

**Implementation Steps:**

1. **Add HMAC signature generation:**
   ```typescript
   // Client side (in automation):
   const signature = crypto.createHmac('sha256', apiKey)
     .update(JSON.stringify(body))
     .digest('hex');
   ```

2. **Verify signature server-side:**
   ```typescript
   const expectedSig = crypto.createHmac('sha256', client.api_key)
     .update(rawBody)
     .digest('hex');

   if (signature !== expectedSig) {
     return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
   }
   ```

3. **Update webhook docs with examples**

**Verification:**
- Valid signature → request succeeds
- Invalid signature → 401 error
- Replay attack with old signature → fails

---

## Implementation Summary

### Critical Files to Modify

| Priority | File | Changes |
|----------|------|---------|
| **Critical** | `src/app/api/admin/login/route.ts` | JWT + bcrypt auth |
| **Critical** | `src/app/api/admin/check/route.ts` | JWT verification |
| **Critical** | `src/app/api/clients/route.ts` | Auth check, hide API keys |
| **Critical** | `src/lib/auth-admin.ts` | NEW - JWT utilities |
| **Critical** | `src/lib/require-admin.ts` | NEW - Auth middleware |
| **Critical** | `execution/rls_policies_v2.sql` | NEW - Restrictive RLS |
| **High** | `src/lib/rate-limit-upstash.ts` | NEW - Serverless rate limiting |
| **High** | `src/app/api/execution-webhook/route.ts` | Service role, rate limit |
| **Medium** | `src/middleware.ts` | NEW - Security headers |
| **Medium** | `src/app/page.tsx` | Real-time updates, export, search |

### New Dependencies Required

```json
{
  "dependencies": {
    "jose": "^5.x",              // JWT for Edge runtime
    "bcryptjs": "^2.x",          // Password hashing
    "@upstash/ratelimit": "^1.x", // Serverless rate limiting
    "@upstash/redis": "^1.x",     // Redis for Upstash
    "resend": "^3.x"              // Email notifications
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.x"
  }
}
```

### Environment Variables to Add

```env
# JWT & Auth
JWT_SECRET=<openssl rand -base64 32>
ADMIN_PASSWORD_HASH=<bcrypt hash>

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Email (optional for Phase 10)
RESEND_API_KEY=re_...
NOTIFICATION_FROM_EMAIL=noreply@ai-mate.com
```

### External Services to Set Up

1. **Upstash** (upstash.com) - Free tier for Redis rate limiting
2. **Resend** (resend.com) - Free tier for email notifications

---

## Testing Checklist

### Security Tests
- [ ] Cannot forge admin JWT tokens
- [ ] Old base64 tokens rejected
- [ ] Admin endpoints return 401 without auth
- [ ] Rate limiting works across serverless instances
- [ ] Login blocked after 5 failed attempts
- [ ] API keys not exposed in GET /api/clients
- [ ] Anonymous users cannot read database via RLS
- [ ] Webhook uses service role for inserts
- [ ] Security headers present on all responses
- [ ] Password stored as bcrypt hash (not plaintext)

### Functionality Tests
- [ ] Toast notifications show on errors/success
- [ ] Real-time updates work when webhook triggered
- [ ] CSV export downloads with correct data
- [ ] Email sent when automation fails
- [ ] Search filters transparency table
- [ ] Pagination works with 100+ executions
- [ ] Mobile layout works on 375px viewport
- [ ] Keyboard navigation works (tab through UI)
- [ ] Screen reader announces all content
- [ ] HMAC signature verification works

---

## Rollback Plan

If issues arise during deployment:

1. **Database RLS:** Run original `rls_policies.sql` to restore permissive policies
2. **Admin Auth:** Keep old base64 check in separate branch, can revert
3. **Rate Limiting:** Upstash failure → fallback to in-memory (already built in)
4. **Real-time Updates:** Non-critical feature, can be disabled
5. **Security Headers:** Remove middleware.ts if CSP breaks charts

**Recommendation:** Deploy security fixes to staging environment first, test thoroughly before production.

---

## Estimated Effort

| Phase | Priority | Estimated Time | Dependencies |
|-------|----------|----------------|--------------|
| 1. JWT Auth | Critical | 3-4 hours | None |
| 2. Protect Endpoints | Critical | 1-2 hours | Phase 1 |
| 3. Hide API Keys | Critical | 2-3 hours | Phase 2 |
| 4. RLS Policies | High | 3-4 hours | None (parallel) |
| 5. Rate Limiting | High | 2-3 hours | Upstash setup |
| 6. Security Headers | Medium | 1 hour | None (parallel) |
| 7. Error Handling | High | 2-3 hours | None (parallel) |
| 8. Real-time Updates | High | 2-3 hours | None (parallel) |
| 9. Export | Medium | 2-3 hours | None (parallel) |
| 10. Email Alerts | Medium | 2-3 hours | Resend setup |
| 11. Search/Filter | Medium | 2-3 hours | None (parallel) |
| 12. Pagination | Medium | 2-3 hours | None (parallel) |
| 13. Mobile Audit | Low | 3-4 hours | None (parallel) |
| 14. API Docs | Low | 2 hours | None (parallel) |
| 15. Accessibility | Low | 3-4 hours | None (parallel) |
| 16. HMAC | Low | 2-3 hours | None (parallel) |

**Total:** ~37-50 hours of development work

**Recommended Order:**
1. Phases 1-3 (security critical) - ~1 week
2. Phases 4-6 (security high/medium) - ~1 week
3. Phases 7-12 (functionality) - ~2 weeks
4. Phases 13-16 (polish) - ~1 week

---

## Success Metrics

**Security:**
- Zero critical vulnerabilities in penetration test
- Lighthouse security score: 100
- No exposed credentials/API keys
- All admin operations require valid JWT
- Rate limiting prevents brute force attacks

**Functionality:**
- User satisfaction score > 4.5/5
- Dashboard load time < 2 seconds
- Mobile usage increases by 30%
- Export feature used weekly by 80% of clients
- Email alerts reduce support tickets by 50%

---

## End-to-End Verification

### Manual Test Scenario

1. **As Attacker:**
   - Try to forge admin token → Blocked
   - Try to access `/api/admin/generate-link` without auth → 401
   - Try to brute force login → Rate limited after 5 attempts
   - Try to read database directly → RLS blocks all queries

2. **As Admin:**
   - Login with new password → JWT issued
   - Create new client → Email invite sent
   - View client list → API keys hidden
   - Reveal single API key → Works with audit log
   - Generate password reset link → Email sent

3. **As Client:**
   - Login via Supabase Auth → Dashboard shows only my data
   - View metrics → Real-time updates work
   - Export CSV → File downloads correctly
   - Trigger automation → Webhook records execution
   - Automation fails → Email alert received

4. **Cross-Browser:**
   - Chrome, Firefox, Safari, Edge
   - Mobile iOS Safari, Chrome Android
   - Keyboard-only navigation
   - Screen reader (NVDA/VoiceOver)

---

## Notes

- **Backward Compatibility:** Admin sessions will be invalidated after JWT migration. All admins must re-login.
- **Client Authentication:** No changes to Supabase Auth flow. Existing client sessions unaffected.
- **Database Migration:** RLS policy changes may briefly interrupt service. Schedule during maintenance window.
- **Webhook Integration:** Existing automations continue to work. HMAC signature (Phase 16) is optional enhancement.

---

## Questions to Resolve

None - plan is ready for execution. All requirements understood based on codebase analysis.
