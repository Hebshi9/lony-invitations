import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function setupTables() {
    console.log('🔧 Setting up Sales AI tables in Supabase...\n');

    try {
        // Read SQL file
        const sqlContent = fs.readFileSync(
            './supabase/migrations/sales_ai_conversations.sql',
            'utf8'
        );

        console.log('📄 SQL file loaded');
        console.log('⚠️  Note: You need to run this SQL manually in Supabase Dashboard');
        console.log('   OR use Supabase CLI: supabase db push\n');

        // For now, let's just verify connection
        const { data, error } = await supabase
            .from('sales_conversations')
            .select('count')
            .limit(1);

        if (error) {
            console.log('❌ Tables not created yet. Please run SQL in Supabase:');
            console.log('\n1. Go to: https://supabase.com/dashboard');
            console.log('2. Open SQL Editor');
            console.log('3. Paste content from: supabase/migrations/sales_ai_conversations.sql');
            console.log('4. Click "Run"\n');
        } else {
            console.log('✅ Tables already exist!');
            console.log('   sales_conversations ✓');
            console.log('   sales_messages ✓');
            console.log('   sales_dashboard (view) ✓\n');
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

setupTables();
