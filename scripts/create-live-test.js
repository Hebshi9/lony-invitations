
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function generateToken() {
    return Math.random().toString(36).substr(2, 9);
}

async function createLiveTest() {
    console.log('Creating Live Test Scenarios...');

    const now = new Date();

    // 1. Create Event (General)
    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
            name: 'تجربة حية - Live Test Scenarios',
            date: now.toISOString().split('T')[0],
            client_id: 'test-admin',
            token: generateToken(),  // Added token
            qr_activation_enabled: true,
            qr_active_from: new Date(now.getTime() - 3600000).toISOString(), // Started 1 hour ago
            qr_active_until: new Date(now.getTime() + 86400000).toISOString() // Ends tomorrow
        })
        .select()
        .single();

    if (eventError) {
        console.error('Error creating event:', eventError);
        return;
    }

    // SCENARIO 1: Countdown (Starts in 2 minutes)
    const startTime = new Date(now.getTime() + 120000); // +2 minutes
    const { data: eventCountdown, error: evCError } = await supabase
        .from('events')
        .insert({
            name: 'تجربة العد التنازلي',
            date: now.toISOString().split('T')[0],
            client_id: 'test-admin',
            token: generateToken(), // Added token
            qr_activation_enabled: true,
            qr_active_from: startTime.toISOString(),
            qr_active_until: new Date(now.getTime() + 86400000).toISOString()
        })
        .select()
        .single();

    if (evCError) { console.error('Error creating countdown event', evCError); return; }

    // Guest for Countdown
    const { data: guestCountdown, error: gcError } = await supabase.from('guests').insert({
        event_id: eventCountdown.id,
        name: 'ضيف الانتظار (Countdown)',
        qr_payload: 'test-countdown-' + Date.now(),
        companions_count: 0
    }).select().single();

    if (gcError) console.error('Guest Countdown Error:', gcError);

    // SCENARIO 2: Active & Fresh (Ready to scan)
    const { data: guestActive, error: gaError } = await supabase.from('guests').insert({
        event_id: event.id,
        name: 'ضيف جاهز للدخول (Active)',
        qr_payload: 'test-active-' + Date.now(),
        companions_count: 0
    }).select().single();

    if (gaError) console.error('Guest Active Error:', gaError);

    // SCENARIO 3: Already Scanned (Duplicate Check)
    const { data: guestUsed, error: guError } = await supabase.from('guests').insert({
        event_id: event.id,
        name: 'ضيف سبق له الدخول (Used)',
        qr_payload: 'test-used-' + Date.now(),
        companions_count: 0
    }).select().single();

    if (guError) console.error('Guest Used Error:', guError);

    if (guestUsed) {
        await supabase.from('scans').insert({
            event_id: event.id,
            guest_id: guestUsed.id,
            scanned_at: new Date().toISOString(),
            scan_result: 'success'
        });
    }

    // SCENARIO 4: Companions Limit (1 companion, scan once, try again)
    const { data: guestComp, error: gcoError } = await supabase.from('guests').insert({
        event_id: event.id,
        name: 'ضيف مع مرافق (1 remaining)',
        qr_payload: 'test-comp-' + Date.now(),
        companions_count: 1 // Total allowed = 2
    }).select().single();

    if (gcoError) console.error('Guest Comp Error:', gcoError);

    if (guestComp) {
        // Scan once
        await supabase.from('scans').insert({
            event_id: event.id,
            guest_id: guestComp.id,
            scanned_at: new Date().toISOString(),
            scan_result: 'success'
        });
    }

    console.log('\n--- 🧪 روابط التجربة الحية (Live Test Links) ---');

    if (guestCountdown) {
        console.log(`\n⏳ 1. تجربة العد التنازلي (يبدأ ${startTime.toLocaleTimeString()}):`);
        console.log(`🔗 https://lonyinvite.netlify.app/check-in.html?token=${guestCountdown.qr_token}`);
        console.log(`   (الرجاء فتح الرابط الآن لترى العداد، وسيفتح تلقائياً بعد دقيقتين)`);
    }

    if (guestActive) {
        console.log(`\n✅ 2. تجربة الدخول الناجح (لأول مرة):`);
        console.log(`🔗 https://lonyinvite.netlify.app/check-in.html?token=${guestActive.qr_token}`);
    }

    if (guestUsed) {
        console.log(`\n❌ 3. تجربة المنع (سبق الدخول):`);
        console.log(`🔗 https://lonyinvite.netlify.app/check-in.html?token=${guestUsed.qr_token}`);
    }

    if (guestComp) {
        console.log(`\n👥 4. تجربة المرافقين (متبقي 1 من 2):`);
        console.log(`🔗 https://lonyinvite.netlify.app/check-in.html?token=${guestComp.qr_token}`);
    }

    console.log('\n------------------------------------------------');
}

createLiveTest();
