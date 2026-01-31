import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testV1Beta() {
    console.log('🧪 Testing Gemini with v1beta API...\n');

    const models = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-1.0-pro-latest'
    ];

    for (const modelName of models) {
        // Use v1beta instead of v1
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

        const body = {
            contents: [{
                parts: [{
                    text: 'قل مرحباً بالعربي'
                }]
            }]
        };

        try {
            console.log(`Testing ${modelName} with v1beta...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ ${modelName} WORKS!`);
                console.log(`Response: ${data.candidates[0].content.parts[0].text}\n`);
                console.log(`🎉 SUCCESS! Use model: ${modelName} with v1beta API`);
                return;
            } else {
                console.log(`❌ Failed: ${data.error?.message?.substring(0, 100)}\n`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}\n`);
        }
    }

    console.log('❌ All models failed. API might not be enabled.');
}

testV1Beta();
