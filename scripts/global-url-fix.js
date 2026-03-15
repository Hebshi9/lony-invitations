import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAndReplaceGlobal() {
    console.log('--- Deep cleaning old Netlify URLs ---');

    // 1. Check card_templates (stringified version)
    console.log('Checking card_templates...');
    const { data: templates } = await supabase.from('card_templates').select('id, name, canvas_data');
    if (templates) {
        for (const t of templates) {
            const strDump = JSON.stringify(t.canvas_data || {});
            if (strDump.includes('lonyinvite.netlify.app')) {
                console.log(`[!] Found in template: ${t.name}`);
                const updatedDump = strDump.replace(/lonyinvite\.netlify\.app/g, 'lonyinvit.netlify.app');
                await supabase.from('card_templates').update({ canvas_data: JSON.parse(updatedDump) }).eq('id', t.id);
                console.log(`--- Fixed template: ${t.name}`);
            }
        }
    }

    // 2. Check events
    console.log('Checking events...');
    const { data: events } = await supabase.from('events').select('id, name, features');
    if (events) {
        for (const e of events) {
            const strDump = JSON.stringify(e.features || {});
            if (strDump.includes('lonyinvite.netlify.app')) {
                console.log(`[!] Found in event: ${e.name}`);
                const updatedDump = strDump.replace(/lonyinvite\.netlify\.app/g, 'lonyinvit.netlify.app');
                await supabase.from('events').update({ features: JSON.parse(updatedDump) }).eq('id', e.id);
                console.log(`--- Fixed event: ${e.name}`);
            }
        }
    }

    console.log('✅ Done! All traces of lonyinvite are gone.');
}

findAndReplaceGlobal();
