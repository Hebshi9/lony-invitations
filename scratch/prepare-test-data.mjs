import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const PHONES = ['966503678789', '966507240097'];

async function prepare() {
    console.log('🔄 Fetching current event...');
    const { data: event, error: evFetchErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', EVENT_ID)
        .single();
        
    if (evFetchErr) {
        console.error('Error fetching event:', evFetchErr);
        return;
    }
    
    console.log('✅ Event loaded. Updating template name to "lony_generic" and adding a note in settings...');
    const newSettings = {
        ...(event.settings || {}),
        note: 'ملاحظة: الدخول بالبطاقة الشخصية للجميع. نسعد بحضوركم.'
    };
    
    const { error: evUpdErr } = await supabase
        .from('events')
        .update({
            template_name: 'lony_generic',
            settings: newSettings
        })
        .eq('id', EVENT_ID);
        
    if (evUpdErr) {
        console.error('Error updating event:', evUpdErr);
        return;
    }
    console.log('✅ Event updated successfully!');
    
    console.log('🔄 Resetting guest statuses and pending data for test phones...');
    for (const phone of PHONES) {
        const { data: guests, error: qErr } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', EVENT_ID)
            .ilike('phone', `%${phone.slice(-9)}`);
            
        if (qErr) {
            console.error(`Error querying guest ${phone}:`, qErr);
            continue;
        }
        
        if (guests && guests.length > 0) {
            const guest = guests[0];
            console.log(`Resetting Guest: ${guest.name} (${guest.phone})`);
            const { error: updErr } = await supabase
                .from('guests')
                .update({
                    status: 'idle',
                    pending_marketing_data: null
                })
                .eq('id', guest.id);
                
            if (updErr) {
                console.error(`Error resetting guest ${guest.name}:`, updErr);
            } else {
                console.log(`✅ Reset guest ${guest.name} to idle.`);
            }
        } else {
            console.log(`Guest with phone ${phone} does not exist. It will be created by the sender test script.`);
        }
    }
}

prepare();
