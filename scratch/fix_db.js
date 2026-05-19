/*
 * URGENT DATABASE FIX: Add campaign_status column (ESM Version)
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixDatabase() {
    console.log('🛠️ [URGENT] Attempting to add campaign_status column to events table...');
    
    // Attempting to add the column via RPC if available
    const { error } = await supabase.rpc('execute_sql', { 
        sql_query: "ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_status TEXT DEFAULT 'idle';" 
    });

    if (error) {
        console.error('❌ SQL RPC Failure:', error.message);
        console.log('⚠️ It seems the SQL RPC is not enabled. Manual intervention on Supabase dashboard might be needed if this continues.');
    } else {
        console.log('✅ Success! Column campaign_status is now active.');
    }
}

fixDatabase();
