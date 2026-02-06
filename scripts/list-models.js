import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ API Key is missing!');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        console.log('🔍 Listing available models...');
        // The current SDK might not strictly support listModels via the main entry point easily in all versions, 
        // but let's try a direct approach or a simple generation test with common models.

        // Since listModels isn't always exposed in the high-level helper, we'll try to generate with common candidates.
        const candidates = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-pro',
            'gemini-1.0-pro'
        ];

        console.log('🧪 Testing common models...');

        for (const modelName of candidates) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                console.log(`\nTesting ${modelName}...`);
                const result = await model.generateContent('Hello');
                const response = await result.response;
                console.log(`✅ ${modelName} is WORKING! Response: ${response.text().substring(0, 20)}...`);
            } catch (error) {
                console.log(`❌ ${modelName} failed: ${error.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
