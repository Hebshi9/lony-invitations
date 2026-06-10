import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841';

async function checkGuests() {
    console.log('🔍 Fetching guests and their messages...');
    const { data: guests, error } = await supabase
        .from('guests')
        .select(`*, whatsapp_messages(*)`)
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    console.log(`Total guests found for event: ${guests.length}`);
    
    // Let's filter guests who confirmed (rsvp_status === 'confirmed')
    const confirmed = guests.filter(g => g.rsvp_status === 'confirmed');
    console.log(`Confirmed guests: ${confirmed.length}`);

    // Let's filter guests who received a card (message_phase === 'qr_code' or similar in their messages)
    // Or guests who have card_image_url
    console.log('\n--- Confirmed Guests List (Last 30 updated) ---');
    const sortedConfirmed = [...confirmed].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    
    sortedConfirmed.slice(0, 30).forEach(g => {
        const qrMsg = g.whatsapp_messages?.filter(m => m.message_phase === 'qr_code' || m.message_text?.includes('بطاقة') || m.message_text?.includes('كرت'));
        const allMsg = g.whatsapp_messages || [];
        console.log(`\n👤 Name: ${g.name} | Phone: ${g.phone} | Status: ${g.status} | RSVP: ${g.rsvp_status}`);
        console.log(`   Card Image URL in DB: ${g.card_image_url || 'NULL'}`);
        console.log(`   Messages count: ${allMsg.length}`);
        allMsg.forEach(m => {
            console.log(`   - [${m.status}] Phase: ${m.message_phase} | Text: ${m.message_text} | Created: ${m.created_at}`);
            if (m.payload) {
                console.log(`     Payload: ${JSON.stringify(m.payload)}`);
            }
        });
    });
}

checkGuests();
