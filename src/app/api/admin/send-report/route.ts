import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/require-admin';
import { getReportData } from '@/lib/report-data';
import { generateReportHtml } from '@/app/admin/report/[clientId]/report-email-template';

export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
            { success: false, error: 'RESEND_API_KEY no configurada en el servidor.' },
            { status: 500 }
        );
    }

    try {
        const { clientId, from, to } = await request.json();

        if (!clientId || !from || !to) {
            return NextResponse.json(
                { success: false, error: 'Faltan campos: clientId, from, to' },
                { status: 400 }
            );
        }

        const data = await getReportData(clientId, from, to);
        if (!data) {
            return NextResponse.json(
                { success: false, error: 'Cliente no encontrado o sin datos.' },
                { status: 404 }
            );
        }

        if (!data.clientEmail) {
            return NextResponse.json(
                { success: false, error: `El cliente "${data.clientName}" no tiene email. Ve a Supabase → Table Editor → clients → añade el email.` },
                { status: 400 }
            );
        }

        const html = generateReportHtml(data);

        const fromDate = new Date(from).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        const toDate = new Date(to).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

        const resend = new Resend(process.env.RESEND_API_KEY);

        // Ensure "Name <email>" format for Resend
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@ai-mate.es';
        const senderAddress = fromEmail.includes('<') ? fromEmail : `AI-Mate <${fromEmail}>`;

        const { data: sendData, error: sendError } = await resend.emails.send({
            from: senderAddress,
            to: data.clientEmail,
            subject: `Informe ROI — ${data.clientName} (${fromDate} - ${toDate})`,
            html,
        });

        console.log('[send-report] Resend response:', { sendData, sendError });

        if (sendError) {
            console.error('[send-report] Resend error:', sendError);
            return NextResponse.json(
                { success: false, error: sendError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, sentTo: data.clientEmail });
    } catch (error) {
        console.error('[send-report] Unexpected error:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor.' },
            { status: 500 }
        );
    }
}
