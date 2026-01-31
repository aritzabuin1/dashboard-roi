
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const range = searchParams.get('range') || '7d';

        // Calculate date range
        const now = new Date();
        let startDate: Date;
        let numDays: number;

        switch (range) {
            case '30d':
                numDays = 30;
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '365d':
                numDays = 365;
                startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            default: // '7d'
                numDays = 7;
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const startDateISO = startDate.toISOString();

        // Build query for recent executions
        let recentQuery = supabase
            .from('executions')
            .select(`
        id,
        status,
        execution_timestamp,
        automation_id,
        automation_metadata (
          name,
          manual_duration_minutes,
          cost_per_hour,
          client_id
        )
      `)
            .gte('execution_timestamp', startDateISO)
            .order('execution_timestamp', { ascending: false })
            .limit(20);

        // Build query for all executions in range (for stats)
        let allQuery = supabase
            .from('executions')
            .select(`
        status,
        execution_timestamp,
        automation_metadata (
          manual_duration_minutes,
          cost_per_hour,
          client_id
        )
      `)
            .gte('execution_timestamp', startDateISO);

        const { data: recentExecutions, error: recentError } = await recentQuery;
        const { data: allExecutions, error: allError } = await allQuery;

        if (recentError || allError) {
            return NextResponse.json({
                success: false,
                error: recentError?.message || allError?.message || 'No data'
            }, { status: 500 });
        }

        // Filter by clientId if provided
        let filteredRecent = recentExecutions || [];
        let filteredAll = allExecutions || [];

        if (clientId && clientId !== 'all') {
            filteredRecent = filteredRecent.filter((e: any) =>
                e.automation_metadata?.client_id === clientId
            );
            filteredAll = filteredAll.filter((e: any) =>
                e.automation_metadata?.client_id === clientId
            );
        }

        // Calculate metrics
        let totalMoneySaved = 0;
        let totalMinutesSaved = 0;
        let successCount = 0;
        const totalExecutions = filteredAll.length;

        filteredAll.forEach((exec: any) => {
            if (exec.status === 'success') {
                const meta = exec.automation_metadata;
                if (meta) {
                    const minutes = meta.manual_duration_minutes || 0;
                    const rate = meta.cost_per_hour || 0;
                    const moneySaved = (minutes / 60) * rate;
                    totalMoneySaved += moneySaved;
                    totalMinutesSaved += minutes;
                    successCount++;
                }
            }
        });

        const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

        // Prepare Trend Data based on range
        let trendData: { date: string; savings: number }[] = [];

        if (range === '365d') {
            // Group by month for yearly view
            const months = Array.from({ length: 12 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (11 - i));
                return d.toISOString().slice(0, 7); // YYYY-MM
            });

            trendData = months.map(month => {
                const monthExecutions = filteredAll.filter((e: any) =>
                    e.status === 'success' &&
                    e.execution_timestamp.startsWith(month)
                );

                const savings = monthExecutions.reduce((acc: number, exec: any) => {
                    const meta = exec.automation_metadata;
                    const minutes = meta?.manual_duration_minutes || 0;
                    const rate = meta?.cost_per_hour || 0;
                    return acc + ((minutes / 60) * rate);
                }, 0);

                return {
                    date: new Date(month + '-01').toLocaleDateString('es-ES', { month: 'short' }),
                    savings: Math.round(savings * 100) / 100
                };
            });
        } else {
            // Group by day for weekly/monthly view
            const days = Array.from({ length: numDays }, (_, i) => {
                const d = new Date();
                d.setDate(now.getDate() - (numDays - 1 - i));
                return d.toISOString().split('T')[0];
            });

            // For monthly, show weekly aggregates
            if (range === '30d') {
                const weeks = [0, 7, 14, 21, 28].map(offset => {
                    const weekStart = new Date(now.getTime() - (28 - offset) * 24 * 60 * 60 * 1000);
                    return weekStart.toISOString().split('T')[0];
                });

                trendData = weeks.slice(0, 4).map((weekStart, i) => {
                    const weekEnd = weeks[i + 1] || now.toISOString().split('T')[0];
                    const weekExecutions = filteredAll.filter((e: any) =>
                        e.status === 'success' &&
                        e.execution_timestamp >= weekStart &&
                        e.execution_timestamp < weekEnd
                    );

                    const savings = weekExecutions.reduce((acc: number, exec: any) => {
                        const meta = exec.automation_metadata;
                        const minutes = meta?.manual_duration_minutes || 0;
                        const rate = meta?.cost_per_hour || 0;
                        return acc + ((minutes / 60) * rate);
                    }, 0);

                    return {
                        date: `Sem ${i + 1}`,
                        savings: Math.round(savings * 100) / 100
                    };
                });
            } else {
                // Daily for weekly
                trendData = days.map(date => {
                    const dayExecutions = filteredAll.filter((e: any) =>
                        e.status === 'success' &&
                        e.execution_timestamp.startsWith(date)
                    );

                    const savings = dayExecutions.reduce((acc: number, exec: any) => {
                        const meta = exec.automation_metadata;
                        const minutes = meta?.manual_duration_minutes || 0;
                        const rate = meta?.cost_per_hour || 0;
                        return acc + ((minutes / 60) * rate);
                    }, 0);

                    return {
                        date: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
                        savings: Math.round(savings * 100) / 100
                    };
                });
            }
        }

        // Format Recent Executions
        const recentFormatted = filteredRecent.slice(0, 10).map((exec: any) => ({
            id: exec.id,
            automation_name: exec.automation_metadata?.name || 'Unknown',
            timestamp: exec.execution_timestamp,
            status: exec.status
        }));

        return NextResponse.json({
            success: true,
            data: {
                totalSaved: Math.round(totalMoneySaved * 100) / 100,
                hoursSaved: Math.round((totalMinutesSaved / 60) * 100) / 100,
                executionCount: totalExecutions,
                successRate: Math.round(successRate * 10) / 10,
                trendData,
                recentExecutions: recentFormatted,
                isDemo: false
            }
        });

    } catch (error) {
        console.error('Metrics API Error:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
