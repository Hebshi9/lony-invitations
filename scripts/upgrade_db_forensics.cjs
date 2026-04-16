require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function upgradeDB() {
  console.log('🛠️ STABLE DATABASE UPGRADE STARTING (FIXED VERSION)...');

  const sql = `
    ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_code TEXT;
    ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_message TEXT;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.log("RPC 'exec_sql' not found or failed. This is common in some Supabase setups.");
      console.log("------------------------------------------------------------------");
      console.log("IMPORTANT: Please copy and paste the following SQL in your Supabase SQL Editor:");
      console.log(sql.trim());
      console.log("------------------------------------------------------------------");
    } else {
      console.log("✅ Database upgraded successfully via RPC.");
    }
  } catch (err) {
    console.log("Connection error or missing RPC function.");
    console.log("------------------------------------------------------------------");
    console.log("IMPORTANT: Please copy and paste the following SQL in your Supabase SQL Editor:");
    console.log(sql.trim());
    console.log("------------------------------------------------------------------");
  }
}

upgradeDB();
