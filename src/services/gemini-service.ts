import { GoogleGenerativeAI } from '@google/generative-ai';
import { getOpenAIClient } from './openaiService';

// Initialize Gemini
const API_KEY = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_GEMINI_API_KEY
    : process.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY || '');

class GeminiService {
    private model: any;

    constructor() {
        // Updated to a stable model since user reported AI is not working
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }

    /**
     * Smart Excel Column Mapping
     * Analyzes Excel headers and maps them to standard fields
     */
    async mapExcelColumns(headers: string[]): Promise<{
        name: string;
        phone: string;
        table: string;
        category: string;
        companions: string;
    }> {
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
    private smartMapExcelColumns(headers: string[]): any {
        const mapping: any = { name: '', phone: '', table: '', category: '', companions: '' };

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
    async analyzeDesign(imageBase64: string): Promise<any[]> {
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
    async generateWhatsAppMessage(params: {
        guestName: string;
        eventName: string;
        eventDate: string;
        eventLocation: string;
        category?: string;
    }): Promise<string> {
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
    async polishMessage(currentText: string): Promise<string> {
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
    async detectRSVP(replyText: string): Promise<'confirmed' | 'declined' | 'maybe' | null> {
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
     * Reads the invitation image and extracts Groom, Bride, Date, Location, Time
     */
    async extractInvitationDetails(imageSource: string): Promise<{
        groom?: string;
        bride?: string;
        date?: string;
        location?: string;
        time?: string;
    }> {
        try {
            let base64Data = imageSource;
            let mimeType = 'image/jpeg';

            // If it's a URL, fetch it first
            if (imageSource.startsWith('http')) {
                const response = await fetch(imageSource);
                const blob = await response.blob();
                mimeType = blob.type;
                const arrayBuffer = await blob.arrayBuffer();
                base64Data = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            } else if (imageSource.includes('base64,')) {
                base64Data = imageSource.split('base64,')[1];
                mimeType = imageSource.split(';')[0].split(':')[1];
            }

            const prompt = `
أنت خبير في قراءة وتحليل كروت دعوات الزفاف العربية.
حلل هذه الصورة واستخرج البيانات التالية بدقة باللغة العربية:
1. اسم العريس (أو عائلة العريس)
2. اسم العروس (أو عائلة العروس)
3. تاريخ المناسبة (باليوم والتاريخ الهجري أو الميلادي)
4. موقع القاعة (اسم القاعة والمدينة)
5. وقت الحضور (مثلاً: بعد صلاة العشاء، الساعة 8 مساءً)

الرد يجب أن يكون JSON فقط بهذا الشكل:
{
  "groom": "...",
  "bride": "...",
  "date": "...",
  "location": "...",
  "time": "..."
}

ملاحظة: إذا لم تجد بياناً معيناً، ضع "". لا تضف أي نص خارج JSON.
            `;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType
                    }
                }
            ]);

            const text = result.response.text();
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {};
        } catch (error) {
            console.error('[Gemini] Extraction failed:', error);
            return {};
        }
    }

    /**
     * Parse Business Entry (AI Magic Input)
     * Extracts structured order data from natural language text with Saudi Dialect awareness
     */
    async parseBusinessEntry(text: string): Promise<{
        client_name: string;
        client_phone: string;
        service_type: string;
        total_price: number;
        deposit_amount: number;
        designer_fee: number;
        follow_up_date: string;
        expected_delivery_date: string;
        bank_account: string;
        estimated_marketing_cost: number;
    } | null> {
        try {
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

الرد يجب أن يكون JSON فقط بهذا الشكل:
{
  "client_name": "",
  "client_phone": "",
  "service_type": "بكج كامل",
  "total_price": 0,
  "deposit_amount": 0,
  "designer_fee": 0,
  "follow_up_date": "",
  "expected_delivery_date": "",
  "bank_account": "",
  "estimated_marketing_cost": 0
}

تعليمات صارمة:
- افهم الكلمات السعودية: (عربون = deposit_amount، باقي = الفرق بين الإجمالي والعربون، حجزت = service_type).
- حول كل الأرقام إلى قيم عددية (Numbers).
- لا تضف أي نص أو شرح خارج الـ JSON.
            `;

            try {
                // Using OpenAI GPT-4o directly as requested by the user
                const openai = getOpenAIClient();
                const response = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "system",
                            content: "أنت مساعد مالي ذكي. قم بإرجاع الرد بصيغة JSON فقط استناداً إلى التعليمات التي يطلبها المستخدم، دون أي نص إضافي."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    response_format: { type: "json_object" }
                });
                
                const content = response.choices[0].message.content;
                if (content) {
                    const result = JSON.parse(content);
                    return result;
                }
            } catch (openAiError) {
                console.error('[OpenAI] Business entry parsing failed:', openAiError);
            }
            
            return null;
        } catch (error) {
            console.error('[Gemini] parseBusinessEntry failed:', error);
            return null;
        }
    }

    /**
     * Check if API key is configured
     */
    isConfigured(): boolean {
        return !!API_KEY;
    }
}

const geminiService = new GeminiService();
export default geminiService;
