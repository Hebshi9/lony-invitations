
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function updateMetaAccount() {
    console.log('Updating Meta Account with new Phone ID...');
    
    const { data, error } = await supabase
        .from('whatsapp_accounts')
        .upsert({
            id: 'meta-test-account',
            name: 'Meta Test Number',
            provider: 'meta',
            meta_phone_number_id: '1005931755944533',
            meta_waba_id: '965359251842838', // This is typical if not provided, usually on the same page
            is_active: true,
            invitation_template: 'lony_invite'
        }, { onConflict: 'id' });

    if (error) {
        console.error('Error updating account:', error);
    } else {
        console.log('Success! Meta Account linked in DB.');
    }
}

updateMetaAccount();
