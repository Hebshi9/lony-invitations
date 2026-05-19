import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkEventFull() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
    
    if (error) {
        console.error('Error fetching event:', error);
        return;
    }
    
    console.log(`\n--- EVENT FULL DATA ---`);
    console.log(`ID: ${data.id}`);
    console.log(`Name: ${data.name}`);
    console.log(`Location: ${data.location}`);
    console.log(`Maps URL: ${data.location_maps_url}`);
    console.log(`Template: ${data.template_name}`);
    console.log(`Settings:`, JSON.stringify(data.settings, null, 2));
}

checkEventFull();
