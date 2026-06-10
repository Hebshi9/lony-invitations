import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'a5931bed-8ae0-4881-9a6d-f55964859426';

async function run() {
    // Find a guest that hasn't been sent to recently
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentMsgs } = await supabase
        .from('whatsapp_messages')
        .select('guest_id')
        .eq('event_id', EVENT_ID)
        .gte('created_at', yesterday);

    const recentGuestIds = new Set((recentMsgs || []).map(m => m.guest_id));

    const { data: allGuests } = await supabase
        .from('guests')
        .select('id, name, phone')
        .eq('event_id', EVENT_ID)
        .limit(50);

    const unsent = (allGuests || []).filter(g => !recentGuestIds.has(g.id) && g.phone);
    
    console.log(`📊 Total guests: ${allGuests?.length}`);
    console.log(`📨 Recently sent: ${recentGuestIds.size}`);
    console.log(`🆕 Unsent (no msg in 24h): ${unsent.length}`);
    
    if (unsent.length > 0) {
        console.log(`\n🎯 First unsent guest for test:`);
        console.log(`   ID: ${unsent[0].id}`);
        console.log(`   Name: ${unsent[0].name}`);
        console.log(`   Phone: ${unsent[0].phone}`);
    }
}

run();
