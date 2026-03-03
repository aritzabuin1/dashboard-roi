
import { NextResponse } from 'next/server';
import { signAdminToken } from '@/lib/auth-admin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password } = body;

        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error("ADMIN_PASSWORD not configured");
            return NextResponse.json(
                { success: false, error: 'Admin password not configured' },
                { status: 500 }
            );
        }

        // Simple, reliable password check
        const isValid = password === adminPassword;

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
