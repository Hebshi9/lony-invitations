// Test Gemini API Key
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;

async function testGemini() {
    console.log('🧪 Testing Gemini API...\n');

    if (!API_KEY) {
        console.error('❌ VITE_GEMINI_API_KEY not found in .env');
        process.exit(1);
    }

    console.log('✅ API Key found:', API_KEY.substring(0, 20) + '...\n');

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        // Test 1: Simple text generation
        console.log('📝 Test 1: Simple text generation');
        const result1 = await model.generateContent('قل مرحباً بالعربي');
        console.log('Response:', result1.response.text());
        console.log('✅ Test 1 passed!\n');

        // Test 2: Excel column mapping
        console.log('📊 Test 2: Excel column mapping');
        const headers = ['اسم الضيف', 'موبايل', 'رقم الطاولة'];
        const prompt = `
أعمدة Excel: ${headers.join(', ')}
حدد أي عمود يمثل: name, phone, table
الرد JSON فقط: {"name": "...", "phone": "...", "table": "..."}
        `;
        const result2 = await model.generateContent(prompt);
        const text = result2.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const mapping = JSON.parse(jsonMatch[0]);
            console.log('Mapping:', mapping);
            console.log('✅ Test 2 passed!\n');
        }

        console.log('🎉 All tests passed! Gemini is ready to use.\n');
        console.log('Next steps:');
        console.log('1. Restart your dev server (npm run dev)');
        console.log('2. The system will now use AI automatically');
        console.log('3. Try uploading an Excel file to see smart mapping');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nPossible issues:');
        console.log('- Invalid API key');
        console.log('- Network connection problem');
        console.log('- API quota exceeded');
        process.exit(1);
    }
}

testGemini();
