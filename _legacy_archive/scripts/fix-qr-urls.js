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

async function fixTemplates() {
    console.log('Fetching all templates...');
    const { data, error } = await supabase.from('card_templates').select('*');

    if (error) {
        console.error('Error fetching templates:', error);
        return;
    }

    let updatedCount = 0;

    for (const template of data) {
        if (!template.canvas_data || !Array.isArray(template.canvas_data)) continue;

        let modified = false;
        const newCanvasData = template.canvas_data.map(el => {
            if (el.type === 'qr' && el.qrUrl) {
                // If it holds the old netlify url OR if it holds ANY url, we delete it 
                // so it falls back to the new default 'lonyinvit' automatically.
                if (el.qrUrl.includes('lonyinvite.netlify.app') || el.qrUrl.includes('lonyinvit.netlify.app')) {
                    console.log(`Found old URL in template ${template.name}, clearing it...`);
                    delete el.qrUrl;
                    modified = true;
                }
            }
            return el;
        });

        if (modified) {
            console.log(`Updating template: ${template.name}`);
            const { error: updateError } = await supabase
                .from('card_templates')
                .update({ canvas_data: newCanvasData })
                .eq('id', template.id);

            if (updateError) {
                console.error(`Failed to update template ${template.id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`✅ Finished checking. Updated ${updatedCount} templates.`);
    console.log(`The system will now use the new default lonyinvit.netlify.app link automatically!`);
}

fixTemplates();
