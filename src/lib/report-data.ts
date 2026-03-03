import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export interface AutomationBreakdown {
    name: string;
    executions: number;
    hoursSaved: number;
    moneySaved: number;
}

export interface DailyTrend {
    date: string;
    executions: number;
    moneySaved: number;
}

export interface ReportData {
    clientName: string;
    clientEmail: string | null;
    from: string;
    to: string;
    totalSaved: number;
    hoursSaved: number;
    executionCount: number;
    successRate: number;
    automationBreakdown: AutomationBreakdown[];
    dailyTrend: DailyTrend[];
}

export async function getReportData(clientId: string, from: string, to: string): Promise<ReportData | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    // Fetch client info
    const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('name, email')
        .eq('id', clientId)
        .single();

    if (clientError || !client) return null;

    // Fetch all executions in the date range for this client's automations
    const { data: automations } = await supabase
        .from('automation_metadata')
        .select('id, name, manual_duration_minutes, cost_per_hour')
        .eq('client_id', clientId);

    if (!automations || automations.length === 0) {
        return {
            clientName: client.name,
            clientEmail: client.email ?? null,
            from,
            to,
            totalSaved: 0,
            hoursSaved: 0,
            executionCount: 0,
            successRate: 0,
            automationBreakdown: [],
            dailyTrend: [],
        };
    }

    const automationIds = automations.map(a => a.id);

    const { data: executions } = await supabase
        .from('executions')
        .select('automation_id, status, execution_timestamp')
        .in('automation_id', automationIds)
        .gte('execution_timestamp', from)
        .lte('execution_timestamp', to + 'T23:59:59.999Z')
        .order('execution_timestamp', { ascending: true });

    if (!executions || executions.length === 0) {
        return {
            clientName: client.name,
            clientEmail: client.email ?? null,
            from,
            to,
            totalSaved: 0,
            hoursSaved: 0,
            executionCount: 0,
            successRate: 0,
            automationBreakdown: [],
            dailyTrend: [],
        };
    }

    // Build a lookup for automation metadata
    const autoMap = new Map(automations.map(a => [a.id, a]));

    // Calculate metrics
    let totalSaved = 0;
    let totalHours = 0;
    let successCount = 0;
    const breakdownMap = new Map<string, AutomationBreakdown>();
    const dailyMap = new Map<string, DailyTrend>();

    for (const exec of executions) {
        const meta = autoMap.get(exec.automation_id);
        if (!meta) continue;

        const isSuccess = exec.status === 'success';
        if (isSuccess) successCount++;

        const minutes = isSuccess ? (meta.manual_duration_minutes || 0) : 0;
        const rate = meta.cost_per_hour || 0;
        const saved = (minutes / 60) * rate;
        const hours = minutes / 60;

        totalSaved += saved;
        totalHours += hours;

        // Automation breakdown
        const existing = breakdownMap.get(meta.name) || { name: meta.name, executions: 0, hoursSaved: 0, moneySaved: 0 };
        existing.executions++;
        if (isSuccess) {
            existing.hoursSaved += hours;
            existing.moneySaved += saved;
        }
        breakdownMap.set(meta.name, existing);

        // Daily trend
        const day = exec.execution_timestamp.split('T')[0];
        const dayData = dailyMap.get(day) || { date: day, executions: 0, moneySaved: 0 };
        dayData.executions++;
        if (isSuccess) dayData.moneySaved += saved;
        dailyMap.set(day, dayData);
    }

    const successRate = executions.length > 0 ? (successCount / executions.length) * 100 : 0;

    return {
        clientName: client.name,
        clientEmail: client.email ?? null,
        from,
        to,
        totalSaved: Math.round(totalSaved * 100) / 100,
        hoursSaved: Math.round(totalHours * 100) / 100,
        executionCount: executions.length,
        successRate: Math.round(successRate * 10) / 10,
        automationBreakdown: Array.from(breakdownMap.values()).sort((a, b) => b.moneySaved - a.moneySaved),
        dailyTrend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
}
