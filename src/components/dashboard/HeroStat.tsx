
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Euro } from "lucide-react"

interface HeroStatProps {
    totalSaved: number
    currency?: string
}

export function HeroStat({ totalSaved, currency = "EUR" }: HeroStatProps) {
    // Format currency
    const formattedValue = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(totalSaved)

    return (
        <Card className="w-full bg-slate-900 text-white border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Euro size={120} />
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-slate-400 text-sm font-medium uppercase tracking-wider">
                    Dinero Total Ahorrado
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-6xl font-bold tracking-tighter">
                    {formattedValue}
                </div>
                <p className="text-slate-400 mt-2 text-sm">
                    Calculado en base a ejecuciones exitosas
                </p>
            </CardContent>
        </Card>
    )
}
