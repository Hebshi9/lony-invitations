/**
 * Test script for V2 Meta Sending Endpoint
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const V2_URL = 'http://localhost:3002/api/v2/meta/send';
const TEST_PHONE = process.env.ADMIN_PHONE || '966503678789';

async function testV2Send() {
    console.log(`🚀 Testing V2 Meta Send to ${TEST_PHONE}...`);

    const payload = {
        phone: TEST_PHONE,
        text: 'Lony V2 (Meta Only) Test Message 🛡️\n\nهذه رسالة تجريبية من النظام الجديد المطور برمجياً بنظام الموديلات النظيفة.',
    };

    try {
        const response = await fetch(V2_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('--- Result ---');
        console.log(JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n✅ V2 Meta Send Test PASSED!');
        } else {
            console.error('\n❌ V2 Meta Send Test FAILED.');
        }
    } catch (error) {
        console.error('\n💥 Request Error:', error.message);
    }
}

testV2Send();
