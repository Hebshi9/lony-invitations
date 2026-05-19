
const { handler } = require('../netlify/functions/send-campaign.mjs');
const { createClient } = require('@supabase/supabase-js');

// Mocking process.env for local test
process.env.VITE_SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';
process.env.META_ACCESS_TOKEN = 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
process.env.META_PHONE_NUMBER_ID = '1031606736708015';

async function runTest() {
    console.log('🧪 Testing Lony Template dispatch...');
    
    // We need a valid eventId and guestId. 
    // I'll pick a guest or just use testPhone.
    const eventReq = {
        httpMethod: 'POST',
        body: JSON.stringify({
            guestIds: ['dummy'], // Will be ignored if testPhone is present
            eventId: '6253457a-9a91-4966-9b57-c3f916892557', // Example Event
            campaignType: 'invite',
            testPhone: '966569667344'
        })
    };

    try {
        const response = await handler(eventReq, {});
        console.log('Response:', JSON.stringify(JSON.parse(response.body), null, 2));
    } catch (e) {
        console.error('Execution Failed:', e);
    }
}

runTest();
