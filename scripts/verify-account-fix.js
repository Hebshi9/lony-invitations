import 'dotenv/config';
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/whatsapp';

async function verify() {
    console.log('🚀 Verifying Account Creation Fix...');

    const testPhone = '+966' + Math.floor(Math.random() * 10000000);
    const testName = 'Verification Test ' + new Date().toLocaleTimeString();

    try {
        // 1. Create account
        console.log(`📡 Adding account: ${testPhone}...`);
        const addRes = await fetch(`${API_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone, name: testName })
        });
        const addResult = await addRes.json();

        if (addResult.success) {
            console.log('✅ Account created successfully!');
            console.log('   ID (UUID):', addResult.account.id);
        } else {
            console.error('❌ Failed to create account:', addResult.error);
            return;
        }

        // 2. Fetch all accounts to verify it's there
        console.log('🔍 Fetching all accounts...');
        const listRes = await fetch(`${API_URL}/accounts`);
        const listResult = await listRes.json();

        const found = listResult.accounts.find(a => a.phone === testPhone);
        if (found) {
            console.log('✅ Account found in the list!');
            console.log('   Status:', found.status);
        } else {
            console.error('❌ Account NOT found in the list!');
        }

        // 3. Cleanup (optional)
        console.log('🧹 Cleaning up test account...');
        await fetch(`${API_URL}/accounts/${addResult.account.id}`, { method: 'DELETE' });
        console.log('✅ Cleanup complete.');

    } catch (e) {
        console.error('💥 Verification failed:', e.message);
    }
}

verify();
