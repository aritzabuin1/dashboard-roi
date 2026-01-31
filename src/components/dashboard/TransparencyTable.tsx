
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Execution {
    id: string
    automation_name: string
    timestamp: string
    status: 'success' | 'error'
}

interface TransparencyTableProps {
    executions: Execution[]
}

export function TransparencyTable({ executions }: TransparencyTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Últimas Ejecuciones</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Automatización</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Hora</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {executions.map((exec) => (
                            <TableRow key={exec.id}>
                                <TableCell className="font-medium">{exec.automation_name}</TableCell>
                                <TableCell>
                                    <Badge variant={exec.status === 'success' ? 'default' : 'destructive'} className={exec.status === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                        {exec.status === 'success' ? 'Completado' : 'Fallido'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {new Date(exec.timestamp).toLocaleTimeString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
