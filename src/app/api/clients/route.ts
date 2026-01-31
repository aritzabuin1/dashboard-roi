
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

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
    try {
        const body = await request.json();
        const { name, email } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: name' },
                { status: 400 }
            );
        }

        const api_key = generateApiKey();
        let auth_user_id: string | null = null;
        let inviteLink: string | null = null;

        // If email is provided, send invitation to client
        if (email) {
            const supabaseAdmin = getSupabaseAdmin();

            if (!supabaseAdmin) {
                return NextResponse.json(
                    { success: false, error: 'Server not configured for invitations. Add SUPABASE_SERVICE_ROLE_KEY.' },
                    { status: 500 }
                );
            }

            // Send magic link / invitation email
            // The client will receive an email to set their password
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { client_name: name },
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://dashboard-roi-neon.vercel.app'}/client/login`
            });

            if (authError) {
                console.error('Error inviting user:', authError);
                return NextResponse.json(
                    { success: false, error: `Invitation error: ${authError.message}` },
                    { status: 400 }
                );
            }

            auth_user_id = authData.user.id;
        }

        // Create client record in database
        const insertData: Record<string, unknown> = { name, api_key };
        if (auth_user_id) {
            insertData.auth_user_id = auth_user_id;
        }

        const { data, error } = await supabase
            .from('clients')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            // Rollback: delete auth user if client creation failed
            if (auth_user_id) {
                const supabaseAdmin = getSupabaseAdmin();
                if (supabaseAdmin) {
                    await supabaseAdmin.auth.admin.deleteUser(auth_user_id);
                }
            }
            console.error('Error creating client:', error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            client: data,
            message: email
                ? `✅ Invitación enviada a ${email}. El cliente recibirá un email para crear su contraseña.`
                : 'Cliente creado (solo webhook, sin acceso dashboard).'
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
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('id, name, api_key, created_at, auth_user_id')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, clients: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
