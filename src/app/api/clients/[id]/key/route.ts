
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { supabase } from '@/lib/supabase';

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
        const { data, error } = await supabase
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
