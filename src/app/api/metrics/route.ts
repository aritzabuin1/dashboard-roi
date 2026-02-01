
import { NextResponse } from 'next/server';
import { createClient as createSSRClient } from '@/lib/supabase-server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';

// Helper to get Service Role Client (for Admin)
function getServiceRoleClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const clientIdParam = searchParams.get('clientId');
        const range = searchParams.get('range') || '7d';

        // 1. Determine Context (Admin vs Client)
        let supabase;
        const adminAuth = await requireAdmin();

        if (adminAuth.authenticated) {
            // Case A: Admin. Use Service Role to see everything (or filtered by param).
            supabase = getServiceRoleClient();
        } else {
            // Case B: Client. Use SSR Client to respect RLS (only see own data).
            supabase = await createSSRClient();
        }

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

        // 2. Fetch Recent Executions
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

        // Apply Client Filter (if provided)
        // Note: For Clients, RLS enforces this implicitly. For Admin, we explicitly filter.
        if (clientIdParam && clientIdParam !== 'all') {
            // Filtering by related table requires a slightly different approach or !inner join implies filtering
            // recentQuery = recentQuery.eq('automation_metadata.client_id', clientIdParam); 
            // Supabase postgrest-js doesn't deeper filter easily on select w/o !inner.
            // Let's use !inner for filtering.
            recentQuery = supabase
                .from('executions')
                .select(`
                id,
                status,
                execution_timestamp,
                automation_id,
                automation_metadata!inner (
                    name,
                    manual_duration_minutes,
                    cost_per_hour,
                    client_id
                )
            `)
                .gte('execution_timestamp', startDateISO)
                .eq('automation_metadata.client_id', clientIdParam)
                .order('execution_timestamp', { ascending: false })
                .limit(20);
        }

        const { data: recentExecutions, error: recentError } = await recentQuery;

        if (recentError) {
            console.error('Metrics Error (Recent):', recentError);
            return NextResponse.json({ success: false, error: recentError.message }, { status: 500 });
        }


        // 3. Fetch All Executions for Stats (Aggregation)
        // We need !inner to ensure we get manual_duration_minutes etc.
        let statsQuery = supabase
            .from('executions')
            .select(`
                status,
                execution_timestamp,
                automation_metadata!inner (
                    manual_duration_minutes,
                    cost_per_hour,
                    client_id
                )
            `)
            .gte('execution_timestamp', startDateISO)
        // .eq('status', 'success'); // We fetch all to calc success rate too, or fetch success separately?
        // Original logic fetched ALL and filtered in JS. Let's do that for consistency if data volume allows.
        // Actually, better to filter status=success for savings and TOTAL for rate.
        // Let's fetch EVERYTHING in range and aggregate in JS to save DB calls.

        if (clientIdParam && clientIdParam !== 'all') {
            statsQuery = statsQuery.eq('automation_metadata.client_id', clientIdParam);
        }

        const { data: allExecutions, error: statsError } = await statsQuery;

        if (statsError) {
            console.error('Metrics Error (Stats):', statsError);
            return NextResponse.json({ success: false, error: statsError.message }, { status: 500 });
        }

        // 4. Calculate Metrics
        let totalSaved = 0;
        let hoursSaved = 0;
        const trendMap = new Map<string, number>();
        let successExecutions = 0;
        const totalExecutions = allExecutions?.length || 0;

        // Initialize trend map
        // (Simplified: just rely on data points or init 0s if strictly needed)
        // Let's init 0s for user experience
        for (let i = 0; i < numDays; i++) {
            // Logic to populate map keys... 
            // Simplification for reliability: Skip pre-populating map to avoid timezone complexity in this rewrite.
        }

        allExecutions?.forEach((exec: any) => {
            const meta = exec.automation_metadata;

            if (exec.status === 'success') {
                successExecutions++;
                if (meta) {
                    const durationHours = (meta.manual_duration_minutes || 0) / 60;
                    const costSaved = durationHours * (meta.cost_per_hour || 0);

                    totalSaved += costSaved;
                    hoursSaved += durationHours;

                    const dateKey = new Date(exec.execution_timestamp).toISOString().split('T')[0];
                    trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + costSaved);
                }
            }
        });

        const successRate = totalExecutions > 0 ? (successExecutions / totalExecutions) * 100 : 0;

        // 5. Format Trend Data
        let trendData = Array.from(trendMap.entries())
            .map(([date, savings]) => ({ date, savings }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // If map is empty (no executions), ensure we return at least empty array

        return NextResponse.json({
            totalSaved,
            hoursSaved,
            executionCount: totalExecutions,
            successRate,
            trendData,
            recentExecutions: recentExecutions?.map((e: any) => ({
                id: e.id,
                automation_name: e.automation_metadata?.name || 'Unknown',
                timestamp: e.execution_timestamp,
                status: e.status
            })) || []
        });

    } catch (error: any) {
        console.error('Metrics Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
