
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Zap, Activity } from "lucide-react"

interface MetricsGridProps {
    hoursSaved: number
    executionCount: number
    successRate: number
}

export function MetricsGrid({ hoursSaved, executionCount, successRate }: MetricsGridProps) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Horas Ahorradas</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{hoursSaved.toFixed(1)}h</div>
                    <p className="text-xs text-muted-foreground">
                        Tiempo manual liberado
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Ejecuciones</CardTitle>
                    <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{executionCount}</div>
                    <p className="text-xs text-muted-foreground">
                        Automatizaciones disparadas
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground">
                        Fiabilidad del sistema
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
