
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const EVENT_ID = '74f3f17e-25a4-4996-9ba5-95edeb3901a3';

const mode = process.argv[2]; // 'future', 'past', 'active'

async function updateEvent() {
    const now = new Date();
    let updates = {};

    if (mode === 'future') {
        // Starts in 1 day
        const start = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
        const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);   // +2 days
        updates = {
            qr_activation_enabled: true,
            qr_active_from: start.toISOString(),
            qr_active_until: end.toISOString()
        };
        console.log('🕒 Setting event to FUTURE (Starts in 24h)');
    } else if (mode === 'past') {
        // Ended 1 day ago
        const start = new Date(now.getTime() - 48 * 60 * 60 * 1000); // -2 days
        const end = new Date(now.getTime() - 24 * 60 * 60 * 1000);   // -1 day
        updates = {
            qr_activation_enabled: true,
            qr_active_from: start.toISOString(),
            qr_active_until: end.toISOString()
        };
        console.log('🕒 Setting event to PAST (Ended 24h ago)');
    } else if (mode === 'active') {
        // Active now
        const start = new Date(now.getTime() - 1 * 60 * 60 * 1000); // -1 hour
        const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);  // +24 hours
        updates = {
            qr_activation_enabled: true,
            qr_active_from: start.toISOString(),
            qr_active_until: end.toISOString()
        };
        console.log('🕒 Setting event to ACTIVE (Started 1h ago)');
    } else {
        console.error('Invalid mode. Use: future, past, or active');
        return;
    }

    const { error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', EVENT_ID);

    if (error) console.error('Error:', error);
    else console.log('✅ Event updated successfully!');
}

updateEvent();
