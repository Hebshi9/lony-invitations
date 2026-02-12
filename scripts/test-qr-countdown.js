
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function setupTest() {
    console.log('🚀 Setting up QR Countdown Local Test...');

    // 1. Create a Test Event
    const now = new Date();
    const start = new Date(now.getTime() + 15 * 1000); // 15 seconds from now
    const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
            name: 'تجربة العداد المحلي',
            date: now.toISOString().split('T')[0],
            location: 'الرياض',
            token: 'event-' + Math.random().toString(36).substring(7),
            qr_activation_enabled: true,
            qr_active_from: start.toISOString(),
            qr_active_until: end.toISOString()
        })
        .select()
        .single();

    if (eventError) {
        console.error('❌ Error creating event:', eventError);
        return;
    }
    console.log('✅ Created Test Event:', event.id);

    // 2. Create a Test Guest
    const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
            event_id: event.id,
            name: 'ضيف تجربة العداد',
            phone: '+966TEST' + Math.floor(Math.random() * 10000),
            qr_token: 'test-qr-' + Math.random().toString(36).substring(7),
            rsvp_status: 'confirmed'
        })
        .select()
        .single();

    if (guestError) {
        console.error('❌ Error creating guest:', guestError);
        return;
    }
    console.log('✅ Created Test Guest:', guest.name);

    const testUrl = `http://localhost:5173/v/${guest.qr_token}`;
    console.log('\n' + '='.repeat(50));
    console.log('👉 Open this URL in your browser:');
    console.log(testUrl);
    console.log('='.repeat(50));
    console.log('\n⏳ The countdown will expire in ~15 seconds.');
}

setupTest();
