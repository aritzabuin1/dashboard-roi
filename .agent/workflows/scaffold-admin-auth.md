---
description: Scaffold a secure Admin Authentication system with JWT and Bcrypt
---

# Scaffold Admin Auth Workflow

Run this workflow to quickly set up a secure, JWT-based authentication system for administrators.

## Steps

### 1. Install Security Packages
```bash
npm install jose bcryptjs
npm install -D @types/bcryptjs
```

### 2. Create Auth Helper
Create `src/lib/auth-admin.ts`.

```typescript
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h') // Set session timeout
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function verifyPassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

// Helper to generate hash (use locally to get value for .env)
export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}
```

### 3. Create Middleware Helper
Create `src/lib/require-admin.ts`.

```typescript
import { verifyToken } from './auth-admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function requireAdmin() {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_token');

  if (!token) {
    return { 
      authenticated: false, 
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) 
    };
  }

  const payload = await verifyToken(token.value);
  if (!payload) {
    return { 
      authenticated: false, 
      response: NextResponse.json({ error: 'Invalid Token' }, { status: 401 }) 
    };
  }

  return { authenticated: true, user: payload };
}
```

### 4. Create Login Route
Create `src/app/api/admin/login/route.ts`.

```typescript
import { NextResponse } from 'next/server';
import { signToken, verifyPassword } from '@/lib/auth-admin';

// SECURITY NOTE: Hash this password and store in .env!
// Run `console.log(await hashPassword('YourPass'))` to get the hash.
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    // 1. Verify credentials
    const isValid = await verifyPassword(password, ADMIN_PASSWORD_HASH);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
    }

    // 2. Generate Session
    const token = await signToken({ role: 'admin' });

    // 3. Set Cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;
  } catch(e) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
```

### 5. Update .env.example
Add these keys:
```
JWT_SECRET=run_openssl_rand_base64_32
ADMIN_PASSWORD_HASH=run_hash_function_locally_to_get_this
```
