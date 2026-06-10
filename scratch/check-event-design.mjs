import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841';

async function checkEventDesign() {
    const { data: event, error } = await supabase
        .from('events')
        .select('name, features, settings')
        .eq('id', EVENT_ID)
        .single();

    if (error) {
        console.error('Error fetching event:', error);
        return;
    }

    console.log('Event Name:', event.name);
    console.log('Settings:', JSON.stringify(event.settings, null, 2));
    console.log('\nFeatures:', JSON.stringify(event.features, null, 2));
}

checkEventDesign();
