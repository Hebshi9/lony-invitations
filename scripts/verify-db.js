import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabase() {
    console.log('--- Database Verification Report ---');

    // 1. Check Tables
    const tables = [
        'events',
        'guests',
        'client_intake_requests',
        'whatsapp_accounts',
        'whatsapp_messages',
        'scans'
    ];

    for (const table of tables) {
        const { data, error, count } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`❌ Table [${table}]: Error - ${error.message}`);
        } else {
            console.log(`✅ Table [${table}]: Exists (${count} rows)`);
        }
    }

    // 2. Check Storage
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    if (storageError) {
        console.log(`❌ Storage: Error - ${storageError.message}`);
    } else {
        const intakeBucket = buckets.find(b => b.id === 'intake_files');
        const cardsBucket = buckets.find(b => b.id === 'invitation-cards');

        console.log(intakeBucket
            ? `✅ Storage: Bucket [intake_files] exists`
            : `❌ Storage: Bucket [intake_files] is missing`);

        console.log(cardsBucket
            ? `✅ Storage: Bucket [invitation-cards] exists`
            : `❌ Storage: Bucket [invitation-cards] is missing`);
    }

    // 3. Check Guest Columns
    const { data: guestCols, error: colsError } = await supabase
        .from('guests')
        .select('card_image_url, card_number')
        .limit(1);

    if (colsError) {
        console.log(`❌ Columns: Error checking guest columns - ${colsError.message}`);
    } else {
        console.log(`✅ Columns: card_image_url & card_number exist in guests table`);
    }

    console.log('------------------------------------');
}

checkDatabase();
