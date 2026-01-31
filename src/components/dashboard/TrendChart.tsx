
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"

interface TrendChartProps {
    data: { date: string; savings: number }[]
    timeRange: '7d' | '30d' | '365d'
}

const TIME_LABELS = {
    '7d': 'Últimos 7 días',
    '30d': 'Último mes',
    '365d': 'Último año'
}

export function TrendChart({ data, timeRange }: TrendChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Ahorro Acumulado ({TIME_LABELS[timeRange]})</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[240px] w-full">
                    {data.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            Sin datos para el período seleccionado
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `€${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        borderRadius: '8px',
                                        border: 'none',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        backgroundColor: 'white'
                                    }}
                                    formatter={(value) => value !== undefined ? [`€${Number(value).toFixed(2)}`, 'Ahorro'] : ['', '']}
                                />
                                <Bar
                                    dataKey="savings"
                                    fill="#f43f5e"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
