
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function getRedirectUrl(): string | null {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return null;
}

/**
 * Sends an invitation/access email using Supabase's built-in email system:
 * 1. Try inviteUserByEmail (for new/unconfirmed users — same as client creation)
 * 2. If fails (user already confirmed), use resetPasswordForEmail (same magic link system)
 *
 * Both methods use Supabase's email delivery with correct magic links
 * that route through /auth/callback → /client/update-password.
 */
export async function sendInviteEmail(
    email: string,
    clientName: string
): Promise<{ success: boolean; error?: string }> {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
        return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada.' };
    }

    const redirectUrl = getRedirectUrl();
    if (!redirectUrl) {
        return { success: false, error: 'NEXT_PUBLIC_SITE_URL no configurado.' };
    }

    const redirectTo = `${redirectUrl}/auth/callback?next=/client/update-password`;

    // Method 1: inviteUserByEmail — works for new/unconfirmed users
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { client_name: clientName },
        redirectTo
    });

    if (!inviteError) {
        console.log(`[invite-email] inviteUserByEmail succeeded for ${email}`);
        return { success: true };
    }

    console.warn(`[invite-email] inviteUserByEmail failed: ${inviteError.message}. Trying resetPasswordForEmail...`);

    // Method 2: resetPasswordForEmail — for already-confirmed users
    // Uses Supabase's built-in email system (same magic link flow that works)
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo
    });

    if (resetError) {
        console.error(`[invite-email] resetPasswordForEmail also failed: ${resetError.message}`);
        if (resetError.status === 429) {
            return { success: false, error: 'Límite de emails excedido. Espera unos minutos e inténtalo de nuevo.' };
        }
        return { success: false, error: `Error enviando email: ${resetError.message}` };
    }

    console.log(`[invite-email] resetPasswordForEmail succeeded for ${email}`);
    return { success: true };
}

