import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testAllModels() {
    console.log('🧪 Testing all Gemini models...\n');

    const models = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-1.0-pro-latest',
        'gemini-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ];

    for (const modelName of models) {
        const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${API_KEY}`;

        const body = {
            contents: [{
                parts: [{
                    text: 'Say hello in Arabic'
                }]
            }]
        };

        try {
            console.log(`Testing ${modelName}...`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ ${modelName} WORKS!`);
                console.log(`Response: ${data.candidates[0].content.parts[0].text}\n`);
                console.log(`🎉 Use this model: ${modelName}`);
                break;
            } else {
                console.log(`❌ ${modelName} failed: ${data.error?.message?.substring(0, 80)}\n`);
            }
        } catch (error) {
            console.log(`❌ ${modelName} error: ${error.message}\n`);
        }
    }
}

testAllModels();
