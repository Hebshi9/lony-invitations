import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function createTestUser() {
    console.log('🔐 Creating test user...\n');

    const email = 'admin@lony.com';
    const password = 'admin123';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: 'http://localhost:5174'
            }
        });

        if (error) {
            console.error('❌ Error:', error.message);

            // Try to sign in instead
            console.log('\n🔄 Trying to sign in...');
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                console.error('❌ Sign in error:', signInError.message);
            } else {
                console.log('✅ Signed in successfully!');
                console.log('User:', signInData.user?.email);
            }
        } else {
            console.log('✅ User created successfully!');
            console.log('Email:', email);
            console.log('Password:', password);
            console.log('\nℹ️ You may need to confirm your email in Supabase dashboard');
            console.log('Or disable email confirmation in Supabase > Authentication > Providers > Email');
        }
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

createTestUser();
