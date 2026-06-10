import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841';

async function auditMatches() {
    console.log('🔍 Fetching today\'s webhook logs...');
    // We want logs from today (2026-06-03)
    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .gte('created_at', '2026-06-03T00:00:00')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`Found ${logs.length} log entries from today.`);

    for (const log of logs) {
        const payload = log.payload;
        if (!payload) continue;

        // Check if this is a bridge action re-send log
        if (payload.bridge_action === 're_send_attempt_v2') {
            console.log(`\n🌉 [Bridge Re-send] Guest Name: ${payload.guest_name} | Phone: ${payload.phone} | Status: ${payload.status}`);
            continue;
        }

        const entry = payload.entry?.[0];
        const changes = entry?.changes?.[0]?.value;
        const messages = changes?.messages;

        if (messages && messages.length > 0) {
            const message = messages[0];
            const from = message.from; // WhatsApp sender phone number
            const contextId = message.context?.id;

            let btnText = '';
            if (message.type === 'button') {
                btnText = message.button?.text || message.button?.payload || '';
            } else if (message.interactive?.button_reply) {
                btnText = message.interactive.button_reply.title || message.interactive.button_reply.id || '';
            } else if (message.text) {
                btnText = message.text.body || '';
            }

            // Let's analyze if this is an RSVP action
            const isBridge = btnText.includes('التفاصيل') || btnText.includes('ارسل') || btnText.includes('أرسل');
            
            const cleanText = btnText.trim().replace(/[إأآا]/g, 'ا').replace(/[ىيئ]/g, 'ي').replace(/\s+/g, '');
            const confirmWords = ['تاكيدالحضور', 'ابشر', 'اكد', 'CONFIRM', 'ACCEPT', 'تاكيد', 'نعم', 'تم', 'ok', 'yes'];
            const declineWords = ['اعتذارعنالحضور', 'اعتذر', 'اعتذار', 'لااستطيع', 'اسف', 'DECLINE', 'NO', 'SORRY', 'لا'];
            
            const isConfirm = confirmWords.some(w => cleanText.includes(w) || cleanText.toUpperCase() === w);
            const isDecline = declineWords.some(w => cleanText.includes(w) || cleanText.toUpperCase() === w);

            if (isConfirm || isDecline) {
                const status = isConfirm ? 'confirmed' : 'declined';
                console.log(`\n📥 [RSVP Message] Sender: ${from} | Msg: "${btnText}" | ContextID: ${contextId || 'NONE'}`);

                // Perform the same matching logic as the webhook
                let targetGuestId = null;
                let matchMethod = '';

                // Phase 1: Context ID
                if (contextId) {
                    const { data: msgLog } = await supabase
                        .from('whatsapp_messages')
                        .select('guest_id, event_id')
                        .eq('evolution_message_id', contextId)
                        .maybeSingle();
                    if (msgLog) {
                        targetGuestId = msgLog.guest_id;
                        matchMethod = 'Phase 1: Context ID';
                    }
                }

                // Phase 2: Last invitation message
                const phoneSuffix = from.slice(-9);
                if (!targetGuestId) {
                    const { data: lastInviteMsg } = await supabase
                        .from('whatsapp_messages')
                        .select('guest_id, event_id')
                        .ilike('phone', `%${phoneSuffix}`)
                        .eq('message_phase', 'invitation')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastInviteMsg) {
                        targetGuestId = lastInviteMsg.guest_id;
                        matchMethod = 'Phase 2: Last Invite Message Suffix';
                    }
                }

                // Phase 3: Guest record suffix
                if (!targetGuestId) {
                    const { data: guestMatches } = await supabase
                        .from('guests')
                        .select('id, event_id, name, phone')
                        .ilike('phone', `%${phoneSuffix}`)
                        .order('created_at', { ascending: false })
                        .limit(10);
                    if (guestMatches && guestMatches.length > 0) {
                        targetGuestId = guestMatches[0].id;
                        matchMethod = 'Phase 3: Guest Record Phone Suffix';
                    }
                }

                if (targetGuestId) {
                    const { data: matchedGuest } = await supabase
                        .from('guests')
                        .select('id, name, phone, card_image_url')
                        .eq('id', targetGuestId)
                        .single();

                    if (matchedGuest) {
                        const matchedPhoneClean = matchedGuest.phone ? matchedGuest.phone.replace(/\D/g, '') : '';
                        const senderPhoneClean = from.replace(/\D/g, '');
                        const isNumberMismatch = !matchedPhoneClean.includes(senderPhoneClean) && !senderPhoneClean.includes(matchedPhoneClean);

                        console.log(`   🎯 Matched via [${matchMethod}]`);
                        console.log(`   Guest in DB: ${matchedGuest.name} | Phone: ${matchedGuest.phone}`);
                        console.log(`   Card URL: ${matchedGuest.card_image_url || 'NONE'}`);
                        
                        if (isNumberMismatch) {
                            console.log(`   🚨 MISMATCH DETECTED! Sender Phone: ${from} does not match Matched Guest Phone: ${matchedGuest.phone}`);
                        }
                    } else {
                        console.log(`   ⚠️ Guest ID ${targetGuestId} found in matching logic but record is missing in guests table.`);
                    }
                } else {
                    console.log(`   ❌ FAILED TO MATCH any guest for phone suffix: ${phoneSuffix}`);
                }
            }
        }
    }
}

auditMatches();
