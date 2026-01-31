import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testDirectAPI() {
    console.log('🧪 Testing Gemini API directly...\n');

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;

    const body = {
        contents: [{
            parts: [{
                text: 'قل مرحباً بالعربي'
            }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Success!');
            console.log('Response:', data.candidates[0].content.parts[0].text);
            console.log('\n🎉 Gemini is working! Model: gemini-pro (v1 API)');
        } else {
            console.log('❌ Error:', data.error.message);
            console.log('\nTrying to enable API...');
            console.log('Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com');
        }
    } catch (error) {
        console.error('❌ Network error:', error.message);
    }
}

testDirectAPI();
