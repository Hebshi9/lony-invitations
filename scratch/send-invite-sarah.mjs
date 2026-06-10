import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const NEW_TOKEN = 'EAAV4hiaLibsBRn4mCPQ8sxJEyY5rXUaQ8xJhDuyBxVwkTnEx1ZArMK2YTZBuNROKsy0NBNUUUZBX77WrZAFfYMdMItbY7y5ESIwtS8KVwkpuhIq727wfmhC5biAWVuh6tbDkZAbNhFAc0yq0jZCCNebdZACCkZCOC76BzJZCa4Dwr4F7e0hIHZAI9rjdcPpVGJZAZBFEYrUPAYM2y5wDAk2REfWOgeEKrH6KvBQmufpbE6D36MOlFDG1TH3ZBWGB0PxyoCPuBr7ijZBuvFMOEiGOhEUsJaYITD';
const PHONE_ID = '1031606736708015';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const GUEST_ID = 'b6788ed5-ae00-44fe-aa96-a2414597e9f5'; // سارة

async function run() {
    // Get the stashed invitation payload
    const { data: guest } = await supabase.from('guests').select('pending_marketing_data, name, phone').eq('id', GUEST_ID).single();
    
    if (!guest?.pending_marketing_data) {
        console.log('❌ لا توجد دعوة معلقة لسارة');
        return;
    }

    console.log(`📤 إرسال الدعوة المعلقة لـ ${guest.name} (${guest.phone})...`);
    
    const payload = guest.pending_marketing_data;

    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NEW_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (res.ok) {
        await supabase.from('whatsapp_messages').insert({
            guest_id: GUEST_ID,
            event_id: 'e5c16571-e50c-4ff3-ab76-259813717c62',
            phone: guest.phone?.replace(/\D/g, '') || '966507240097',
            status: 'sent',
            delivery_status: 'sent',
            evolution_message_id: data.messages?.[0]?.id,
            message_phase: 'invitation',
            message_text: 'دعوة رسمية'
        });
        await supabase.from('guests').update({ status: 'sent', pending_marketing_data: null }).eq('id', GUEST_ID);
        console.log('✅ وصلت الدعوة لسارة! تحقق من جوالها.');
    } else {
        console.log('❌ فشل:', data.error?.message);
    }
}

run();
