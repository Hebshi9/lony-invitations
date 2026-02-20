
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function generateToken() {
    return Math.random().toString(36).substr(2, 9);
}

async function createFutureEvent() {
    console.log('creating future event test...');

    const now = new Date();

    // Future Date: 1 Month from now
    const eventDate = new Date();
    eventDate.setDate(now.getDate() + 30);

    // Activation Window: Opens 30 days from now (so it is closed now)
    const activeFrom = new Date(eventDate);
    activeFrom.setHours(16, 0, 0, 0); // Opens at 4:00 PM on event day

    const activeUntil = new Date(eventDate);
    activeUntil.setDate(eventDate.getDate() + 1); // Open for 24 hours

    console.log(`Event Date set to: ${eventDate.toLocaleDateString()}`);
    console.log(`QR Activation set to: ${activeFrom.toLocaleString()} (Starts in 30 days)`);

    // 1. Create Event
    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
            name: 'حفل الزفاف المستقبلي (تجربة العداد)',
            date: eventDate.toISOString().split('T')[0],
            client_id: 'future-client',
            token: generateToken(),
            qr_activation_enabled: true,
            qr_active_from: activeFrom.toISOString(),
            qr_active_until: activeUntil.toISOString()
        })
        .select()
        .single();

    if (eventError) {
        console.error('Error creating event:', eventError);
        return;
    }

    // 2. Add Guests
    const guestsToAdd = [
        { name: 'محمد عبدالله (ضيف مستقبلي)', phone: '966500000001', companions_count: 0 },
        { name: 'خالد العنزي (ضيف مستقبلي)', phone: '966500000002', companions_count: 2 },
        { name: 'سارة الأحمد (ضيف مستقبلي)', phone: '966500000003', companions_count: 1 }
    ];

    for (const g of guestsToAdd) {
        const { data: guest } = await supabase.from('guests').insert({
            event_id: event.id,
            name: g.name,
            phone: g.phone,
            companions_count: g.companions_count,
            qr_payload: `future-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        }).select().single();

        console.log(`\n👤 الضيف: ${guest.name}`);
        console.log(`🔗 رابط البطاقة (عليه عداد): https://lonyinvite.netlify.app/check-in.html?token=${guest.qr_token}`);
    }

    console.log('\n------------------------------------------------');
    console.log('✅ تم إنشاء الحدث والضيوف بنجاح!');
    console.log('⚠️ ملاحظة: عند فتح الروابط أعلاه، يجب أن يظهر عداد تنازلي لمدة 30 يوماً تقريباً.');
}

createFutureEvent();
