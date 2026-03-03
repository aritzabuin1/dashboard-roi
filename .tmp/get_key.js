const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1];
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase.from('clients').select('id, name, api_key').eq('name', 'Antigravity Demo').single();
    if (error) {
        console.error('Error fetching client:', error);
    } else {
        console.log('API Key raw:', JSON.stringify(data.api_key));
    }
}

run();
