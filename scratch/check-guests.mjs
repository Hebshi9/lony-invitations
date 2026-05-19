import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const eventId = '049fbefa-18bd-489d-b38d-7502a186d444';

const { data: allGuests } = await supabase.from('guests')
    .select('id, name, phone, status, rsvp_status, card_image_url')
    .eq('event_id', eventId)
    .order('name');

console.log('=== TOTAL GUESTS:', allGuests.length, '===');

const confirmed = allGuests.filter(g => g.rsvp_status === 'confirmed');
const declined = allGuests.filter(g => g.rsvp_status === 'declined');
const noResponse = allGuests.filter(g => !g.rsvp_status || g.rsvp_status === 'none' || g.rsvp_status === 'pending');
const failed = allGuests.filter(g => g.status === 'failed');

console.log('✅ Confirmed:', confirmed.length);
console.log('❌ Declined:', declined.length);
console.log('⏳ No Response:', noResponse.length);
console.log('💥 Failed:', failed.length);

console.log('\n=== NO RESPONSE LIST ===');
for (const g of noResponse) {
    console.log(`  - ${g.name} | phone: ${g.phone} | status: ${g.status} | rsvp: ${g.rsvp_status || 'null'}`);
}

console.log('\n=== FAILED LIST ===');
for (const g of failed) {
    console.log(`  - ${g.name} | phone: ${g.phone} | rsvp: ${g.rsvp_status || 'null'}`);
}

// Find Sarah and Fathiya
const sarah = allGuests.filter(g => g.name.includes('سار') || g.name.includes('صار'));
const fathiya = allGuests.filter(g => g.name.includes('فتحي') || g.name.includes('فاتحي'));

console.log('\n=== SARAH MATCHES ===');
for (const g of sarah) {
    console.log(`  - ${g.name} | phone: ${g.phone} | status: ${g.status} | rsvp: ${g.rsvp_status}`);
}

console.log('\n=== FATHIYA MATCHES ===');
for (const g of fathiya) {
    console.log(`  - ${g.name} | phone: ${g.phone} | status: ${g.status} | rsvp: ${g.rsvp_status}`);
}
