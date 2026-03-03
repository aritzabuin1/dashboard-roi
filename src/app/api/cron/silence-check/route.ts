import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

const DEFAULT_THRESHOLDS: Record<string, number> = {
    daily: 26,
    weekly: 170,
};

export async function GET(request: Request) {
    // Verify cron secret (Vercel cron or manual trigger)
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const secret = authHeader?.replace('Bearer ', '') || searchParams.get('secret');

    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    try {
        // 1. Auto-resolve alerts whose automation has executed after detection
        const { data: unresolvedAlerts } = await supabase
            .from('silence_alerts')
            .select('id, automation_id, detected_at')
            .eq('resolved', false);

        if (unresolvedAlerts && unresolvedAlerts.length > 0) {
            for (const alert of unresolvedAlerts) {
                const { data: recentExec } = await supabase
                    .from('executions')
                    .select('execution_timestamp')
                    .eq('automation_id', alert.automation_id)
                    .gt('execution_timestamp', alert.detected_at)
                    .limit(1);

                if (recentExec && recentExec.length > 0) {
                    await supabase
                        .from('silence_alerts')
                        .update({ resolved: true })
                        .eq('id', alert.id);
                }
            }
        }

        // 2. Fetch automations with silence detection enabled
        const { data: automations, error: autoError } = await supabase
            .from('automation_metadata')
            .select('id, client_id, name, expected_frequency, silence_threshold_hours')
            .neq('expected_frequency', 'on_demand');

        if (autoError) {
            console.error('[silence-check] Error fetching automations:', autoError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!automations || automations.length === 0) {
            return NextResponse.json({ success: true, checked: 0, newAlerts: 0 });
        }

        let newAlerts = 0;

        for (const auto of automations) {
            const thresholdHours = auto.silence_threshold_hours
                ?? DEFAULT_THRESHOLDS[auto.expected_frequency]
                ?? null;

            if (!thresholdHours) continue;

            // Find the most recent execution
            const { data: lastExec } = await supabase
                .from('executions')
                .select('execution_timestamp')
                .eq('automation_id', auto.id)
                .order('execution_timestamp', { ascending: false })
                .limit(1);

            const lastExecTime = lastExec?.[0]?.execution_timestamp ?? null;
            const now = new Date();
            const thresholdMs = thresholdHours * 60 * 60 * 1000;

            let isSilent = false;
            if (!lastExecTime) {
                // Never executed — consider silent
                isSilent = true;
            } else {
                const elapsed = now.getTime() - new Date(lastExecTime).getTime();
                isSilent = elapsed > thresholdMs;
            }

            if (!isSilent) continue;

            // Check if there's already an unresolved alert for this automation
            const { data: existingAlert } = await supabase
                .from('silence_alerts')
                .select('id')
                .eq('automation_id', auto.id)
                .eq('resolved', false)
                .limit(1);

            if (existingAlert && existingAlert.length > 0) continue;

            // Insert new alert
            const { error: insertError } = await supabase
                .from('silence_alerts')
                .insert({
                    automation_id: auto.id,
                    client_id: auto.client_id,
                    last_execution_at: lastExecTime,
                    threshold_hours: thresholdHours,
                });

            if (insertError) {
                console.error('[silence-check] Error inserting alert:', insertError);
            } else {
                newAlerts++;
            }
        }

        return NextResponse.json({
            success: true,
            checked: automations.length,
            newAlerts,
        });
    } catch (error) {
        console.error('[silence-check] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
