import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { handler } from '../../../../Documents/New folder (3)/lony-invitations-frontend/netlify/functions/send-batch-v2.mjs';

dotenv.config({ path: '../../../../Documents/New folder (3)/lony-invitations-frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const PHONES = ['966503678789', '966507240097'];

async function runLocalCustomTest() {
    console.log('🔍 Locating target guests in database...');
    
    const guestIds = [];
    
    for (const phone of PHONES) {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', EVENT_ID)
            .ilike('phone', `%${phone.slice(-9)}`);

        if (error) {
            console.error(`Error querying phone ${phone}:`, error);
            continue;
        }

        if (guests && guests.length > 0) {
            console.log(`✅ Found Guest: ${guests[0].name} | Phone: ${guests[0].phone} | ID: ${guests[0].id}`);
            guestIds.push(guests[0].id);
        } else {
            console.log(`❌ Could not find guest with phone ${phone}. Creating mock guest for testing...`);
            const { data: newGuest, error: insErr } = await supabase.from('guests').insert([{
                event_id: EVENT_ID,
                name: phone === '966503678789' ? 'Lony Client Test' : 'Sarah Test',
                phone: phone,
                status: 'idle'
            }]).select();
            
            if (insErr) {
                console.error(`Failed to insert guest for ${phone}`, insErr);
            } else {
                console.log(`✅ Created Guest: ${newGuest[0].name} | ID: ${newGuest[0].id}`);
                guestIds.push(newGuest[0].id);
            }
        }
    }

    if (guestIds.length === 0) {
        console.error('❌ No guests available to test!');
        return;
    }

    // Call the Netlify handler directly with manual_bridge campaign type
    console.log(`\n🚀 Triggering send-batch-v2 handler for ${guestIds.length} guests in 'manual_bridge' mode...`);
    const reqBody = {
        httpMethod: 'POST',
        body: JSON.stringify({
            eventId: EVENT_ID,
            guestIds: guestIds,
            campaignType: 'manual_bridge'
        })
    };

    try {
        const response = await handler(reqBody);
        console.log('\n--- NETLIFY HANDLER RESPONSE ---');
        console.log(`Status Code: ${response.statusCode}`);
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
    } catch (e) {
        console.error('❌ Fatal error running handler:', e);
    }
}

runLocalCustomTest();
