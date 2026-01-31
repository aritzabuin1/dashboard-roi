
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ success: false, error: 'Email requerido' }, { status: 400 });
        }

        const supabaseAdmin = getSupabaseAdmin();

        if (!supabaseAdmin) {
            return NextResponse.json(
                { success: false, error: 'Configuración de servidor incompleta.' },
                { status: 500 }
            );
        }

        let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!redirectUrl && process.env.VERCEL_URL) {
            redirectUrl = `https://${process.env.VERCEL_URL}`;
        }
        if (!redirectUrl) {
            redirectUrl = 'https://dashboard-roi-aritzmore1-gmailcoms-projects.vercel.app';
        }

        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
        });

        if (error) {
            console.error('Error sending reset email:', error);
            if (error.status === 429) {
                return NextResponse.json({ success: false, error: 'Límite de intentos excedido. Espera 1 hora.' }, { status: 429 });
            }
            return NextResponse.json({ success: false, error: 'Error enviando el correo.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Correo enviado.' });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
    }
}
