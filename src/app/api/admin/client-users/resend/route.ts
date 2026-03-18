
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
        const { clientUserId } = await request.json();

        if (!clientUserId) {
            return NextResponse.json(
                { success: false, error: 'clientUserId es obligatorio.' },
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

        // Get the client_user record
        const { data: clientUser, error: fetchError } = await supabaseAdmin
            .from('client_users')
            .select('id, email, client_id, auth_user_id, accepted_at')
            .eq('id', clientUserId)
            .single();

        if (fetchError || !clientUser) {
            return NextResponse.json(
                { success: false, error: 'Usuario no encontrado.' },
                { status: 404 }
            );
        }

        // Get client name for the email
        const { data: client } = await supabaseAdmin
            .from('clients')
            .select('name')
            .eq('id', clientUser.client_id)
            .single();

        const clientName = client?.name || 'Cliente';

        // If user already accepted, send a password reset instead
        if (clientUser.accepted_at) {
            let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
            if (!redirectUrl && process.env.VERCEL_URL) {
                redirectUrl = `https://${process.env.VERCEL_URL}`;
            }

            if (redirectUrl) {
                const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'recovery',
                    email: clientUser.email,
                    options: { redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password` }
                });

                if (resetError) {
                    return NextResponse.json({
                        success: false,
                        error: `Error generando link: ${resetError.message}`
                    }, { status: 500 });
                }
            }

            return NextResponse.json({
                success: true,
                message: `Email de recuperación enviado a ${clientUser.email}.`
            });
        }

        // Resend invitation
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

        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            clientUser.email,
            {
                data: { client_name: clientName },
                redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
            }
        );

        if (inviteError) {
            console.error('[client-users/resend] Email error:', inviteError.message);
            return NextResponse.json({
                success: false,
                error: `No se pudo enviar el email: ${inviteError.message}. Usa las herramientas de emergencia.`
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Invitación reenviada a ${clientUser.email}.`
        });

    } catch (error) {
        console.error('[client-users/resend] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}
