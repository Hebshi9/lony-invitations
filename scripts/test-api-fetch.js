
const API_KEY = 'AIzaSy-REMOVED_FOR_SECURITY';
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;

async function test() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello" }]
                }]
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
