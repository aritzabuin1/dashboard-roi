
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createClient } from '@supabase/supabase-js';

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

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/[id]/key
 * Reveals the API key for a specific client
 * Requires admin authentication
 */
export async function GET(request: Request, { params }: RouteParams) {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;

    if (!id) {
        return NextResponse.json(
            { success: false, error: 'Client ID required' },
            { status: 400 }
        );
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Configuración de servidor incompleta.' }, { status: 500 });
        }
        const { data, error } = await supabaseAdmin
            .from('clients')
            .select('api_key')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { success: false, error: 'Client not found' },
                { status: 404 }
            );
        }

        // Log access for audit trail (optional)
        console.log(`[AUDIT] API Key revealed for client ${id}`);

        return NextResponse.json({
            success: true,
            api_key: data.api_key
        });

    } catch (error) {
        console.error('Error fetching API key:', error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
