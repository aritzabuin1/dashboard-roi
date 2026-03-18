
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const { clientId } = await request.json();

        if (!clientId) {
            return NextResponse.json(
                { success: false, error: 'clientId es obligatorio.' },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json(
                { success: false, error: 'Configuración de servidor incompleta.' },
                { status: 500 }
            );
        }

        // Look up the client
        const { data: client, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('id, name, auth_user_id')
            .eq('id', clientId)
            .single();

        if (clientError || !client) {
            return NextResponse.json(
                { success: false, error: 'Cliente no encontrado.' },
                { status: 404 }
            );
        }

        if (!client.auth_user_id) {
            return NextResponse.json(
                { success: false, error: 'Este cliente no tiene usuario de acceso. Fue creado sin email.' },
                { status: 400 }
            );
        }

        // Get the auth user to find their email
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(client.auth_user_id);

        if (authError || !authUser?.user?.email) {
            return NextResponse.json(
                { success: false, error: 'No se pudo obtener el email del usuario.' },
                { status: 500 }
            );
        }

        const email = authUser.user.email;

        // Build redirect URL
        let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!redirectUrl && process.env.VERCEL_URL) {
            redirectUrl = `https://${process.env.VERCEL_URL}`;
        }

        if (!redirectUrl) {
            return NextResponse.json(
                { success: false, error: 'NEXT_PUBLIC_SITE_URL no está configurado.' },
                { status: 500 }
            );
        }

        // Resend the invitation
        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { client_name: client.name },
            redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
        });

        if (inviteError) {
            console.error('[resend-invite] Error:', inviteError.message);
            return NextResponse.json(
                { success: false, error: `Error enviando invitación: ${inviteError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Invitación reenviada a ${email}.`
        });

    } catch (error) {
        console.error('[resend-invite] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}
