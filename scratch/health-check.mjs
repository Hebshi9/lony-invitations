import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const WABA_ID = process.env.META_WABA_ID || process.env.META_BUSINESS_ACCOUNT_ID;
const EVENT_ID = '049fbefa-18bd-489d-b38d-7502a186d444';

console.log('═══════════════════════════════════════════════');
console.log('  🔍 فحص شامل — Meta + النظام');
console.log('═══════════════════════════════════════════════');

// === 1. META QUOTA ===
console.log('\n🔷 1. حالة حساب Meta:');
try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=quality_rating,messaging_limit_tier,verified_name,display_phone_number`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    console.log(`  📱 الاسم: ${data.verified_name || 'N/A'}`);
    console.log(`  📞 الرقم: ${data.display_phone_number || 'N/A'}`);
    console.log(`  ⭐ جودة الحساب: ${data.quality_rating || 'N/A'}`);
    console.log(`  📊 حد الرسائل: ${data.messaging_limit_tier || 'N/A'}`);
    
    if (data.quality_rating === 'RED') console.log('  ⚠️ تحذير: جودة الحساب منخفضة!');
    else if (data.quality_rating === 'YELLOW') console.log('  ⚠️ تحذير: جودة الحساب متوسطة');
    else console.log('  ✅ جودة الحساب ممتازة');
} catch (e) {
    console.log('  ❌ فشل الاتصال بـ Meta:', e.message);
}

// === 2. WABA HEALTH ===
console.log('\n🔷 2. صحة حساب الأعمال (WABA):');
try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}?fields=account_review_status,message_template_count`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    console.log(`  📋 حالة المراجعة: ${data.account_review_status || 'N/A'}`);
    console.log(`  📝 عدد القوالب: ${data.message_template_count || 'N/A'}`);
} catch (e) {
    console.log('  ❌ فشل:', e.message);
}

// === 3. 24H SEND COUNT ===
console.log('\n🔷 3. إحصائيات الإرسال (آخر 24 ساعة):');
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count: last24h } = await supabase.from('whatsapp_messages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);
console.log(`  📤 رسائل آخر 24 ساعة: ${last24h || 0}`);

// === 4. EVENT STATUS ===
console.log('\n🔷 4. حالة الحدث:');
const { data: event } = await supabase.from('events')
    .select('campaign_status, campaign_progress, campaign_jitter_override')
    .eq('id', EVENT_ID).single();
console.log(`  🎯 حالة الحملة: ${event.campaign_status || 'idle'}`);
if (event.campaign_progress) {
    console.log(`  📊 التقدم: ${JSON.stringify(event.campaign_progress)}`);
}
if (event.campaign_jitter_override) {
    console.log(`  ⚠️ Jitter Override نشط: ${event.campaign_jitter_override}ms`);
}
if (event.campaign_status === 'sending') {
    console.log('  ⚠️ تحذير: الحملة لا تزال في حالة "إرسال" — قد تكون عالقة!');
}

// === 5. BRIDGING GUESTS ===
console.log('\n🔷 5. ضيوف عالقين (bridging/pending):');
const { data: bridging } = await supabase.from('guests')
    .select('name, phone, status, pending_marketing_data')
    .eq('event_id', EVENT_ID)
    .eq('status', 'bridging');
if (bridging && bridging.length > 0) {
    console.log(`  🌉 عدد العالقين في Bridge: ${bridging.length}`);
    for (const g of bridging) {
        console.log(`    - ${g.name} | ${g.phone} | has stash: ${!!g.pending_marketing_data}`);
    }
} else {
    console.log('  ✅ لا يوجد ضيوف عالقين في Bridge');
}

// === 6. FAILED MESSAGES (recent) ===
console.log('\n🔷 6. رسائل فاشلة حديثة:');
const { data: failedMsgs } = await supabase.from('whatsapp_messages')
    .select('guest_id, phone, error_message, delivery_status, created_at')
    .eq('event_id', EVENT_ID)
    .or('status.eq.failed,delivery_status.eq.failed')
    .order('created_at', { ascending: false })
    .limit(10);
if (failedMsgs && failedMsgs.length > 0) {
    console.log(`  ❌ عدد الرسائل الفاشلة: ${failedMsgs.length}`);
    for (const m of failedMsgs) {
        console.log(`    - ${m.phone} | ${m.error_message || 'بدون سبب'} | ${m.created_at}`);
    }
} else {
    console.log('  ✅ لا توجد رسائل فاشلة');
}

// === 7. STUCK GUESTS (sent but no delivery confirmation) ===
console.log('\n🔷 7. ضيوف حالتهم "sent" بدون تأكيد توصيل:');
const { data: stuckGuests } = await supabase.from('guests')
    .select('name, phone, status, rsvp_status')
    .eq('event_id', EVENT_ID)
    .eq('status', 'failed');
if (stuckGuests && stuckGuests.length > 0) {
    console.log(`  ⚠️ عدد الضيوف Failed: ${stuckGuests.length}`);
    for (const g of stuckGuests) {
        console.log(`    - ${g.name} | ${g.phone} | rsvp: ${g.rsvp_status}`);
    }
} else {
    console.log('  ✅ لا يوجد ضيوف في حالة فشل');
}

// === 8. TOKEN VALIDITY ===
console.log('\n🔷 8. صلاحية Token:');
try {
    const res = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${TOKEN}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const data = await res.json();
    const tokenData = data.data;
    if (tokenData) {
        const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at * 1000) : null;
        console.log(`  🔑 صالح: ${tokenData.is_valid ? '✅ نعم' : '❌ لا'}`);
        console.log(`  📅 ينتهي: ${expiresAt ? expiresAt.toLocaleDateString('ar-SA') : 'غير محدود (Permanent)'}`);
        console.log(`  👤 التطبيق: ${tokenData.application || 'N/A'}`);
    }
} catch (e) {
    console.log('  ❌ فشل فحص Token:', e.message);
}

console.log('\n═══════════════════════════════════════════════');
console.log('  🏁 انتهى الفحص');
console.log('═══════════════════════════════════════════════');
