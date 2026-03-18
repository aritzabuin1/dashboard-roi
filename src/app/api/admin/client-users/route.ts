
import { NextRequest, NextResponse } from 'next/server';
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

// GET: List users for a client
export async function GET(request: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) {
        return NextResponse.json({ success: false, error: 'clientId requerido.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
        return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
        .from('client_users')
        .select('id, email, role, invited_at, accepted_at, auth_user_id')
        .eq('client_id', clientId)
        .order('invited_at', { ascending: true });

    if (error) {
        console.error('[client-users] Error listing:', error);
        return NextResponse.json({ success: false, error: 'Error cargando usuarios.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, users: data });
}

// POST: Invite a new user to a client
export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const { clientId, email, role } = await request.json();

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

        // Check client exists
        const { data: client, error: clientError } = await supabaseAdmin
            .from('clients')
            .select('id, name')
            .eq('id', clientId)
            .single();

        if (clientError || !client) {
            return NextResponse.json(
                { success: false, error: 'Cliente no encontrado.' },
                { status: 404 }
            );
        }

        // Check if this email is already invited to this client
        const { data: existing } = await supabaseAdmin
            .from('client_users')
            .select('id')
            .eq('client_id', clientId)
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Este email ya tiene una invitación para este cliente.' },
                { status: 409 }
            );
        }

        // Check if auth user exists or create one
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData.users.find(u => u.email === email);
        let auth_user_id: string | null = null;

        if (existingUser) {
            auth_user_id = existingUser.id;
        } else {
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                user_metadata: { client_name: client.name },
                email_confirm: false
            });

            if (createError) {
                console.error('[client-users] Error creating auth user:', createError);
                return NextResponse.json(
                    { success: false, error: `Error creando usuario: ${createError.message}` },
                    { status: 400 }
                );
            }

            auth_user_id = newUser.user.id;
        }

        // Also set as primary auth_user_id on client if none exists
        const { data: clientData } = await supabaseAdmin
            .from('clients')
            .select('auth_user_id')
            .eq('id', clientId)
            .single();

        if (clientData && !clientData.auth_user_id) {
            await supabaseAdmin
                .from('clients')
                .update({ auth_user_id })
                .eq('id', clientId);
        }

        // Insert into client_users
        const { error: insertError } = await supabaseAdmin
            .from('client_users')
            .insert({
                client_id: clientId,
                auth_user_id,
                email,
                role: role || 'viewer'
            });

        if (insertError) {
            console.error('[client-users] Error inserting:', insertError);
            return NextResponse.json(
                { success: false, error: 'Error guardando usuario.' },
                { status: 500 }
            );
        }

        // Send invitation email
        let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!redirectUrl && process.env.VERCEL_URL) {
            redirectUrl = `https://${process.env.VERCEL_URL}`;
        }

        let emailSent = false;
        if (redirectUrl) {
            const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { client_name: client.name },
                redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
            });

            if (inviteError) {
                console.warn('[client-users] Email invite failed:', inviteError.message);
            } else {
                emailSent = true;
            }
        }

        return NextResponse.json({
            success: true,
            message: emailSent
                ? `Invitación enviada a ${email}.`
                : `Usuario añadido pero el email no se pudo enviar. Usa las herramientas de emergencia.`,
            emailSent
        });

    } catch (error) {
        console.error('[client-users] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}
