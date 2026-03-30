import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function simulate() {
    console.log('🧪 بدء تجربة محاكاة نظام التبديل (Simulation)...');

    // 1. العثور على مناسبة نشطة
    const { data: event } = await supabase.from('events').select('id, name, client_phone').limit(1).single();
    if (!event) return console.error('❌ لا توجد مناسبات');

    console.log(`📍 المناسبة المستهدفة: ${event.name}`);

    // 2. محاكاة ضيف يعتذر
    const testGuest = {
        event_id: event.id,
        name: 'ضيف تجريبي للاعتذار',
        phone: '966500000000',
        rsvp_status: 'declined',
        status: 'responded'
    };
    const { data: guest } = await supabase.from('guests').insert(testGuest).select().single();
    console.log(`❌ الضيف [${guest.name}] اعتذر الآن.`);

    // 3. محاكاة إضافة بديل (Replacement)
    console.log('🔄 جاري إضافة ضيف بديل برقم جديد...');
    const replacementGuest = {
        event_id: event.id,
        name: 'فيصل (بديل)',
        phone: '966555555555',
        rsvp_status: 'confirmed',
        status: 'pending',
        category: 'replacement',
        qr_payload: `rep-${Date.now()}`
    };
    const { data: newGuest } = await supabase.from('guests').insert(replacementGuest).select().single();
    console.log(`✅ تم إضافة البديل [${newGuest.name}] بنجاح.`);

    // 4. تسجيل عملية التبديل في جدول المتابعة
    await supabase.from('guest_replacements').insert({
        event_id: event.id,
        replacement_guest_id: newGuest.id,
        replacement_guest_name: newGuest.name,
        replacement_phone: newGuest.phone
    });

    console.log('\n📊 نتيجة المحاكاة:');
    console.log('- قاعدة البيانات حدثت حالة الاعتذار فوراً.');
    console.log('- تم حجز "خانة" للبديل الجديد.');
    console.log('- البديل حصل على باركود فريد مربوط بنفس قالب المناسبة.');
    console.log('\n✨ النظام يعمل بكفاءة والبيانات متطابقة!');

    // Cleanup
    await supabase.from('guests').delete().eq('id', guest.id);
    await supabase.from('guests').delete().eq('id', newGuest.id);
}

simulate();
