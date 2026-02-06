
import { GoogleGenerativeAI } from "@google/generative-ai";
import 'dotenv/config';

async function testGemini() {
    console.log("🧪 Testing Gemini API Key...");
    const key = process.env.VITE_GEMINI_API_KEY;

    if (!key) {
        console.error("❌ No API Key found in env!");
        return;
    }
    console.log(`🔑 Key found: ${key.substring(0, 10)}...`);

    const genAI = new GoogleGenerativeAI(key);

    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];

    for (const modelName of models) {
        console.log(`\n🤖 Attempting model: ${modelName}`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello!");
            const response = await result.response;
            console.log(`✅ SUCCESS with ${modelName}!`);
            return; // Found a working one
        } catch (error) {
            console.error(`❌ Failed ${modelName}: ${error.statusText || error.message}`);
        }
    }
}

testGemini();
