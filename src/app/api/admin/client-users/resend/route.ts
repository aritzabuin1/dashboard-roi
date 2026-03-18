
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';
import { sendInviteEmail } from '@/lib/invite-email';

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
            .select('id, email, client_id')
            .eq('id', clientUserId)
            .single();

        if (fetchError || !clientUser) {
            return NextResponse.json(
                { success: false, error: 'Usuario no encontrado.' },
                { status: 404 }
            );
        }

        // Get client name
        const { data: client } = await supabaseAdmin
            .from('clients')
            .select('name')
            .eq('id', clientUser.client_id)
            .single();

        const clientName = client?.name || 'Cliente';

        // Send invite via Resend (works for both pending and active users)
        const emailResult = await sendInviteEmail(clientUser.email, clientName);

        if (!emailResult.success) {
            return NextResponse.json({
                success: false,
                error: emailResult.error || 'No se pudo enviar el email.'
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
