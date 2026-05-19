
// Set env BEFORE importing
process.env.VITE_SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';
process.env.META_ACCESS_TOKEN = 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
process.env.META_PHONE_NUMBER_ID = '1031606736708015';

async function runSimulation() {
    const { handler } = await import('../netlify/functions/meta-webhook.mjs');
    console.log('🤖 Simulating WhatsApp Confirm Click...');
    
    const mockEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
            entry: [{
                id: '3277627339072448',
                changes: [{
                    field: 'messages',
                    value: {
                        contacts: [{ wa_id: '966503678789', profile: { name: 'Test User' } }],
                        messages: [{
                            id: 'wamid.MOCK_CLICK_ID',
                            from: '966503678789',
                            type: 'button',
                            button: { text: 'تأكيد الحضور', payload: 'تأكيد الحضور' },
                            context: { id: 'wamid.HBgMOTY2NTAzNjc4Nzg5FQIAERgSQUJGMEI1RTM4MjYxMEE4ODlEAA==' },
                            timestamp: Math.floor(Date.now() / 1000)
                        }]
                    }
                }]
            }]
        })
    };

    try {
        const response = await handler(mockEvent, {});
        console.log('Simulation Status Code:', response.statusCode);
    } catch (e) {
        console.error('Simulation Failed:', e);
    }
}

runSimulation();
