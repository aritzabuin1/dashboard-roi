
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/require-admin';

// Regular client for database operations
import { supabase } from '@/lib/supabase';

// Generate a simple API key
function generateApiKey() {
    return `sk_${randomBytes(16).toString('hex')}`;
}

// Lazy initialization of admin client (only when needed)
function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request: Request) {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const body = await request.json();
        const { name, email } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: name' },
                { status: 400 }
            );
        }

        // Check for duplicate client name
        const supabaseAdminForCheck = getSupabaseAdmin();
        if (!supabaseAdminForCheck) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }
        const { data: existingByName } = await supabaseAdminForCheck
            .from('clients')
            .select('id')
            .ilike('name', name.trim())
            .maybeSingle();

        if (existingByName) {
            return NextResponse.json(
                { success: false, error: `Ya existe un cliente con el nombre "${name.trim()}".` },
                { status: 409 }
            );
        }

        const api_key = generateApiKey();
        let auth_user_id: string | null = null;

        // If email is provided, create auth user and try to send invitation
        let emailWarning: string | null = null;
        let createdNewAuthUser = false;

        if (email) {
            const supabaseAdmin = getSupabaseAdmin();

            if (!supabaseAdmin) {
                return NextResponse.json(
                    { success: false, error: 'Configuración de servidor incompleta.' },
                    { status: 500 }
                );
            }

            // Check if user already exists in Auth
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = listData.users.find(u => u.email === email);

            if (existingUser) {
                auth_user_id = existingUser.id;

                // Check if client row already exists
                const { data: existingClient } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('auth_user_id', auth_user_id)
                    .single();

                if (existingClient) {
                    return NextResponse.json({
                        success: false,
                        error: 'Este usuario ya tiene un cliente asociado. No es necesario crearlo.'
                    }, { status: 400 });
                }
            } else {
                // Create user in Auth (without requiring email delivery)
                const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    user_metadata: { client_name: name },
                    email_confirm: false
                });

                if (createError) {
                    console.error('Error creating auth user:', createError);
                    return NextResponse.json(
                        { success: false, error: `Error creando usuario: ${createError.message}` },
                        { status: 400 }
                    );
                }

                auth_user_id = newUser.user.id;
                createdNewAuthUser = true;
            }

            // Try to send invitation email (non-blocking)
            let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
            if (!redirectUrl && process.env.VERCEL_URL) {
                redirectUrl = `https://${process.env.VERCEL_URL}`;
            }

            if (redirectUrl) {
                const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                    data: { client_name: name },
                    redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
                });

                if (inviteError) {
                    console.warn('Email invite failed (client still created):', inviteError.message);
                    emailWarning = `Cliente creado pero el email no se pudo enviar: ${inviteError.message}`;
                }
            } else {
                emailWarning = 'Cliente creado pero NEXT_PUBLIC_SITE_URL no está configurado.';
            }
        }

        // Create client record in database using Service Role (to bypass RLS)
        const supabaseAdminForInsert = getSupabaseAdmin();
        if (!supabaseAdminForInsert) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }

        const insertData: Record<string, unknown> = { name, api_key };
        if (auth_user_id) {
            insertData.auth_user_id = auth_user_id;
        }

        const { data, error } = await supabaseAdminForInsert
            .from('clients')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            // Rollback: delete auth user only if we just created it
            if (createdNewAuthUser && auth_user_id) {
                await supabaseAdminForInsert.auth.admin.deleteUser(auth_user_id);
                console.log('Rolled back orphaned auth user:', auth_user_id);
            }
            console.error('Error creating client:', error);
            return NextResponse.json(
                { success: false, error: 'Error creando perfil de cliente.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            client: data,
            message: emailWarning || 'Cliente creado correctamente.',
            emailSent: !emailWarning
        });

    } catch (error) {
        console.error('Client creation error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Require admin authentication to list clients
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        // Use Service Role client to bypass RLS (we already verified this is an Admin)
        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }

        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('id, name, created_at, auth_user_id') // api_key removed for security
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error listing clients:', error);
            return NextResponse.json({ success: false, error: 'Error cargando clientes.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, clients: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
