
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { signAdminToken } from '@/lib/auth-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password } = body;

        // Check for bcrypt hash first, fall back to plain text for backwards compatibility
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPasswordPlain = process.env.ADMIN_PASSWORD;

        console.log("Login Debug [Safe]:");
        console.log("- Hash Configured:", !!adminPasswordHash);
        console.log("- Plain Configured:", !!adminPasswordPlain);
        console.log("- Password received length:", password?.length);

        if (!adminPasswordHash && !adminPasswordPlain) {
            console.error("No admin password configured");
            return NextResponse.json(
                { success: false, error: 'Admin password not configured' },
                { status: 500 }
            );
        }

        let isValid = false;

        if (adminPasswordHash) {
            // Secure path: compare with bcrypt hash
            isValid = await bcrypt.compare(password, adminPasswordHash);
            console.log("- Hash Compare Result:", isValid);
        } else if (adminPasswordPlain) {
            // Legacy path: plain text comparison (for backwards compat)
            isValid = password === adminPasswordPlain;
            console.log("- Plain Compare Result:", isValid);
        }

        if (!isValid) {
            return NextResponse.json(
                { success: false, error: 'Invalid password' },
                { status: 401 }
            );
        }

        // Generate secure JWT token
        const token = await signAdminToken();

        const response = NextResponse.json({ success: true });

        // Set HTTP-only cookie with JWT
        response.cookies.set('admin_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 24 hours
            path: '/',
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
