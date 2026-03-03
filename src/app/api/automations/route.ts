
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/require-admin';

// Get Service Role client (bypasses RLS for admin operations)
function getSupabaseAdmin() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

export async function POST(request: Request) {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const body = await request.json();
        const { client_id, name, manual_duration_minutes, cost_per_hour, expected_frequency, silence_threshold_hours } = body;

        if (!client_id || !name || manual_duration_minutes === undefined || cost_per_hour === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: client_id, name, manual_duration_minutes, cost_per_hour' },
                { status: 400 }
            );
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }

        const insertData: Record<string, unknown> = { client_id, name, manual_duration_minutes, cost_per_hour };
        if (expected_frequency) insertData.expected_frequency = expected_frequency;
        if (silence_threshold_hours !== undefined && silence_threshold_hours !== null) {
            insertData.silence_threshold_hours = silence_threshold_hours;
        }

        const { data, error } = await supabaseAdmin
            .from('automation_metadata')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error creating automation:', error);
            return NextResponse.json(
                { success: false, error: 'Error creando automatización.' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, automation: data });

    } catch (error) {
        console.error('Automation creation error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function GET() {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }

        const { data, error } = await supabaseAdmin
            .from('automation_metadata')
            .select(`
        id,
        name,
        manual_duration_minutes,
        cost_per_hour,
        expected_frequency,
        silence_threshold_hours,
        created_at,
        clients (id, name)
      `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error listing automations:', error);
            return NextResponse.json({ success: false, error: 'Error cargando automatizaciones.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, automations: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
