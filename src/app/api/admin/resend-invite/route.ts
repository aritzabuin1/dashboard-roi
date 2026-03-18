
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
        const { clientId, email } = await request.json();

        if (!clientId || !email) {
            return NextResponse.json(
                { success: false, error: 'clientId y email son obligatorios.' },
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

        if (client.auth_user_id) {
            return NextResponse.json(
                { success: false, error: 'Este cliente ya tiene acceso al dashboard.' },
                { status: 400 }
            );
        }

        // Check if email is already used by another auth user linked to a client
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData.users.find(u => u.email === email);
        let auth_user_id: string;

        if (existingUser) {
            // Check if this auth user is already linked to another client
            const { data: existingClient } = await supabaseAdmin
                .from('clients')
                .select('id')
                .eq('auth_user_id', existingUser.id)
                .maybeSingle();

            if (existingClient) {
                return NextResponse.json(
                    { success: false, error: 'Este email ya está asociado a otro cliente.' },
                    { status: 400 }
                );
            }

            auth_user_id = existingUser.id;
        } else {
            // Create auth user
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                user_metadata: { client_name: client.name },
                email_confirm: false
            });

            if (createError) {
                console.error('[send-invite] Error creating auth user:', createError);
                return NextResponse.json(
                    { success: false, error: `Error creando usuario: ${createError.message}` },
                    { status: 400 }
                );
            }

            auth_user_id = newUser.user.id;
        }

        // Link auth user to client
        const { error: updateError } = await supabaseAdmin
            .from('clients')
            .update({ auth_user_id })
            .eq('id', clientId);

        if (updateError) {
            console.error('[send-invite] Error linking auth user:', updateError);
            // Rollback: delete auth user if we just created it
            if (!existingUser) {
                await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
            }
            return NextResponse.json(
                { success: false, error: 'Error vinculando usuario al cliente.' },
                { status: 500 }
            );
        }

        // Also add to client_users for complete tracking
        const { error: cuError } = await supabaseAdmin
            .from('client_users')
            .upsert({
                client_id: clientId,
                auth_user_id,
                email,
                role: 'admin'
            }, { onConflict: 'client_id,email' });

        if (cuError) {
            console.warn('[send-invite] client_users insert failed (non-blocking):', cuError.message);
        }

        // Send invitation email
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

        const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { client_name: client.name },
            redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
        });

        if (inviteError) {
            console.error('[send-invite] Email error:', inviteError.message);
            return NextResponse.json({
                success: true,
                message: `Usuario vinculado pero el email no se pudo enviar: ${inviteError.message}. Usa las herramientas de emergencia para generar un link manual.`,
                emailSent: false
            });
        }

        return NextResponse.json({
            success: true,
            message: `Invitación enviada a ${email}.`,
            emailSent: true
        });

    } catch (error) {
        console.error('[send-invite] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}
