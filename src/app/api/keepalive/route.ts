
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Keepalive endpoint to prevent Supabase Free Tier from pausing
// Call this from an external cron service (e.g., cron-job.org, Vercel Cron, GitHub Actions)
// Recommended: Every 6 hours

export async function GET() {
    try {
        // Simple query to keep the database active
        const { count, error } = await supabase
            .from('executions')
            .select('id', { count: 'exact', head: true });

        if (error) {
            console.error('Keepalive error:', error);
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Database is alive',
            executionCount: count,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Keepalive error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}
