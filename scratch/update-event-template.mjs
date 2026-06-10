import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function updateEventTemplate() {
    const eventId = 'd3df674a-dab9-42bb-96bf-acc86b144b59';
    console.log(`Updating template_name for event ${eventId} to 'get_update'...`);
    const { data, error } = await supabase.from('events')
        .update({ template_name: 'get_update' })
        .eq('id', eventId)
        .select();

    if (error) {
        console.error('Update error:', error);
    } else {
        console.log('Update success:', data);
    }
}

updateEventTemplate();
