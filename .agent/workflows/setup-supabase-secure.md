---
description: Setup Supabase with secure Zero-Trust RLS defaults and Server-Side clients
---

# Setup Supabase Secure Workflow

Run this workflow immediately after installing Supabase to establish a secure foundation.

## Steps

### 1. Install Dependencies
```bash
npm install @supabase/supabase-js
```

### 2. Create Server-Side Client Helper
Create `src/lib/supabase-server.ts` to handle different access levels securely.

```typescript
import { createClient } from '@supabase/supabase-js';

// 1. Standard Client (Respects RLS - for client-side or user-scoped ops)
// Use this for 99% of operations
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 2. Service Role Client (Bypasses RLS - ADMIN ONLY)
// CRITICAL: Only use this when you explicitly need to bypass security
// Example: Creating clients, System webhooks, Admin dashboard
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("❌ MISSING SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
```

### 3. Create Zero-Trust RLS Template
Create `execution/rls_policies_base.sql`. This file should be applied to Supabase immediately.

```sql
-- 1. Enable RLS on ALL tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
-- Add other tables here...

-- 2. "Zero Trust" Default Deny
-- By enabling RLS, all access is DENIED by default.
-- We do NOT add a "true" policy for anon.

-- 3. Standard User Policy (Users see ONLY their own data)
-- For 'clients' table example:
CREATE POLICY "Users can view own client data" ON clients
FOR SELECT
USING (auth.uid() = auth_user_id);

-- 4. Service Role Bypasses Everything (Implicit)
-- No policy needed for Service Role, it overrides RLS.
```

### 4. Verify Environment
Check that `.env.local` or `.env` contains:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (MUST NEVER be prefixed with NEXT_PUBLIC)

## Usage
When creating a new feature, refer to this setup:
- **User Action?** Use `supabase` import.
- **Admin/System Action?** Use `getSupabaseAdmin()`.
