import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('clients').select('id, name, api_key').eq('name', 'Antigravity Demo').single();
    if (error) {
        console.error('Error fetching client:', error);
    } else {
        console.log('API Key for Antigravity Demo:', data.api_key);
    }
}

run();
