---
description: Generate a secure API endpoint with proper auth, validation, and error handling
---

# Create Secure Endpoint Workflow

Use this workflow whenever you need to add a new API route. It enforces security best practices by default.

## Steps

### 1. Define Requirements
Before coding, answer:
- **Method**: GET, POST, PUT, DELETE?
- **Access Level**: Public, User (Own Data), or Admin?
- **Data Action**: Read or Mutate?

### 2. Choose the Right Client (The Matrix)
Refer to this decision matrix:

| Access Needed | Operation | Client to Use | Auth Check |
| :--- | :--- | :--- | :--- |
| **Public** | Read Public Info | `supabase` (Anon) | None |
| **User** | Read Own Data | `supabase` (Anon) | RLS via `auth.uid()` |
| **User** | Update Own Data | `supabase` (Anon) | RLS via `auth.uid()` |
| **Admin** | Read ANY Data | `getSupabaseAdmin()` | `await requireAdmin()` |
| **Admin** | Update ANY Data | `getSupabaseAdmin()` | `await requireAdmin()` |
| **System** | Webhook Handler | `getSupabaseAdmin()` | Verify Signature |

### 3. Scaffold the Endpoint
Template for a secure endpoint (`src/app/api/entity/route.ts`):

```typescript
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server'; // Standard Client
import { getSupabaseAdmin } from '@/lib/supabase-server'; // Admin Client
import { requireAdmin } from '@/lib/require-admin';

// POST: Secure Creation (Admin Only Example)
export async function POST(request: Request) {
  // 1. AUTHENTICATION FIRST
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    // 2. INPUT VALIDATION
    const body = await request.json();
    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 3. SECURE DATA ACCESS (Service Role for Admin)
    const adminClient = getSupabaseAdmin();
    if (!adminClient) throw new Error('Misconfigured Server');

    const { data, error } = await adminClient
      .from('entities')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    // 4. SANITIZED RESPONSE
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    // 5. SECURE ERROR HANDLING
    console.error('API Error:', error); // Log full error server-side
    return NextResponse.json(
      { error: 'Internal Server Error' }, // Generic message to client
      { status: 500 }
    );
  }
}
```

### 4. Input Validation Checklist
- [ ] Validate all body parameters (use Zod if complex).
- [ ] Check string lengths to prevent buffer overflows/spam.
- [ ] Sanitize HTML/Script tags to prevent XSS.

### 5. Output Sanitization Checklist
- [ ] remove `password`, `hash`, `api_key` from response.
- [ ] remove stack traces from error response.
