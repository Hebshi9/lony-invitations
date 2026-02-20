
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkLogin() {
    const email = 'admin@lony.com';
    const passwords = ['password123', 'admin123', 'admin', '123456'];

    console.log(`Checking login for ${email}...`);

    for (const password of passwords) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (!error && data.user) {
            console.log(`✅ Success! valid credentials found:`);
            console.log(`Email: ${email}`);
            console.log(`Password: ${password}`);
            return;
        }
    }

    console.log('❌ Failed to find valid password for admin@lony.com among common defaults.');

    // Attempt to create if not exists
    console.log('Attempts to create a new user with password123...');
    const { data, error } = await supabase.auth.signUp({
        email,
        password: 'password123',
    });

    if (error) {
        console.log('Creation failed:', error.message);
    } else {
        console.log('✅ Created new user admin@lony.com with password123');
    }
}

checkLogin();
