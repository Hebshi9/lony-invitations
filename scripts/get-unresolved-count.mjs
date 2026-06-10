import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function getUnresolvedCount() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('rsvp_status, phone')
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error(error);
        return;
    }

    // Exclude test numbers
    const activeGuests = guests.filter(g => !g.phone.includes('96650000000'));

    const confirmed = activeGuests.filter(g => g.rsvp_status === 'confirmed').length;
    const declined = activeGuests.filter(g => g.rsvp_status === 'declined').length;
    const noResponse = activeGuests.filter(g => g.rsvp_status !== 'confirmed' && g.rsvp_status !== 'declined').length;

    console.log(`\n=============================================`);
    console.log(`📊 Final Event RSVP Statistics`);
    console.log(`=============================================`);
    console.log(`Total Active Guests: ${activeGuests.length}`);
    console.log(` تم التأكيد: ${confirmed}`);
    console.log(` المعتذرين: ${declined}`);
    console.log(` لم يردوا حتى الآن (المتبقي): ${noResponse}`);
    console.log(`=============================================\n`);
}

getUnresolvedCount();
