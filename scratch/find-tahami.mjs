import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function run() {
    // Find الطحامي event
    const { data: events } = await supabase.from('events').select('id, name, settings, template_name, groom_name, bride_name, date, location, location_maps_url').ilike('name', '%طحامي%');
    
    if (!events || events.length === 0) {
        console.log("❌ لم يتم العثور على حدث الطحامي. البحث في كل الأحداث...");
        const { data: all } = await supabase.from('events').select('id, name').order('created_at', { ascending: false }).limit(15);
        all.forEach(e => console.log(`  - ${e.name} (${e.id})`));
        return;
    }

    const event = events[0];
    console.log(`📋 الحدث: ${event.name} (${event.id})`);
    console.log(`   العريس: ${event.groom_name || event.settings?.groom_name}`);
    console.log(`   العروس: ${event.bride_name || event.settings?.bride_name}`);
    console.log(`   التاريخ: ${event.date}`);
    console.log(`   Template: ${event.template_name}`);
    console.log(`   الصورة: ${event.settings?.global_invite_image_url?.substring(0, 60)}...`);

    // Find سارة
    const { data: sarahs } = await supabase.from('guests').select('id, name, phone, status')
        .eq('event_id', event.id)
        .ilike('name', '%سار%');

    console.log(`\n👩 ضيفات باسم "سارة":`);
    (sarahs || []).forEach(g => {
        console.log(`  - ${g.name} | ${g.phone} | Status: ${g.status} | ID: ${g.id}`);
    });

    // Count all guests
    const { count } = await supabase.from('guests').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
    console.log(`\n👥 إجمالي الضيوف: ${count}`);
}

run();
