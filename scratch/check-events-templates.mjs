import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkEventsTemplates() {
    console.log('🔍 Checking events and their template names...');
    const { data: events, error } = await supabase.from('events')
        .select('id, name, template_name, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    events.forEach(e => {
        console.log(`Event ID: ${e.id} | Name: ${e.name} | Template Name: ${e.template_name} | Created At: ${e.created_at}`);
    });
}

checkEventsTemplates();
