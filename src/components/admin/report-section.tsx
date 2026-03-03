"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { FileText, Send, ExternalLink } from 'lucide-react'

interface Client {
    id: string
    name: string
}

interface ReportSectionProps {
    clients: Client[]
}

export function ReportSection({ clients }: ReportSectionProps) {
    const [clientId, setClientId] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

    function handlePreview() {
        if (!clientId || !fromDate || !toDate) return
        window.open(`/admin/report/${clientId}?from=${fromDate}&to=${toDate}`, '_blank')
    }

    async function handleSend() {
        if (!clientId || !fromDate || !toDate) return
        setSending(true)
        setResult(null)
        try {
            const res = await fetch('/api/admin/send-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, from: fromDate, to: toDate })
            })
            const data = await res.json()
            if (data.success) {
                setResult({ type: 'success', message: `Informe enviado a ${data.sentTo}` })
            } else {
                setResult({ type: 'error', message: data.error || 'Error al enviar' })
            }
        } catch {
            setResult({ type: 'error', message: 'Error de conexión' })
        }
        setSending(false)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-1">
                    <FileText className="h-5 w-5" />
                    Informes ROI
                    <InfoTooltip text="Genera un informe visual del ROI de un cliente en un periodo concreto. Puedes previsualizarlo en el navegador o enviarlo directamente por email al cliente." />
                </CardTitle>
                <CardDescription>Genera y envía informes de ROI personalizados a tus clientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <select
                        className="border rounded-md p-2 bg-white dark:bg-slate-900"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                    >
                        <option value="">Seleccionar cliente</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        placeholder="Desde"
                    />
                    <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        placeholder="Hasta"
                    />
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handlePreview}
                            disabled={!clientId || !fromDate || !toDate}
                            className="flex-1"
                        >
                            <ExternalLink className="h-4 w-4 mr-1" /> Previsualizar
                        </Button>
                        <Button
                            onClick={handleSend}
                            disabled={!clientId || !fromDate || !toDate || sending}
                            className="flex-1"
                        >
                            <Send className="h-4 w-4 mr-1" /> {sending ? 'Enviando...' : 'Enviar'}
                        </Button>
                    </div>
                </div>
                {result && (
                    <div className={`p-3 rounded-lg text-sm ${
                        result.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    }`}>
                        {result.type === 'success' ? '✅' : '❌'} {result.message}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
