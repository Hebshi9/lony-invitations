import { handler } from '../netlify/functions/send-batch-v2.mjs';
import dotenv from 'dotenv';
dotenv.config();

// Mock event
const eventReq = {
    httpMethod: 'POST',
    body: JSON.stringify({
        eventId: 'd3df674a-dab9-42bb-96bf-acc86b144b59',
        guestIds: ['8d4ecdb0-d31b-45e9-a952-14594223226a'],
        campaignType: 'official_template',
        testPhone: null
    })
};

async function test() {
    console.log('🚀 Invoking send-batch-v2 handler locally...');
    try {
        const response = await handler(eventReq, {});
        console.log('Response Status Code:', response.statusCode);
        console.log('Response Body:', JSON.stringify(JSON.parse(response.body), null, 2));
    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

test();
