import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const EVENT_ID = '049fbefa-18bd-489d-b38d-7502a186d444';

const { data: guests } = await supabase.from('guests')
    .select('id, name, phone, status, rsvp_status, card_image_url, checked_in')
    .eq('event_id', EVENT_ID)
    .order('name');

const { data: messagesRaw } = await supabase.from('whatsapp_messages')
    .select('guest_id, status, delivery_status, message_phase, category, created_at, error_message')
    .eq('event_id', EVENT_ID)
    .limit(1000);
const messages = messagesRaw || [];

// === GUEST STATS ===
const total = guests.length;
const confirmed = guests.filter(g => g.rsvp_status === 'confirmed');
const declined = guests.filter(g => g.rsvp_status === 'declined');
const pending = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending' || g.rsvp_status === 'none');
const failed = guests.filter(g => g.status === 'failed');
const hasCard = guests.filter(g => g.card_image_url);
const checkedIn = guests.filter(g => g.checked_in);
const testGuests = guests.filter(g => g.phone.includes('000000'));

console.log('═══════════════════════════════════════════════');
console.log('  📊 تقرير حفل زفاف سلطان & وجدان');
console.log('  🕐 ' + new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }));
console.log('═══════════════════════════════════════════════');

console.log('\n📋 إحصائيات الضيوف:');
console.log(`  👥 إجمالي الضيوف:        ${total} (${total - testGuests.length} حقيقي + ${testGuests.length} عينة)`);
console.log(`  ✅ مؤكد الحضور:           ${confirmed.length}`);
console.log(`  ❌ معتذر:                 ${declined.length}`);
console.log(`  ⏳ لم يرد بعد:            ${pending.length - testGuests.length}`);
console.log(`  💥 فشل الإرسال:           ${failed.length}`);
console.log(`  🎫 لديه بطاقة دخول:       ${hasCard.length}`);
console.log(`  🚪 دخل الحفل:            ${checkedIn.length}`);

// Response rate
const realTotal = total - testGuests.length;
const responded = confirmed.length + declined.length;
const responseRate = realTotal > 0 ? Math.round((responded / realTotal) * 100) : 0;
console.log(`\n📈 نسبة الاستجابة: ${responseRate}% (${responded}/${realTotal})`);

// === MESSAGE STATS ===
const totalMsgs = messages.length;
const invitations = messages.filter(m => m.message_phase === 'invitation');
const qrCards = messages.filter(m => m.message_phase === 'qr_code');
const rsvpResponses = messages.filter(m => m.message_phase === 'rsvp_response');
const bridges = messages.filter(m => m.message_phase === 'bridge');
const delivered = messages.filter(m => m.delivery_status === 'delivered' || m.delivery_status === 'read');
const read = messages.filter(m => m.delivery_status === 'read');
const failedMsgs = messages.filter(m => m.status === 'failed' || m.delivery_status === 'failed');

console.log('\n📨 إحصائيات الرسائل:');
console.log(`  📩 إجمالي الرسائل:       ${totalMsgs}`);
console.log(`  💌 دعوات مرسلة:          ${invitations.length}`);
console.log(`  🎫 كروت QR مرسلة:        ${qrCards.length}`);
console.log(`  💬 ردود RSVP:            ${rsvpResponses.length}`);
console.log(`  🌉 جسر Bridge:           ${bridges.length}`);
console.log(`  📬 تم التوصيل:           ${delivered.length}`);
console.log(`  👀 تمت القراءة:           ${read.length}`);
console.log(`  ❌ رسائل فاشلة:          ${failedMsgs.length}`);

// === COST ESTIMATE ===
const marketingMsgs = messages.filter(m => m.category === 'marketing' && m.status !== 'failed').length;
const utilityMsgs = messages.filter(m => m.category === 'utility' && m.status !== 'failed').length;
const otherSent = totalMsgs - marketingMsgs - utilityMsgs - failedMsgs.length;
const estimatedCost = (marketingMsgs * 0.113) + (utilityMsgs * 0.038) + (otherSent * 0.05);
console.log('\n💰 التكلفة التقديرية:');
console.log(`  📊 Marketing: ${marketingMsgs} × 0.113 = ${(marketingMsgs * 0.113).toFixed(2)} SAR`);
console.log(`  📊 Utility: ${utilityMsgs} × 0.038 = ${(utilityMsgs * 0.038).toFixed(2)} SAR`);
console.log(`  📊 Other: ${otherSent}`);
console.log(`  💵 الإجمالي التقديري: ~${estimatedCost.toFixed(2)} SAR`);

// === CONFIRMED LIST ===
console.log('\n✅ قائمة المؤكدين (' + confirmed.length + '):');
for (const g of confirmed) {
    const card = g.card_image_url ? '🎫' : '⚠️ بدون كرت';
    console.log(`  ${card} ${g.name} | ${g.phone}`);
}

// === DECLINED LIST ===
console.log('\n❌ قائمة المعتذرين (' + declined.length + '):');
for (const g of declined) {
    console.log(`  - ${g.name} | ${g.phone}`);
}

// === FAILED ===
if (failed.length > 0) {
    console.log('\n💥 فشل الإرسال (' + failed.length + '):');
    for (const g of failed) {
        const lastErr = messages.filter(m => m.guest_id === g.id && m.status === 'failed').pop();
        console.log(`  - ${g.name} | ${g.phone} | السبب: ${lastErr?.error_message || 'غير معروف'}`);
    }
}

console.log('\n═══════════════════════════════════════════════');
