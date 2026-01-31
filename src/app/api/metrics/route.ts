
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');

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
            .order('execution_timestamp', { ascending: false })
            .limit(10);

        // Build query for all executions (for stats)
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
      `);

        const { data: recentExecutions, error: recentError } = await recentQuery;
        const { data: allExecutions, error: allError } = await allQuery;

        if (recentError || allError || !allExecutions) {
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

        // Prepare Trend Data (Last 7 days)
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const trendData = last7Days.map(date => {
            const dayExecutions = filteredAll.filter((e: any) =>
                e.status === 'success' &&
                new Date(e.execution_timestamp).toISOString().startsWith(date)
            );

            const checkSavings = dayExecutions.reduce((acc: number, exec: any) => {
                const meta = exec.automation_metadata;
                const minutes = meta?.manual_duration_minutes || 0;
                const rate = meta?.cost_per_hour || 0;
                return acc + ((minutes / 60) * rate);
            }, 0);

            return {
                date: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
                savings: Math.round(checkSavings * 100) / 100
            };
        });

        // Format Recent Executions
        const recentFormatted = filteredRecent.map((exec: any) => ({
            id: exec.id,
            automation_name: exec.automation_metadata?.name || 'Unknown',
            timestamp: exec.execution_timestamp,
            status: exec.status
        }));

        return NextResponse.json({
            success: true,
            data: {
                totalSaved: totalMoneySaved,
                hoursSaved: totalMinutesSaved / 60,
                executionCount: totalExecutions,
                successRate,
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
