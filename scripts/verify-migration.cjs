const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use SERVICE ROLE KEY to perform administrative tasks
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('--- Attempting to add missing columns to GUESTS table ---');
    
    // Note: This relies on a 'exec_sql' or similar RPC being present, 
    // or we can try to just run a dummy update to see if it works.
    
    const columns = [
        { name: 'last_message_status', type: 'text' },
        { name: 'last_error_message', type: 'text' }
    ];

    for (const col of columns) {
        console.log(`Checking column: ${col.name}`);
        const { error } = await supabase.from('guests').select(col.name).limit(1);
        
        if (error && error.code === '42703') { // Undefined Column
            console.log(`Column ${col.name} is missing. Trying to add it...`);
            // We can't easily run ALTER TABLE via the JS client unless there is an RPC.
            // But we can check if the user has a migration tool.
            console.error(`CRITICAL: Column ${col.name} is missing. Webhook will fail if we try to update it.`);
        } else {
            console.log(`Column ${col.name} exists or other error: ${error?.message || 'None'}`);
        }
    }
}

run();
