
import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth-admin';

export async function GET() {
    const authenticated = await isAdminAuthenticated();
    return NextResponse.json({ authenticated });
}
