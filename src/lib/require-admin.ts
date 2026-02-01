
import { NextResponse } from 'next/server';
import { getAdminTokenFromCookies, verifyAdminToken } from './auth-admin';

type AuthResult =
    | { authenticated: true }
    | { authenticated: false; response: NextResponse };

/**
 * Middleware helper to require admin authentication
 * Use at the start of any admin-only API route
 * 
 * Example usage:
 * ```
 * export async function POST(request: Request) {
 *     const auth = await requireAdmin();
 *     if (!auth.authenticated) return auth.response;
 *     
 *     // ... rest of handler
 * }
 * ```
 */
export async function requireAdmin(): Promise<AuthResult> {
    const token = await getAdminTokenFromCookies();

    if (!token) {
        return {
            authenticated: false,
            response: NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            )
        };
    }

    const payload = await verifyAdminToken(token);

    if (!payload) {
        return {
            authenticated: false,
            response: NextResponse.json(
                { success: false, error: 'Invalid or expired token' },
                { status: 401 }
            )
        };
    }

    return { authenticated: true };
}
