import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841';

async function checkCardSimilarity() {
    console.log('🔍 Fetching guests who confirmed...');
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, card_image_url')
        .eq('event_id', EVENT_ID)
        .eq('rsvp_status', 'confirmed');

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    console.log(`Confirmed guests count: ${guests.length}`);

    const cardDetails = [];

    for (const guest of guests) {
        if (!guest.card_image_url) {
            console.log(`guest ${guest.name} has no card_image_url`);
            continue;
        }

        try {
            const res = await fetch(guest.card_image_url, { method: 'HEAD' });
            const contentLength = res.headers.get('content-length');
            const lastModified = res.headers.get('last-modified');
            cardDetails.push({
                name: guest.name,
                url: guest.card_image_url,
                size: contentLength,
                lastModified: lastModified
            });
            console.log(`Guest: ${guest.name} | Size: ${contentLength} bytes | Modified: ${lastModified}`);
        } catch (e) {
            console.error(`Failed to fetch headers for ${guest.name}:`, e.message);
        }
    }

    console.log('\n--- Duplicate Size Analysis ---');
    const sizeGroups = {};
    cardDetails.forEach(c => {
        if (!sizeGroups[c.size]) sizeGroups[c.size] = [];
        sizeGroups[c.size].push(c.name);
    });

    Object.keys(sizeGroups).forEach(size => {
        const names = sizeGroups[size];
        if (names.length > 1) {
            console.log(`⚠️ Warning: ${names.length} guests have the exact same card size (${size} bytes):`);
            console.log(`   Names: ${names.join(', ')}`);
        } else {
            console.log(`✅ Unique size (${size} bytes): ${names[0]}`);
        }
    });
}

checkCardSimilarity();
