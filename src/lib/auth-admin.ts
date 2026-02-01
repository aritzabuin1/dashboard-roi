
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production'
);

const COOKIE_NAME = 'admin_session';

export interface AdminTokenPayload {
    role: 'admin';
    iat: number;
    exp: number;
}

/**
 * Sign a new admin JWT token (24h expiration)
 */
export async function signAdminToken(): Promise<string> {
    const token = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(JWT_SECRET);

    return token;
}

/**
 * Verify an admin JWT token
 * Returns payload if valid, null if invalid/expired
 */
export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);

        if (payload.role !== 'admin') {
            return null;
        }

        return payload as unknown as AdminTokenPayload;
    } catch {
        // Token invalid, expired, or tampered
        return null;
    }
}

/**
 * Check if the current request has a valid admin session
 * Reads from HTTP-only cookie
 */
export async function isAdminAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const session = cookieStore.get(COOKIE_NAME);

    if (!session?.value) {
        return false;
    }

    const payload = await verifyAdminToken(session.value);
    return payload !== null;
}

/**
 * Get the admin token from cookies (for API routes)
 */
export async function getAdminTokenFromCookies(): Promise<string | null> {
    const cookieStore = await cookies();
    const session = cookieStore.get(COOKIE_NAME);
    return session?.value || null;
}
