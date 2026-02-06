
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixGuest() {
    console.log('--- Fixing Guest Data ---');

    const targetGuestId = 'e0122221-f942-485f-939d-e004151fcade';
    // URL copied from the debug log of the other guest
    const properCardUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7/1ae88131-e6ea-4f96-85b2-0fee990adf8a.jpg';

    // Update the guest
    const { data, error } = await supabase
        .from('guests')
        .update({
            card_image_url: properCardUrl,
            rsvp_status: null // Reset status so we can test "confirming" again
        })
        .eq('id', targetGuestId)
        .select();

    if (error) {
        console.error('Error updating guest:', error);
    } else {
        console.log('✅ Guest updated successfully!');
        console.log('New Data:', data);
    }
}

fixGuest();
