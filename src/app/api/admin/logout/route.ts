
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');

    // Also try to clear any other potential conflicting cookies if needed

    return NextResponse.json({ success: true });
}
