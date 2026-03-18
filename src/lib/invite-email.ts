
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function getRedirectUrl(): string | null {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return null;
}

/**
 * Sends an invitation email using the same flow as client creation:
 * 1. Try inviteUserByEmail (Supabase's built-in, proven to work)
 * 2. If fails (user already confirmed), fallback to generateLink + Resend
 */
export async function sendInviteEmail(
    email: string,
    clientName: string
): Promise<{ success: boolean; error?: string }> {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
        return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada.' };
    }

    const redirectUrl = getRedirectUrl();
    if (!redirectUrl) {
        return { success: false, error: 'NEXT_PUBLIC_SITE_URL no configurado.' };
    }

    const redirectTo = `${redirectUrl}/auth/callback?next=/client/update-password`;

    // Method 1: inviteUserByEmail — same as original client creation flow
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { client_name: clientName },
        redirectTo
    });

    if (!inviteError) {
        console.log(`[invite-email] inviteUserByEmail succeeded for ${email}`);
        return { success: true };
    }

    console.warn(`[invite-email] inviteUserByEmail failed: ${inviteError.message}. Trying generateLink + Resend...`);

    // Method 2: generateLink + Resend — fallback for already-confirmed users
    if (!process.env.RESEND_API_KEY) {
        return { success: false, error: `inviteUserByEmail falló (${inviteError.message}) y RESEND_API_KEY no está configurada.` };
    }

    // Try invite type first, then recovery as last resort
    let actionLink: string | null = null;

    const { data: inviteLinkData, error: inviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
            data: { client_name: clientName },
            redirectTo
        }
    });

    if (!inviteLinkError && inviteLinkData?.properties?.action_link) {
        actionLink = inviteLinkData.properties.action_link;
    } else {
        console.warn(`[invite-email] generateLink invite failed: ${inviteLinkError?.message}. Trying recovery...`);

        const { data: recoveryData, error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: { redirectTo }
        });

        if (recoveryError || !recoveryData?.properties?.action_link) {
            return { success: false, error: `No se pudo generar ningún link: ${recoveryError?.message || 'sin action_link'}` };
        }

        actionLink = recoveryData.properties.action_link;
    }

    // Send via Resend with branded template
    return await sendViaResend(email, clientName, actionLink);
}

function generateInviteHtml(clientName: string, inviteLink: string): string {
    const siteUrl = getRedirectUrl() || '';
    const logoUrl = `${siteUrl}/logo.jpg`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitación — ${clientName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                    <!-- Accent bar -->
                    <tr>
                        <td style="background-color: #f43f5e; height: 4px; border-radius: 12px 12px 0 0; font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>

                    <!-- Header with logo -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 24px 32px; text-align: center;">
                            <img src="${logoUrl}" alt="AI-Mate" width="140" style="max-width: 140px; height: auto;" />
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 24px 32px 32px 32px;">
                            <h1 style="margin: 0 0 16px 0; font-size: 22px; color: #0f172a; font-weight: 700;">
                                Bienvenido al Dashboard de ${clientName}
                            </h1>
                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                                Has sido invitado a acceder al panel de métricas y ROI de <strong>${clientName}</strong>.
                                Haz clic en el botón de abajo para crear tu contraseña y acceder.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 16px 0 24px 0;">
                                        <a href="${inviteLink}"
                                           style="display: inline-block; background-color: #f43f5e; color: #ffffff;
                                                  font-size: 16px; font-weight: 600; text-decoration: none;
                                                  padding: 14px 32px; border-radius: 8px;">
                                            Crear contraseña y acceder
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                Si el botón no funciona, copia y pega este enlace en tu navegador:
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; word-break: break-all; line-height: 1.5;">
                                ${inviteLink}
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
                            <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                                Este email fue enviado automáticamente. Si no esperabas esta invitación, puedes ignorarlo.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function sendViaResend(
    email: string,
    clientName: string,
    inviteLink: string
): Promise<{ success: boolean; error?: string }> {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@ai-mate.es';
    const senderAddress = fromEmail.includes('<') ? fromEmail : `AI-Mate <${fromEmail}>`;

    const html = generateInviteHtml(clientName, inviteLink);

    const { error: sendError } = await resend.emails.send({
        from: senderAddress,
        to: email,
        subject: `Invitación al Dashboard — ${clientName}`,
        html,
    });

    if (sendError) {
        console.error('[invite-email] Resend error:', sendError);
        return { success: false, error: `Error enviando email: ${sendError.message}` };
    }

    console.log(`[invite-email] Sent via Resend to ${email} for client ${clientName}`);
    return { success: true };
}
