import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { handler } from '../../../../Documents/New folder (3)/lony-invitations-frontend/netlify/functions/send-batch-v2.mjs';

dotenv.config({ path: '../../../../Documents/New folder (3)/lony-invitations-frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const PHONES = ['966503678789', '966507240097'];

async function runGraduationTest() {
    console.log('🔄 Updating Event settings for Graduation Test...');
    
    // Fetch current settings to preserve them
    const { data: event, error: evError } = await supabase
        .from('events')
        .select('*')
        .eq('id', EVENT_ID)
        .single();
        
    if (evError) {
        console.error('Error fetching event:', evError);
        return;
    }
    
    const newSettings = {
        ...(event.settings || {}),
        note: 'يوم الجمعة 12 يونيو الساعة 8م. يرجى إبراز بطاقة الدعوة.',
        family_name: 'تخرج أحمد وسارة'
    };
    
    const { error: updEventErr } = await supabase
        .from('events')
        .update({
            name: 'حفل تخرج أحمد وسارة',
            date: '2026-06-12',
            location: 'قاعة ليلتي بجدة',
            template_name: 'lony_generic',
            settings: newSettings
        })
        .eq('id', EVENT_ID);
        
    if (updEventErr) {
        console.error('Error updating event:', updEventErr);
        return;
    }
    console.log('✅ Event successfully updated with graduation details!');
    
    console.log('🔍 Preparing guests and updating names...');
    const guestIds = [];
    
    for (const phone of PHONES) {
        const { data: guests, error: qErr } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', EVENT_ID)
            .ilike('phone', `%${phone.slice(-9)}`);

        if (qErr) {
            console.error(`Error querying phone ${phone}:`, qErr);
            continue;
        }

        let guestId;
        const targetName = phone === '966503678789' ? 'أحمد' : 'سارة';
        
        if (guests && guests.length > 0) {
            const guest = guests[0];
            guestId = guest.id;
            console.log(`Updating guest name to "${targetName}" for phone ${phone}...`);
            await supabase
                .from('guests')
                .update({ 
                    name: targetName,
                    status: 'idle',
                    pending_marketing_data: null
                })
                .eq('id', guestId);
        } else {
            console.log(`Guest with phone ${phone} not found. Creating...`);
            const { data: newGuest, error: insErr } = await supabase
                .from('guests')
                .insert([{
                    event_id: EVENT_ID,
                    name: targetName,
                    phone: phone,
                    status: 'idle'
                }])
                .select();
            if (insErr) {
                console.error(`Failed to insert guest for ${phone}:`, insErr);
                continue;
            }
            guestId = newGuest[0].id;
        }
        guestIds.push(guestId);
    }

    if (guestIds.length === 0) {
        console.error('❌ No guests ready to receive the invite!');
        return;
    }

    console.log(`\n🚀 Sending direct Graduation template to ${guestIds.length} guests...`);
    const reqBody = {
        httpMethod: 'POST',
        body: JSON.stringify({
            eventId: EVENT_ID,
            guestIds: guestIds,
            campaignType: 'direct'
        })
    };

    try {
        const response = await handler(reqBody);
        console.log('\n--- NETLIFY HANDLER RESPONSE ---');
        console.log(`Status Code: ${response.statusCode}`);
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
    } catch (e) {
        console.error('❌ Error executing handler:', e);
    }
}

runGraduationTest();
