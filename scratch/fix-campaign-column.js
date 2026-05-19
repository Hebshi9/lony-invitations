import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function addMissingColumn() {
    console.log("🔧 Adding missing campaign_status column to events table...");
    
    // Try using RPC if available, otherwise use REST API with raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: `ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_status text DEFAULT 'idle'` 
    });
    
    if (error) {
        console.log("RPC not available, trying direct REST...");
        console.log("Error:", error.message);
        console.log("\n⚠️ You need to run this SQL manually in Supabase Dashboard > SQL Editor:");
        console.log("ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_status text DEFAULT 'idle';");
    } else {
        console.log("✅ Column added successfully!");
    }
    
    // Test if column now exists
    const { data: testData, error: testError } = await supabase
        .from('events')
        .select('campaign_status')
        .limit(1);
    
    if (testError) {
        console.log("\n❌ Column still missing:", testError.message);
    } else {
        console.log("\n✅ Column exists and accessible:", testData);
    }
}

addMissingColumn();
