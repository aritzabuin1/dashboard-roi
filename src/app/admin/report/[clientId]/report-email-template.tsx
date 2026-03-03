import type { ReportData } from '@/lib/report-data';

export function generateReportHtml(data: ReportData): string {
    const maxDailySaved = Math.max(...data.dailyTrend.map(d => d.moneySaved), 1);

    const automationRows = data.automationBreakdown.map(a => `
        <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">${a.name}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; text-align: center;">${a.executions}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; text-align: center;">${a.hoursSaved.toFixed(1)}h</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; text-align: right; font-weight: 600;">${a.moneySaved.toFixed(2)}</td>
        </tr>
    `).join('');

    const trendRows = data.dailyTrend.map(d => {
        const pct = Math.round((d.moneySaved / maxDailySaved) * 100);
        const dateLabel = new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return `
        <tr>
            <td style="padding: 6px 12px; font-size: 13px; color: #64748b; white-space: nowrap; width: 80px;">${dateLabel}</td>
            <td style="padding: 6px 12px; width: 100%;">
                <div style="background: #fecdd3; border-radius: 4px; height: 20px; width: 100%; position: relative;">
                    <div style="background: #f43f5e; border-radius: 4px; height: 20px; width: ${pct}%; min-width: ${pct > 0 ? '4px' : '0'};"></div>
                </div>
            </td>
            <td style="padding: 6px 12px; font-size: 13px; color: #334155; text-align: right; white-space: nowrap; font-weight: 500;">${d.moneySaved.toFixed(2)}</td>
        </tr>
        `;
    }).join('');

    const fromDate = new Date(data.from).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const toDate = new Date(data.to).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const generatedDate = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informe ROI - ${data.clientName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9;">
        <tr>
            <td align="center" style="padding: 32px 16px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

                    <!-- Header -->
                    <tr>
                        <td style="background-color: #0f172a; padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
                            <div style="color: #f43f5e; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">AI mate</div>
                            <div style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Informe de ROI</div>
                            <div style="color: #ffffff; font-size: 18px; font-weight: 600; margin-top: 12px;">${data.clientName}</div>
                            <div style="color: #94a3b8; font-size: 13px; margin-top: 4px;">${fromDate} &mdash; ${toDate}</div>
                        </td>
                    </tr>

                    <!-- Metrics -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 0;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 24px; text-align: center; width: 25%; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 24px; font-weight: 700; color: #f43f5e;">${data.totalSaved.toFixed(2)}&euro;</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Dinero ahorrado</div>
                                    </td>
                                    <td style="padding: 24px; text-align: center; width: 25%; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${data.hoursSaved.toFixed(1)}h</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Horas ahorradas</div>
                                    </td>
                                    <td style="padding: 24px; text-align: center; width: 25%; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${data.executionCount}</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Ejecuciones</div>
                                    </td>
                                    <td style="padding: 24px; text-align: center; width: 25%; border-bottom: 1px solid #e2e8f0;">
                                        <div style="font-size: 24px; font-weight: 700; color: #0f172a;">${data.successRate}%</div>
                                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Tasa de &eacute;xito</div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Automation Breakdown -->
                    <tr>
                        <td style="background-color: #ffffff; padding: 24px 24px 8px;">
                            <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #0f172a;">Desglose por automatizaci&oacute;n</h2>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: separate;">
                                <tr style="background-color: #f8fafc;">
                                    <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">Nombre</th>
                                    <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Ejecuciones</th>
                                    <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Horas</th>
                                    <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #64748b; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">&euro;</th>
                                </tr>
                                ${automationRows}
                            </table>
                        </td>
                    </tr>

                    <!-- Daily Trend -->
                    ${data.dailyTrend.length > 0 ? `
                    <tr>
                        <td style="background-color: #ffffff; padding: 24px;">
                            <h2 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #0f172a;">Tendencia diaria (&euro;)</h2>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                ${trendRows}
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <div style="font-size: 12px; color: #94a3b8;">Generado por AI-Mate &middot; ${generatedDate}</div>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
