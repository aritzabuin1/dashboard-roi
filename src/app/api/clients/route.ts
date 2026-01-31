
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

            // Determine redirect URL
            let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;

            if (!redirectUrl && process.env.VERCEL_URL) {
                redirectUrl = `https://${process.env.VERCEL_URL}`;
            }

            if (!redirectUrl) {
                // HARDCODED FALLBACK FOR PRODUCTION
                redirectUrl = 'https://dashboard-roi-aritzmore1-gmailcoms-projects.vercel.app';
            }

            // Send magic link / invitation email
            // Point to Auth Callback to exchange code and redirect to login
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
                data: { client_name: name },
                redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
            });

            if (authError) {
                // Handle "User already registered" error gracefully
                if (authError.message.includes('already been registered') || authError.status === 422) {
                    console.log('User already exists, trying to link to existing user...');
                    // Try to list users (searching by email would be better but listUsers is what we have standard)
                    // Note: listUsers might not return all users if there are many, but for now this is a reasonable recovery
                    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                    const existingUser = listData.users.find(u => u.email === email);

                    if (existingUser) {
                        auth_user_id = existingUser.id;
                        console.log('User found, sending password recovery email...');

                        // Send password reset email directly
                        // Point to Auth Callback to exchange code and redirect to update-password
                        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
                            redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
                        });

                        if (resetError) {
                            console.error('Error sending reset email:', resetError);
                            return NextResponse.json(
                                { success: false, error: `Error enviando email recuperación: ${resetError.message}. Verifica límites de Supabase.` },
                                { status: 429 }
                            );
                        }

                    } else {
                    }
                } else {
                    console.error('Error inviting user:', authError);
                    return NextResponse.json(
                        { success: false, error: `Error invitación: ${authError.message}` },
                        { status: 400 }
                    );
                }
            } else {
                auth_user_id = authData.user.id;
            }
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
                ? `✅ Cliente reconectado. Se ha enviado un email de recuperación a ${email}.`
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
