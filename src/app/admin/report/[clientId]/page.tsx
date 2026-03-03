import { getReportData } from '@/lib/report-data';
import { isAdminAuthenticated } from '@/lib/auth-admin';
import { redirect } from 'next/navigation';
import { generateReportHtml } from './report-email-template';

interface Props {
    params: Promise<{ clientId: string }>;
    searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportPreviewPage({ params, searchParams }: Props) {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) redirect('/admin/login');

    const { clientId } = await params;
    const { from, to } = await searchParams;

    if (!from || !to) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Faltan parámetros</h1>
                    <p className="text-muted-foreground">Añade <code>?from=YYYY-MM-DD&to=YYYY-MM-DD</code> a la URL</p>
                </div>
            </div>
        );
    }

    const data = await getReportData(clientId, from, to);

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">Cliente no encontrado</h1>
                    <p className="text-muted-foreground">El ID de cliente proporcionado no existe.</p>
                </div>
            </div>
        );
    }

    const html = generateReportHtml(data);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-8">
            <div className="max-w-[640px] mx-auto">
                <div className="mb-4 text-center text-sm text-muted-foreground">
                    Vista previa del informe — Así se verá en el email del cliente
                </div>
                <div
                    className="shadow-lg rounded-xl overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
}
