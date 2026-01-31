import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function deleteAllWhatsAppAccounts() {
    console.log('🗑️ Deleting all WhatsApp accounts...\n');

    try {
        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }

        console.log('✅ All WhatsApp accounts deleted successfully!');
        console.log('\n💡 Now you can:');
        console.log('1. Refresh the page (F5)');
        console.log('2. Add a new account');
        console.log('3. Connect with QR code');
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

deleteAllWhatsAppAccounts();
