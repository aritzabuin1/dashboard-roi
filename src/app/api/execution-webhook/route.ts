
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit config: 100 requests per minute per API key
const RATE_LIMIT_CONFIG = {
    maxRequests: 100,
    windowMs: 60 * 1000 // 1 minute
};

// Admin Client (Service Role) - REQUIRED for bypassing RLS during webhook ingestion
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

// Helper to validate API Key
async function getClientByApiKey(supabaseAdmin: any, apiKey: string) {
    const { data, error } = await supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('api_key', apiKey)
        .single();

    if (error || !data) {
        // Debug: try to count all clients to see if DB is reachable
        const { data: allClients, error: countError } = await supabaseAdmin
            .from('clients')
            .select('id, api_key');
        console.error(`[webhook] Key lookup failed. error=${JSON.stringify(error)}, dbReachable=${!countError}, clientCount=${allClients?.length ?? 0}`);
        if (allClients?.length) {
            const keys = allClients.map((c: any) => `${c.api_key?.substring(0, 6)}...(len=${c.api_key?.length})`);
            console.error(`[webhook] Existing keys: ${JSON.stringify(keys)}, searched for: ${apiKey.substring(0, 6)}...(len=${apiKey.length})`);
        }
        return null;
    }
    return data;
}

// Helper to get or create Automation Metadata
async function getAutomationId(supabaseAdmin: any, clientId: string, automationName: string) {
    // 1. Try to find existing
    const { data, error } = await supabaseAdmin
        .from('automation_metadata')
        .select('id')
        .eq('client_id', clientId)
        .eq('name', automationName)
        .single();

    if (data) return data.id;

    // 2. Auto-create with 0 values so data isn't lost
    const { data: newData, error: createError } = await supabaseAdmin
        .from('automation_metadata')
        .insert({
            client_id: clientId,
            name: automationName,
            manual_duration_minutes: 0,
            cost_per_hour: 0
        })
        .select('id')
        .single();

    if (createError) {
        console.error("Error creating automation metadata:", createError);
        return null;
    }
    return newData.id;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { api_key: raw_api_key, automation_name, status, timestamp } = body;
        const api_key = typeof raw_api_key === 'string' ? raw_api_key.trim() : raw_api_key;

        // 1. Validation
        if (!api_key || !automation_name || !status) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: api_key, automation_name, status' },
                { status: 400 }
            );
        }

        // Initialize Admin Client
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Server configuration incomplete.' }, { status: 500 });
        }

        // 2. Rate Limiting (by API key)
        const rateLimitResult = rateLimit(`webhook:${api_key}`, RATE_LIMIT_CONFIG);
        if (!rateLimitResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Rate limit exceeded. Try again later.',
                    retryAfter: Math.ceil(rateLimitResult.resetIn / 1000)
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil(rateLimitResult.resetIn / 1000)),
                        'X-RateLimit-Remaining': '0'
                    }
                }
            );
        }

        // 3. Auth
        const client = await getClientByApiKey(supabaseAdmin, api_key);
        if (!client) {
            const keyPreview = typeof api_key === 'string'
                ? `${api_key.substring(0, 6)}...${api_key.substring(api_key.length - 4)} (len=${api_key.length})`
                : `type=${typeof api_key}`;
            console.error(`[webhook] Invalid API Key: ${keyPreview}`);
            return NextResponse.json(
                { success: false, error: 'Invalid API Key' },
                { status: 401 }
            );
        }

        // 4. Automation Lookup/Create
        const automationId = await getAutomationId(supabaseAdmin, client.id, automation_name);
        if (!automationId) {
            return NextResponse.json(
                { success: false, error: 'Failed to find or create automation metadata' },
                { status: 500 }
            );
        }

        // 5. Record Execution
        const { error: insertError } = await supabaseAdmin
            .from('executions')
            .insert({
                automation_id: automationId,
                status: status,
                execution_timestamp: timestamp || new Date().toISOString()
            });

        if (insertError) {
            console.error("Insert Error:", insertError);
            return NextResponse.json(
                { success: false, error: 'Failed to record execution' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Execution recorded',
            rateLimit: {
                remaining: rateLimitResult.remaining
            }
        });

    } catch (error) {
        console.error("Webhook Error:", error);
        return NextResponse.json(
            { success: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
