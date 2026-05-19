import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function findAnyCard() {
    console.log('Searching for any guest with a card_image_url...');
    const { data, error } = await supabase.from('guests')
        .select('id, name, card_image_url, card_url')
        .not('card_image_url', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('\n✅ Found guests with cards:');
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('No guests found with card_image_url. Checking card_url...');
        const { data: data2 } = await supabase.from('guests')
            .select('id, name, card_url')
            .not('card_url', 'is', null)
            .limit(5);
        
        if (data2 && data2.length > 0) {
            console.log('\n✅ Found guests with card_url:');
            console.log(JSON.stringify(data2, null, 2));
        } else {
            console.log('Still nothing. The cards might be in a different table or stored differently.');
        }
    }
}

findAnyCard();
