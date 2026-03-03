import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';

function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// GET — list active (unresolved) silence alerts
export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const { data, error } = await supabase
            .from('silence_alerts')
            .select(`
                id,
                detected_at,
                last_execution_at,
                threshold_hours,
                resolved,
                automation_metadata (id, name),
                clients (id, name)
            `)
            .eq('resolved', false)
            .order('detected_at', { ascending: false });

        if (error) {
            console.error('[silence-alerts] GET error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, alerts: data || [] });
    } catch (error) {
        console.error('[silence-alerts] Unexpected error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// POST — resolve/dismiss an alert
export async function POST(request: Request) {
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }

    try {
        const { alertId } = await request.json();

        if (!alertId) {
            return NextResponse.json({ success: false, error: 'alertId is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('silence_alerts')
            .update({ resolved: true })
            .eq('id', alertId);

        if (error) {
            console.error('[silence-alerts] POST error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[silence-alerts] Unexpected error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
