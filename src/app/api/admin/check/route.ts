
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');

    if (!session || !session.value) {
        return NextResponse.json({ authenticated: false });
    }

    // Verify the session token format
    try {
        const decoded = Buffer.from(session.value, 'base64').toString();
        if (decoded.startsWith('admin:')) {
            return NextResponse.json({ authenticated: true });
        }
    } catch {
        // Invalid token format
    }

    return NextResponse.json({ authenticated: false });
}
