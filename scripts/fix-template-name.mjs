import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function updateTemplate() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    console.log(`Updating event ${eventId} to use template: get_update`);
    
    const { error } = await supabase.from('events')
        .update({ template_name: 'get_update' })
        .eq('id', eventId);
    
    if (error) console.error('Error updating template:', error);
    else console.log('✅ Template updated to get_update successfully.');
}

updateTemplate();
