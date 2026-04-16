import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Gemini
const API_KEY = process.env.VITE_GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(API_KEY);

class GeminiService {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    }

    /**
     * Smart Excel Column Mapping
     * Analyzes Excel headers and maps them to standard fields
     */
    async mapExcelColumns(headers) {
        try {
            const prompt = `
أنت مساعد ذكي لتحليل ملفات Excel للدعوات.
لديك هذه الأعمدة: ${headers.join(', ')}

حدد أي عمود يمثل:
- name: اسم الضيف (مثل: اسم، name، الاسم، guest، ضيف، الشخص المدعو)
- phone: رقم الجوال (مثل: جوال، phone، mobile، رقم، هاتف، موبايل)
- table: رقم الطاولة (مثل: طاولة، table، رقم الطاولة، table number)
- category: الفئة أو التصنيف (مثل: فئة، category، نوع، type)
- companions: عدد المرافقين (مثل: مرافقين، companions، عدد الأشخاص)

الرد يجب أن يكون JSON فقط بهذا الشكل:
{
  "name": "اسم العمود الدقيق",
  "phone": "اسم العمود الدقيق",
  "table": "اسم العمود الدقيق",
  "category": "اسم العمود الدقيق",
  "companions": "اسم العمود الدقيق"
}

إذا لم تجد عمود معين، ضع "".
لا تضف أي نص قبل أو بعد JSON.
            `;

            const result = await this.model.generateContent(prompt);
            const text = result.response.text();

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return { name: '', phone: '', table: '', category: '', companions: '' };
        } catch (error) {
            console.error('[Gemini] Excel mapping failed:', error);
            // Fallback to smart mapping
            return this.smartMapExcelColumns(headers);
        }
    }

    /**
     * Fallback: Smart mapping without AI
     */
    smartMapExcelColumns(headers) {
        const mapping = { name: '', phone: '', table: '', category: '', companions: '' };

        const namePatterns = ['اسم', 'name', 'الاسم', 'guest', 'ضيف', 'الشخص'];
        const phonePatterns = ['جوال', 'phone', 'mobile', 'رقم', 'هاتف', 'موبايل'];
        const tablePatterns = ['طاولة', 'table', 'رقم الطاولة'];
        const categoryPatterns = ['فئة', 'category', 'نوع', 'type'];
        const companionsPatterns = ['مرافقين', 'companions', 'عدد'];

        headers.forEach(header => {
            const lower = header.toLowerCase().trim();
            if (namePatterns.some(p => lower.includes(p.toLowerCase()))) mapping.name = header;
            if (phonePatterns.some(p => lower.includes(p.toLowerCase()))) mapping.phone = header;
            if (tablePatterns.some(p => lower.includes(p.toLowerCase()))) mapping.table = header;
            if (categoryPatterns.some(p => lower.includes(p.toLowerCase()))) mapping.category = header;
            if (companionsPatterns.some(p => lower.includes(p.toLowerCase()))) mapping.companions = header;
        });

        return mapping;
    }

    /**
     * Analyze Design Image
     * Suggests optimal placement for text and QR code
     */
    async analyzeDesign(imageBase64) {
        try {
            const prompt = `
أنت مصمم دعوات محترف. حلل هذا التصميم واقترح أفضل الأماكن لوضع:

1. **اسم الضيف** (نص كبير، واضح، في مكان بارز)
2. **رقم الطاولة** (نص صغير، عادة في الزاوية)
3. **QR Code** (مربع، في مكان لا يغطي التصميم)

أعطني الإحداثيات بالنسبة المئوية من عرض وارتفاع الصورة.
- x=50 يعني في المنتصف أفقياً
- y=30 يعني في الثلث العلوي

الرد يجب أن يكون JSON فقط:
{
  "elements": [
    {
      "type": "text",
      "label": "اسم الضيف",
      "x": 50,
      "y": 35,
      "fontSize": 48,
      "color": "#000000",
      "fontWeight": "bold"
    },
    {
      "type": "text",
      "label": "رقم الطاولة",
      "x": 85,
      "y": 90,
      "fontSize": 24,
      "color": "#666666"
    },
    {
      "type": "qr",
      "x": 50,
      "y": 75,
      "width": 120
    }
  ]
}

لا تضف أي نص قبل أو بعد JSON.
            `;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: 'image/jpeg'
                    }
                }
            ]);

            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                return analysis.elements || [];
            }

            return [];
        } catch (error) {
            console.error('[Gemini] Design analysis failed:', error);
            return [];
        }
    }

    /**
     * Generate Custom WhatsApp Message
     * Creates personalized invitation message for each guest
     */
    async generateWhatsAppMessage(params) {
        try {
            const prompt = `
اكتب رسالة دعوة احترافية وودية لـ WhatsApp بالعربي.

معلومات الضيف:
- الاسم: ${params.guestName}
- الفئة: ${params.category || 'ضيف عادي'}

معلومات الحدث:
- اسم الحدث: ${params.eventName}
- التاريخ: ${params.eventDate}
- المكان: ${params.eventLocation}

المطلوب:
- رسالة قصيرة (3-4 أسطر)
- ودية ومحترمة
- تناسب الفئة (VIP أكثر رسمية، عائلة أكثر دفء)
- تنتهي بطلب التأكيد

لا تضف أي نص قبل أو بعد الرسالة.
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.error('[Gemini] Message generation failed:', error);
            // Fallback template
            return `مرحباً ${params.guestName}،\n\nيسعدنا دعوتك لحضور ${params.eventName}\nيوم ${params.eventDate}\nفي ${params.eventLocation}\n\nنتشرف بحضورك 🌹`;
        }
    }

    /**
     * Polish Message Template
     * Improves tone and clarity of a message template
     */
    async polishMessage(currentText) {
        try {
            const prompt = `
أنت خبير في كتابة الدعوات الرسمية والودية.
قمت بكتابة مسودة رسالة دعوة (قد تحتوي على متغيرات مثل {{name}}).
المطلوب: تحسين صياغة الرسالة لتكون أكثر احترافية وجاذبية، مع الحفاظ على المتغيرات كما هي.

النص الحالي:
"${currentText}"

أعد كتابة الرسالة بعد التحسين. لا تضف أي مقدمات أو شرح. فقط النص المحسن.
            `;

            const result = await this.model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            console.error('[Gemini] Polish failed:', error);
            return currentText;
        }
    }

    /**
     * Detect RSVP Response
     * Analyzes guest reply to determine confirmation status
     */
    async detectRSVP(replyText) {
        try {
            const prompt = `
حلل هذا الرد من ضيف:
"${replyText}"

حدد نوع الرد:
- confirmed: إذا كان تأكيد واضح للحضور
- declined: إذا كان اعتذار عن الحضور
- maybe: إذا كان غير متأكد

الرد يجب أن يكون كلمة واحدة فقط: confirmed أو declined أو maybe
لا تضف أي نص آخر.
            `;

            const result = await this.model.generateContent(prompt);
            const response = result.response.text().trim().toLowerCase();

            if (response.includes('confirmed')) return 'confirmed';
            if (response.includes('declined')) return 'declined';
            if (response.includes('maybe')) return 'maybe';

            return null;
        } catch (error) {
            console.error('[Gemini] RSVP detection failed:', error);
            return null;
        }
    }

    /**
     * Extract Invitation Data (OCR)
     * Parses invitation images to extract groom, bride, date, and location
     */
    async extractInvitationData(imageBase64) {
        try {
            const prompt = `
أنت خبير محترف في تحليل بطاقات الدعوة العربية (Wedding Invitations OCR).
حلل هذه الصورة واستخرج البيانات التالية بدقة شديدة:
1. groom: اسم العريس (أهم اسم في البطاقة، ابحث عن "الابن" أو "نجل" أو الاسم المكتوب بخط عريض وواضح). تجنب أسماء الآباء التي تأتي في البداية.
2. bride: اسم العروس (ابحث عن كلمة "كريمة" أو "الآنسة" أو الاسم الموازي للعريس).
3. date: تاريخ المناسبة كما هو مكتوب (مثال: الخميس 25 رجب، أو 2024/05/10).
4. location: مكان الحفل أو القاعة (اسم القاعة أو الفندق حصراً، مثل: "قاعة ليلتي" أو "فندق الريتز").

التعليمات الصارمة:
- استخرج النصوص باللغة العربية كما هي مكتوبة في الصورة.
- لا تضع أي ألقاب مثل "الدكتور" أو "المهندس" إلا إذا كانت جزءاً أساسياً من الاسم المذكور.
- **تنبيه:** في البطاقات العربية، الأسماء في البداية تكون عادةً للداعين (الآباء)، العريس والعروس أسماؤهم تكون في المنتصف وبخط أوضح.
- **هام جداً:** لا تخترع بيانات (No Hallucinations). إذا لم تجد الحقل، اتركه فارغاً "".
- لا تضع أسماء "ديمو" أو "عينة".

الرد يجب أن يكون JSON فقط:
{
  "groom": "",
  "bride": "",
  "date": "",
  "location": ""
}
            `;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: 'image/jpeg'
                    }
                }
            ]);

            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return { groom: '', bride: '', date: '', location: '' };
        } catch (error) {
            console.error('[Gemini] OCR Extraction failed:', error);
            return { groom: '', bride: '', date: '', location: '' };
        }
    }

    /**
     * Check if API key is configured
     */
    isConfigured() {
        return !!API_KEY;
    }
}

const geminiService = new GeminiService();
export default geminiService;
