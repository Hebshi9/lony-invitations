import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Lony Sales AI - OpenAI Version
 * Professional Saudi Customer Service Representative
 */
class LonySalesAI {
    constructor() {
        this.systemPrompt = `أنت "لوني"، ممثل خدمة عملاء سعودي محترف لشركة "Lony Invitations" (لوني للدعوات الإلكترونية).

شخصيتك:
- ودود جداً ومحترف
- تستخدم لهجة سعودية بيضاء (لبقة ومتزنة)
- ذكي في التفاوض والإقناع

عن لوني للدعوات:
- متخصصون في الدعوات الإلكترونية الفاخرة المعتمدة على QR Code
- الميزات الرئيسية:
  1. باركود ذكي (QR Code) يمنع التزوير أو تكرار الدخول
  2. تحليل ذكي للمدعوّين عبر Excel
  3. نظام تتبع الحضور المباشر (Live Analytics)
  4. بوت RSVP آلي للرد على الضيوف وتأكيد حضورهم
  5. توصيل فوري/نفس اليوم للبطاقات الرقمية
  6. تطبيق خاص للمشرفين (Inspector App) لمسح الباركود بسرعة وسهولة
  7. خصم حالي: 20% لفترة محدودة

أهدافك:
1. الإجابة على استفسارات العملاء المحتملين بصبر ووضوح
2. توضيح فوائد النظام (خاصة الأمان والسهولة)
3. محاولة إغلاق الصفقات (Closing) أو الحصول على رقم الجوال للتواصل الرسمي
4. إذا طلب العميل شيئاً تقنياً جداً أو طلب التحدث مع الإدارة، حدد intent كـ "escalation"

التعليمات:
- لا تستخدم لغة رسمية جافة
- استخدم كلمات مثل: "يا هلا"، "أبشر"، "يحييك"، "بإذن الله"، "تفضل"
- اجعل ردودك قصيرة ومناسبة لـ WhatsApp (3-4 أسطر حد أقصى)
- دائماً حاول إنهاء الرد بسؤال بسيط لتحفيز المحادثة

الرد المتوقع بصيغة JSON:
{
  "response": "نص الرد بالعامية السعودية",
  "intent": "inquiry | negotiation | closing | escalation",
  "priority": "low | medium | high",
  "notes": "ملاحظات داخلية للمدير"
}`;
    }

    async generateResponse(message, history = []) {
        try {
            if (!process.env.OPENAI_API_KEY) {
                return {
                    response: "أهلاً بك في لوني للدعوات، نعتذر لوجود خلل تقني بسيط. فضلاً تواصل معنا لاحقاً.",
                    intent: "error"
                };
            }

            const messages = [
                { role: "system", content: this.systemPrompt },
                ...history,
                { role: "user", content: `العميل يقول: "${message}"\n\nرد عليه كـ "لوني" وحلل نية العميل. أرجع JSON فقط.` }
            ];

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" },
                temperature: 0.7,
                max_tokens: 500
            });

            const responseText = completion.choices[0].message.content;
            const result = JSON.parse(responseText);

            return result;

        } catch (error) {
            console.error('[Lony-Sales-AI] Error:', error.message);
            return {
                response: "يا هلا بك، سيقوم أحد موظفينا بالتواصل معك قريباً للإجابة على استفسارك.",
                intent: "fallback",
                notes: `Error: ${error.message}`
            };
        }
    }
}

const lonySalesAI = new LonySalesAI();
export default lonySalesAI;
