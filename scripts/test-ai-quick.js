// تجربة مباشرة بدون dotenv
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = 'AIzaSyAFHeeyk7ylOdQnf5qgNZ_qkDNStM3XL1Y'; // من ملف .env

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

async function testQuick() {
    console.log('🧪 اختبار سريع للـ Sales AI\n');

    const message = "يا هلا، وش الخدمات اللي تقدمونها؟";

    const prompt = `
أنت "لوني" - ممثل خدمة عملاء سعودي لشركة دعوات إلكترونية.

الخدمات:
- QR Code للدعوات
- Live Analytics
- RSVP Bot تلقائي
- خصم 20%

العميل يقول: "${message}"

رد عليه بشكل ودود باللهجة السعودية. ارجع JSON:
{
  "response": "الرد هنا",
  "intent": "inquiry"
}
`;

    console.log('📨 العميل:', message);
    console.log('-'.repeat(60));

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('🤖 الرد الكامل:', text);

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('\n✅ لوني:', parsed.response);
            console.log('Intent:', parsed.intent);
        }
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        console.error('التفاصيل الكاملة:', error);
        if (error.response) {
            console.error('Response:', error.response);
        }
    }
}

testQuick();
