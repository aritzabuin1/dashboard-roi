
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';

// Rate limit config: 100 requests per minute per API key
const RATE_LIMIT_CONFIG = {
    maxRequests: 100,
    windowMs: 60 * 1000 // 1 minute
};

// Helper to validate API Key
async function getClientByApiKey(apiKey: string) {
    const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('api_key', apiKey)
        .single();

    if (error || !data) return null;
    return data;
}

// Helper to get or create Automation Metadata
async function getAutomationId(clientId: string, automationName: string) {
    // 1. Try to find existing
    const { data, error } = await supabase
        .from('automation_metadata')
        .select('id')
        .eq('client_id', clientId)
        .eq('name', automationName)
        .single();

    if (data) return data.id;

    // 2. Auto-create with 0 values so data isn't lost
    const { data: newData, error: createError } = await supabase
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
        const { api_key, automation_name, status, timestamp } = body;

        // 1. Validation
        if (!api_key || !automation_name || !status) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: api_key, automation_name, status' },
                { status: 400 }
            );
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
        const client = await getClientByApiKey(api_key);
        if (!client) {
            return NextResponse.json(
                { success: false, error: 'Invalid API Key' },
                { status: 401 }
            );
        }

        // 4. Automation Lookup/Create
        const automationId = await getAutomationId(client.id, automation_name);
        if (!automationId) {
            return NextResponse.json(
                { success: false, error: 'Failed to find or create automation metadata' },
                { status: 500 }
            );
        }

        // 5. Record Execution
        const { error: insertError } = await supabase
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
