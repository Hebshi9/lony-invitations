import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findEvent() {
    console.log('🔍 Querying events matching names...');
    const { data: events, error } = await supabase
        .from('events')
        .select('*');
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    const matched = events.filter(e => {
        const groom = e.groom_name || '';
        const bride = e.bride_name || '';
        const name = e.name || '';
        const family = e.settings?.family_name || '';
        return groom.includes('عبدالرحمن') || bride.includes('اصايل') || groom.includes('أصايل') || bride.includes('أصايل') || name.includes('اصايل') || name.includes('عبدالرحمن') || name.includes('أصايل');
    });
    
    console.log(`Found ${matched.length} matching events:`);
    matched.forEach(e => {
        console.log(`\n🆔 ID: ${e.id}`);
        console.log(`💍 Name: ${e.name}`);
        console.log(`🤵 Groom: ${e.groom_name} | 👰 Bride: ${e.bride_name}`);
        console.log(`📅 Date: ${e.date}`);
    });
}

findEvent();
