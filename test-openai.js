import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';

const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

const openai = new OpenAI({
    apiKey: apiKey
});

async function testOpenAI() {
    console.log('Testing OpenAI...');
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Reply in JSON only: { \"status\": \"ok\" }"
                }
            ],
            response_format: { type: "json_object" }
        });
        console.log('Response:', response.choices[0].message.content);
    } catch (e) {
        console.error('Error:', e);
    }
}

testOpenAI();
