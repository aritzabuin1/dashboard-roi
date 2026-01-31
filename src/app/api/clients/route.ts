
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

// Regular client for database operations
import { supabase } from '@/lib/supabase';

// Generate a simple API key
function generateApiKey() {
    return `sk_${randomBytes(16).toString('hex')}`;
}

// Lazy initialization of admin client (only when needed and when env is set)
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
        const { name, email, password } = body;

        if (!name) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: name' },
                { status: 400 }
            );
        }

        const api_key = generateApiKey();
        let auth_user_id: string | null = null;

        // If email is provided, create auth user for client access
        if (email) {
            const supabaseAdmin = getSupabaseAdmin();

            if (!supabaseAdmin) {
                return NextResponse.json(
                    { success: false, error: 'Server not configured for user creation. Add SUPABASE_SERVICE_ROLE_KEY to environment.' },
                    { status: 500 }
                );
            }

            // Create user in Supabase Auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: password || randomBytes(12).toString('hex'),
                email_confirm: true,
                user_metadata: { client_name: name }
            });

            if (authError) {
                console.error('Error creating auth user:', authError);
                return NextResponse.json(
                    { success: false, error: `Auth error: ${authError.message}` },
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
                ? `Cliente creado. Email: ${email}${password ? '' : ' (contraseña auto-generada)'}`
                : 'Cliente creado sin acceso al dashboard.'
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
