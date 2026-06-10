import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const guestId = 'd58eac57-066c-42d2-8a57-6e39709c0659';
    const { data: guest, error } = await supabase
        .from('guests')
        .select('id, name, event_id')
        .eq('id', guestId)
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Guest:', guest);
    }
}

run();
