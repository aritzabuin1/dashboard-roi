
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
    console.log("🟢 [Generate Link] Request received");
    try {
        const { email } = await request.json();
        // console.log("📧 Email:", email); // REDACTED by Audit

        if (!email) {
            return NextResponse.json({ success: false, error: 'Email requerido' }, { status: 400 });
        }

        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        // Log key presence safely (don't log full key)
        console.log("🔑 Service Key Present:", !!key, "Length:", key?.length);

        if (!key) {
            console.error("❌ FALTAL: No SUPABASE_SERVICE_ROLE_KEY environment variable found");
            return NextResponse.json({ success: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY en servidor (Environment Variable missing)' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            key,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Determine redirect URL
        let redirectUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!redirectUrl && process.env.VERCEL_URL) {
            redirectUrl = `https://${process.env.VERCEL_URL}`;
        }
        if (!redirectUrl) {
            redirectUrl = 'https://dashboard-roi-aritzmore1-gmailcoms-projects.vercel.app';
        }
        console.log("🔗 Redirect URL:", redirectUrl);

        // Generate the link
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
                redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
            }
        });

        if (error) {
            console.error('❌ Supabase Error:', error);
            // Return the specific error message to the frontend
            return NextResponse.json({ success: false, error: `Supabase: ${error.message}` }, { status: 400 });
        }

        console.log("✅ Success! Link generated.");
        return NextResponse.json({
            success: true,
            link: data.properties.action_link
        });

    } catch (error: any) {
        console.error('💥 Crash Error:', error);
        return NextResponse.json({
            success: false,
            error: `Excepción: ${error.message || JSON.stringify(error)}`
        }, { status: 500 });
    }
}
