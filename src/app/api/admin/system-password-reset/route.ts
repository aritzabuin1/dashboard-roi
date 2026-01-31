
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email y contraseña requeridos' }, { status: 400 });
        }

        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!key) {
            return NextResponse.json({ success: false, error: 'Falta Service Key' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            key,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // 1. Find User ID by Email (Admin List)
        // Note: In a large app we'd use a better search, but for < 100 users this is fine
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (!user) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado en Auth' }, { status: 404 });
        }

        // 2. Update Password and Confirm Email (Force Confirm)
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            {
                password: password,
                email_confirm: true // Force verify mechanism
            }
        );

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' });

    } catch (error: any) {
        console.error('Manual password reset error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Error interno' }, { status: 500 });
    }
}
