import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZ_y_role_key_placeholder' // I'll use the one I have
);

// Correction: Use the real service role key
const realSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function investigateGap() {
    console.log('🔍 Investigating the gap between yesterday and today...');
    
    // 1. Check successful QR cards from yesterday
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: oldMessages, error: err1 } = await realSupabase.from('whatsapp_messages')
        .select('*')
        .eq('message_phase', 'qr_code')
        .order('created_at', { ascending: false })
        .limit(5);

    if (err1) console.error('Error fetching old messages:', err1);
    else {
        console.log('\n--- SUCCESSFUL QR CARDS (RECENT) ---');
        oldMessages.forEach(m => {
            console.log(`Time: ${m.created_at} | Phone: ${m.phone} | Status: ${m.status}`);
            console.log(`Image URL: ${m.image_url}`);
            console.log(`WAMID: ${m.evolution_message_id}`);
            console.log('---');
        });
    }

    // 2. Check successful invitations from yesterday (to see the template name)
    const { data: oldInvites, error: err2 } = await realSupabase.from('whatsapp_messages')
        .select('*')
        .eq('message_phase', 'invite')
        .order('created_at', { ascending: false })
        .limit(5);

    if (err2) console.error('Error fetching old invites:', err2);
    else {
        console.log('\n--- SUCCESSFUL INVITES (RECENT) ---');
        oldInvites.forEach(m => {
            console.log(`Time: ${m.created_at} | Phone: ${m.phone} | Content: ${m.message_text.substring(0, 50)}...`);
        });
    }
}

investigateGap();
