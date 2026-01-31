
import { supabase } from '@/lib/supabase'

// Empty state when no data is available
const EMPTY_STATE = {
    totalSaved: 0,
    hoursSaved: 0,
    executionCount: 0,
    successRate: 0,
    trendData: [],
    recentExecutions: [],
    isDemo: false
};

export async function getDashboardMetrics() {
    try {
        // 1. Fetch Executions
        const { data: executions, error } = await supabase
            .from('executions')
            .select(`
                id,
                status,
                execution_timestamp,
                automation_id,
                automation_metadata (
                    name,
                    manual_duration_minutes,
                    cost_per_hour
                )
            `)
            .order('execution_timestamp', { ascending: false })
            .limit(10);

        // For precise stats, we might need a separate query or aggregation.
        // Aggregation Query for Totals
        const { data: allExecutions, error: allError } = await supabase
            .from('executions')
            .select(`
                status,
                execution_timestamp,
                automation_metadata (
                    manual_duration_minutes,
                    cost_per_hour
                )
            `);

        // If tables don't exist or no data, return empty state
        if (error || allError || !allExecutions || allExecutions.length === 0) {
            console.log('No data found. Reason:', error?.message || allError?.message || 'Empty database');
            return EMPTY_STATE;
        }

        // 2. Calculate Metrics
        let totalMoneySaved = 0;
        let totalMinutesSaved = 0;
        let successCount = 0;
        const totalExecutions = allExecutions.length;

        allExecutions.forEach((exec) => {
            if (exec.status === 'success') {
                const meta = exec.automation_metadata as any;
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

        // 3. Prepare Trend Data (Last 7 days)
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const trendData = last7Days.map(date => {
            const dayExecutions = allExecutions.filter(e =>
                e.status === 'success' &&
                new Date(e.execution_timestamp).toISOString().startsWith(date)
            );

            const checkSavings = dayExecutions.reduce((acc, exec) => {
                const meta = exec.automation_metadata as any;
                const minutes = meta?.manual_duration_minutes || 0;
                const rate = meta?.cost_per_hour || 0;
                return acc + ((minutes / 60) * rate);
            }, 0);

            return {
                date: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
                savings: Math.round(checkSavings * 100) / 100
            };
        });

        // 4. Format Recent Executions
        const recentExecutions = (executions || []).map((exec: any) => ({
            id: exec.id,
            automation_name: exec.automation_metadata?.name || 'Unknown',
            timestamp: exec.execution_timestamp,
            status: exec.status
        }));

        return {
            totalSaved: totalMoneySaved,
            hoursSaved: totalMinutesSaved / 60,
            executionCount: totalExecutions,
            successRate,
            trendData,
            recentExecutions,
            isDemo: false
        };
    } catch (err) {
        console.error('Unexpected error in getDashboardMetrics:', err);
        return EMPTY_STATE;
    }
}
