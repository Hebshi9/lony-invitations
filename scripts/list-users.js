import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function listUsers() {
    console.log('👥 Checking registered users...\n');

    // Note: Regular users can't query auth.users directly
    // We need to use the service role key for that
    // Instead, let's try to get user info from events table (which has user_id)

    const { data: events, error } = await supabase
        .from('events')
        .select('user_id')
        .not('user_id', 'is', null)
        .limit(10);

    if (error) {
        console.error('❌ Error:', error.message);
        console.log('\nℹ️ Cannot query users directly with anon key.');
        console.log('You need to either:');
        console.log('1. Create a new account from the login page');
        console.log('2. Use Supabase Dashboard to view users');
        return;
    }

    if (events && events.length > 0) {
        console.log('Found user IDs in events:');
        const uniqueUserIds = [...new Set(events.map(e => e.user_id))];
        uniqueUserIds.forEach((id, i) => {
            console.log(`${i + 1}. User ID: ${id}`);
        });
    } else {
        console.log('No users found in events table.');
    }

    console.log('\n💡 To create a new account:');
    console.log('1. Open http://localhost:5174');
    console.log('2. Click "ليس لديك حساب؟ أنشئ حساباً"');
    console.log('3. Use any email and password (6+ characters)');
    console.log('\n📧 Suggested credentials:');
    console.log('Email: admin@lony.com');
    console.log('Password: admin123');
}

listUsers();
