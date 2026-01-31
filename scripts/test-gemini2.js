import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testGemini2() {
    console.log('🧪 Testing Gemini 2.0 (latest)...\n');

    const models = [
        'gemini-2.0-flash-exp',
        'gemini-exp-1206',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest'
    ];

    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

        const body = {
            contents: [{
                parts: [{
                    text: 'قل مرحباً بالعربي'
                }]
            }]
        };

        try {
            console.log(`📡 Testing ${modelName}...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                const text = data.candidates[0].content.parts[0].text;
                console.log(`✅ ${modelName} WORKS!`);
                console.log(`Response: ${text}\n`);
                console.log(`🎉 SUCCESS! Model: ${modelName}`);
                console.log(`Update gemini-service.ts to use: "${modelName}"\n`);
                return modelName;
            } else {
                console.log(`❌ ${data.error?.message?.substring(0, 100)}\n`);
            }
        } catch (error) {
            console.log(`❌ ${error.message}\n`);
        }
    }

    console.log('❌ All models failed.');
    console.log('Please enable API at: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
}

testGemini2();
