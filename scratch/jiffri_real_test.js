/*
 * JIFFRI REAL TEST - USING REAL PHONE
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const serverUrl = 'http://localhost:3009/api/send-campaign-background';
const eventId = '0900ecaf-3d22-4f3b-bc01-9df1ef75f9f7'; // Jiffri
const testPhone = '966503578789'; // REAL REGISTERED TEST NUMBER

async function runRealTest() {
    console.log(`\n🚀 Triggering Jiffri Campaign for REAL NUMBER: ${testPhone}...`);
    
    const body = {
        eventId: eventId,
        testPhone: testPhone 
    };

    const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log(`Server Response: ${JSON.stringify(data)}`);
}

runRealTest();
