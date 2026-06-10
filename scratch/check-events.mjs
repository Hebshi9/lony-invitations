import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🔍 Fetching events from database...");
    const { data: events, error } = await supabase
        .from('events')
        .select('id, name, created_at');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`📊 Found ${events.length} events:`);
    events.forEach(e => {
        console.log(`- ID: ${e.id} | Name: ${e.name} | Created: ${e.created_at}`);
    });
}

run();
