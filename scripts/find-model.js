import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);

        // Try different model names
        const modelsToTry = [
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-pro',
            'gemini-pro-vision'
        ];

        console.log('Testing available models...\n');

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello');
                console.log(`✅ ${modelName} - WORKS!`);
                console.log(`   Response: ${result.response.text().substring(0, 50)}...\n`);
                break; // Stop after first working model
            } catch (error) {
                console.log(`❌ ${modelName} - ${error.message.substring(0, 100)}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

listModels();
