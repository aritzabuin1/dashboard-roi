
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(request: Request) {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    try {
        const body = await request.json();
        const { client_id, name, manual_duration_minutes, cost_per_hour } = body;

        if (!client_id || !name || manual_duration_minutes === undefined || cost_per_hour === undefined) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: client_id, name, manual_duration_minutes, cost_per_hour' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('automation_metadata')
            .insert({ client_id, name, manual_duration_minutes, cost_per_hour })
            .select()
            .single();

        if (error) {
            console.error('Error creating automation:', error);
            return NextResponse.json(
                { success: false, error: error.message },
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
        const { data, error } = await supabase
            .from('automation_metadata')
            .select(`
        id, 
        name, 
        manual_duration_minutes, 
        cost_per_hour, 
        created_at,
        clients (id, name)
      `)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, automations: data });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
