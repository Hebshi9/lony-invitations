
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function createAdmin() {
    const email = 'admin@lony.com';
    const password = 'password123';

    console.log(`Creating user: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Admin User',
            }
        }
    });

    if (error) {
        if (error.message.includes('already registered')) {
            console.log('✅ User already exists! You can log in.');
            console.log(`Email: ${email}`);
            console.log(`Password: ${password}`);
        } else {
            console.error('Error creating user:', error.message);
        }
    } else {
        console.log('✅ User created successfully!');
        if (data.session) {
            console.log('Session active immediately (Email confirmation likely disabled).');
        } else {
            console.log('⚠️ Check your database or email confirmation settings if login fails.');
        }
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    }
}

createAdmin();
