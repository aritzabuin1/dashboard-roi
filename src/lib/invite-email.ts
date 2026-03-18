
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

/**
 * Sends an invitation email to a user using generateLink + Resend.
 * Works for both new and existing auth users.
 */
export async function sendInviteEmail(
    email: string,
    clientName: string
): Promise<{ success: boolean; error?: string }> {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
        return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY no configurada.' };
    }

    if (!process.env.RESEND_API_KEY) {
        return { success: false, error: 'RESEND_API_KEY no configurada.' };
    }

    const redirectUrl = getRedirectUrl();
    if (!redirectUrl) {
        return { success: false, error: 'NEXT_PUBLIC_SITE_URL no configurado.' };
    }

    // Generate invite link (works for both new and existing users)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
            data: { client_name: clientName },
            redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
        }
    });

    if (linkError) {
        console.error('[invite-email] generateLink error:', linkError.message);

        // If user already confirmed, try recovery link instead
        if (linkError.message.includes('already been registered') || linkError.message.includes('already confirmed')) {
            const { data: recoveryData, error: recoveryError } = await supabaseAdmin.auth.admin.generateLink({
                type: 'recovery',
                email,
                options: {
                    redirectTo: `${redirectUrl}/auth/callback?next=/client/update-password`
                }
            });

            if (recoveryError) {
                console.error('[invite-email] recovery link error:', recoveryError.message);
                return { success: false, error: `Error generando link: ${recoveryError.message}` };
            }

            // Build the email verification URL with token
            const actionLink = buildActionLink(recoveryData, redirectUrl);
            return await sendViaResend(email, clientName, actionLink);
        }

        return { success: false, error: `Error generando link: ${linkError.message}` };
    }

    const actionLink = buildActionLink(linkData, redirectUrl);
    return await sendViaResend(email, clientName, actionLink);
}

function buildActionLink(
    linkData: { properties: { action_link: string; hashed_token: string } },
    redirectUrl: string
): string {
    // The action_link from generateLink points to Supabase's verify endpoint
    // We need to route it through our auth callback
    const actionLink = linkData.properties.action_link;

    // If the action_link already contains the right redirect, use it directly
    if (actionLink) return actionLink;

    // Fallback: build manually from hashed_token
    return `${redirectUrl}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=invite&next=/client/update-password`;
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

    console.log(`[invite-email] Invite sent to ${email} for client ${clientName}`);
    return { success: true };
}
