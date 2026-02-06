import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Your phone number
const PHONE = '+966503678789';
const ID = '966503678789'; // Evolution accepts numbers only typically

async function fixAccount() {
    console.log('🔧 Fixing WhatsApp Account for:', PHONE);

    // 1. Delete existing entry to be clean
    const { error: delErr } = await supabase
        .from('whatsapp_accounts')
        .delete()
        .eq('id', ID);

    if (delErr) console.error('Delete error:', delErr.message);

    // 2. Insert fresh entry
    const { data, error } = await supabase
        .from('whatsapp_accounts')
        .insert([{
            id: ID,
            phone: PHONE,
            name: 'رقم الإدارة',
            status: 'disconnected', // Start as disconnected
            daily_limit: 1000,
            is_active: true
        }])
        .select();

    if (error) {
        console.error('❌ Insert Error:', error.message);
    } else {
        console.log('✅ Account inserted successfully in DB:', data);
    }

    // 3. Ensure Evolution Instance Exists
    try {
        const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8081';
        const API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';

        console.log('🔄 Creating/Checking Evolution Instance...');
        const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instanceName: ID, // Must match the DB ID
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            })
        });
        const json = await res.json();
        console.log('📦 Evolution Response:', JSON.stringify(json));
    } catch (e) {
        console.error('SERVER ERROR:', e.message);
    }
}

fixAccount();
