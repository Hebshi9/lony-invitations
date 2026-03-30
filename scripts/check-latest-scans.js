import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestScans() {
    console.log("Fetching latest scans...");
    const { data: scans, error: scanError } = await supabase
        .from('scans')
        .select(`
            id,
            scanned_at,
            guest_id,
            guests (
                name,
                companions_count,
                companions_attended,
                events (
                    name,
                    features,
                    host_pin
                )
            )
        `)
        .order('scanned_at', { ascending: false })
        .limit(10);
        
    if (scanError) {
        console.log("Select Error:", scanError);
    } else {
        console.log("Scans:", JSON.stringify(scans, null, 2));
    }
}

checkLatestScans();
