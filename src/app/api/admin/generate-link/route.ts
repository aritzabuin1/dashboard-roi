
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';
import { apiError } from '@/lib/api-errors';

export async function POST(request: Request) {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ success: false, error: 'Email requerido' }, { status: 400 });
        }

        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!key) {
            console.error('[generate-link] SUPABASE_SERVICE_ROLE_KEY not set');
            return apiError(500, 'SUPABASE_SERVICE_ROLE_KEY no configurado');
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            key,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Determine redirect URL
        let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!redirectUrl && process.env.VERCEL_URL) {
            redirectUrl = `https://${process.env.VERCEL_URL}`;
        }
        if (!redirectUrl) {
            console.error('[generate-link] NEXT_PUBLIC_SITE_URL not configured');
            return apiError(500, 'NEXT_PUBLIC_SITE_URL no configurado');
        }

        // Generate the link
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
            }
        });

        if (error) {
            console.error('[generate-link] Supabase error:', error);
            // Admin-only route — Supabase message is useful for troubleshooting
            return NextResponse.json({ success: false, error: `Supabase: ${error.message}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            link: data.properties.action_link
        });

    } catch (error: any) {
        console.error('[generate-link] Crash:', error);
        return apiError(500);
    }
}
