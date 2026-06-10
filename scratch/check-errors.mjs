import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const guestId = '9eb51a44-df41-4775-9c86-c3cc268e312a';
    console.log(`Fetching messages for guest ${guestId}...`);
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

run();
