import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

async function testAI() {
    console.log('Testing Gemini 1.5 Flash...');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const text = 'عميل اسمه فهد طلب فلتر سناب بـ 250 وحولها لي كامله على اس تي سي باي والجوال 0501234567';
    
    const prompt = `
أنت مساعد مالي ذكي متخصص في إدارة مبيعات شركة "لوني" (Lony) لدعوات الزفاف الفاخرة.
حلل النص التالي (باللهجة السعودية أو الفصحى) واستخرج البيانات المالية بدقة احترافية:

"${text}"

المطلوب استخراج:
1. client_name: اسم العميل (مثال: ناصر القحطاني)
2. client_phone: رقم الجوال (مثال: 0569667344)
3. service_type: نوع الخدمة. يجب أن تصنفها بدقة لإحدى هذه الفئات: ("تصميم فقط", "تصميم وباركود", "بكج كامل", "إدارة بوابة", "رسائل واتساب", "فلتر سناب شات", "سيرة ذاتية", "لينكد ان", "أخرى").
4. total_price: المبلغ الإجمالي المتفق عليه (رقماً فقط)
5. deposit_amount: مبلغ العربون/الدفعة الأولى المدفوعة (رقماً فقط)
6. designer_fee: تكلفة المصممة إن وجدت (رقماً فقط)
7. follow_up_date: تاريخ المتابعة القادم (بصيغة YYYY-MM-DD)
8. expected_delivery_date: تاريخ التسليم المتوقع (بصيغة YYYY-MM-DD) - إذا لم يذكر، اقترح تاريخاً بعد 3 أيام من اليوم.
9. bank_account: حساب الدفع البنكي. يجب أن تصنفه لإحدى هذه البنوك أو المحافظ السعودية: ("الراجحي", "الأهلي", "الإنماء", "الأول", "الرياض", "البلاد", "الاستثمار", "الفرنسي", "الجزيرة", "اس تي سي باي", "يورباي", "موبايلي باي", "الانماء باي", "نقدي", "غير محدد").
10. estimated_marketing_cost: تكلفة العميل التسويقية التقديرية (استنتجها كنسبة 10% من الإجمالي أو إذا ذكرت صراحة).

الرد يجب أن يكون JSON فقط.
`;

    try {
        const result = await model.generateContent(prompt);
        console.log('Response:', result.response.text());
    } catch (e) {
        console.error('Error:', e);
    }
}

testAI();
