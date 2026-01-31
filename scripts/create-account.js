import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function createAccount() {
    console.log('🔄 Creating account...\n');

    const email = 'projectju18@gmail.com';
    const password = 'hebshi12';

    try {
        // Create user in Supabase Auth
        const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                name: 'Main Admin'
            }
        });

        if (error) {
            console.error('❌ Error:', error.message);
            return;
        }

        console.log('✅ Account created successfully!');
        console.log('\n📧 Email:', email);
        console.log('🔑 Password:', password);
        console.log('👤 User ID:', data.user.id);
        console.log('\n🔗 Login at: https://lonyinvite.netlify.app');

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

createAccount();
