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

async function fixEventsFeaturesDeep() {
    console.log('Fetching all events...');
    const { data: events, error } = await supabase.from('events').select('id, name, features');

    if (error) {
        console.error('Error fetching events:', error);
        return;
    }

    let updatedCount = 0;

    for (const event of events) {
        if (!event.features || !event.features.design_config || !Array.isArray(event.features.design_config.elements)) {
            continue;
        }

        let modified = false;
        // We must deeply clone or carefully map
        const newElements = event.features.design_config.elements.map(el => {
            // Must check if it's explicitly a qr type
            if (el.type === 'qr' && typeof el.qrUrl === 'string') {
                if (el.qrUrl.includes('lonyinvite.netlify.app')) {
                    console.log(`[DEEP FIX] Found old URL in event [${event.name}]`);
                    el.qrUrl = el.qrUrl.replace('lonyinvite.netlify.app', 'lonyinvit.netlify.app');
                    modified = true;
                }
            }
            return el;
        });

        if (modified) {
            console.log(`Saving update for event: ${event.name}`);
            const newFeatures = {
                ...event.features,
                design_config: {
                    ...event.features.design_config,
                    elements: newElements
                }
            };

            const { error: updateError } = await supabase
                .from('events')
                .update({ features: newFeatures })
                .eq('id', event.id);

            if (updateError) {
                console.error(`Failed to update event ${event.id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`✅ Finished checking events features. Updated ${updatedCount} events.`);
}

fixEventsFeaturesDeep();
