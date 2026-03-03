"use client"

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface SilenceAlert {
    id: string
    detected_at: string
    last_execution_at: string | null
    threshold_hours: number
    automation_metadata: { id: string; name: string }
    clients: { id: string; name: string }
}

export function SilenceAlertsBanner() {
    const [alerts, setAlerts] = useState<SilenceAlert[]>([])
    const [dismissing, setDismissing] = useState<string | null>(null)

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/silence-alerts')
            const data = await res.json()
            if (data.success) setAlerts(data.alerts || [])
        } catch {
            // silently ignore — banner just won't show
        }
    }, [])

    useEffect(() => {
        fetchAlerts()
    }, [fetchAlerts])

    async function handleDismiss(alertId: string) {
        setDismissing(alertId)
        try {
            const res = await fetch('/api/admin/silence-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId })
            })
            const data = await res.json()
            if (data.success) {
                setAlerts(prev => prev.filter(a => a.id !== alertId))
            }
        } catch {
            // ignore
        }
        setDismissing(null)
    }

    if (alerts.length === 0) return null

    return (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Alertas de silencio ({alerts.length})</span>
                <InfoTooltip text="Monitoriza automatizaciones que deberían ejecutarse con una frecuencia determinada. Si una automatización lleva más tiempo del esperado sin ejecutarse, aparecerá una alerta aquí." />
            </div>
            <div className="space-y-2">
                {alerts.map(alert => {
                    const lastExec = alert.last_execution_at
                        ? new Date(alert.last_execution_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'Nunca';
                    return (
                        <div key={alert.id} className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-md px-3 py-2 text-sm">
                            <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground">{alert.automation_metadata?.name}</span>
                                <span className="text-muted-foreground"> ({alert.clients?.name})</span>
                                <span className="text-muted-foreground block text-xs mt-0.5">
                                    Umbral: {alert.threshold_hours}h · Última ejecución: {lastExec}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDismiss(alert.id)}
                                disabled={dismissing === alert.id}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                                <span className="ml-1">Descartar</span>
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
