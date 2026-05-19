import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function findAhmedCard() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    console.log(`Searching for Ahmed in event ${eventId}...`);
    
    const { data, error } = await supabase.from('guests')
        .select('*')
        .eq('event_id', eventId)
        .ilike('name', '%احمد%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\nFound ${data.length} records for Ahmed:`);
    data.forEach(g => {
        console.log(`- ID: ${g.id} | Name: ${g.name} | Card URL: ${g.card_image_url || 'MISSING'}`);
    });
}

findAhmedCard();
