import 'dotenv/config';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Debug Log
if (!process.env.OPENAI_API_KEY) {
    console.error('❌ [RSVP-AI] FATAL: OpenAI API Key is MISSING in environment variables!');
} else {
    console.log(`✅ [RSVP-AI] OpenAI API Key found (starts with: ${process.env.OPENAI_API_KEY.substring(0, 8)}...)`);
}

/**
 * RSVP AI Service - Analyze WhatsApp replies for RSVP intent (OpenAI Version)
 */
class RSVPAIService {
    constructor() {
        this.modelName = 'gpt-4o-mini';
        this.maxRetries = 3;
        console.log(`[RSVP-AI] Initialized with model: ${this.modelName}`);
    }

    /**
     * Analyze a reply text for RSVP intent
     * @param {string} replyText - The text of the reply
     * @param {string} guestName - Name of the guest (optional)
     * @param {string} lastMessage - The last message sent to the guest (optional)
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeReply(replyText, guestName = '', lastMessage = '') {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('[RSVP-AI] ⚠️ API Key missing, using fallback analysis.');
            return this.fallbackAnalysis(replyText);
        }

        // Try AI analysis with retries
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[RSVP-AI] 🤖 Analyzing with OpenAI (Attempt ${attempt}/${this.maxRetries}): "${replyText}"...`);

                const systemPrompt = `
أنت خبير ذكاء اصطناعي متخصص في فهم اللهجات السعودية والخليجية، وتحديداً في سياق دعوات المناسبات الاجتماعية (زواجات، حفلات، اجتماعات).
مهمتك: تحليل ردود الضيوف وتصنيفها بدقة (تأكيد أو اعتذار) حتى لو كانت مكتوبة بلهجة عامية أو جمل معقدة.

التعليمات:
1. فهم اللهجة: تعرف على الكلمات السعودية مثل "ابشر"، "قدام"، "تم"، "من عيوني" كعلامات للتأكيد. وتعرف على "اعتذر"، "ما اقدر"، "المرة الجاية" كعلامات للاعتذار.
2. تحليل الأرقام: إذا أرسل العميل رقم "1" (أو ١) في سياق طلب التأكيد، فهو تأكيد. إذا أرسل "2" (أو ٢) فهو اعتذار.
3. عدد المرافقين: استخرج عدد الأشخاص المرافقين إذا تم ذكرهم (مثلاً: "بجي أنا واثنين معي" تعني إجمالي 3 أشخاص).
4. التصنيفات (status):
   - "confirmed": تأكيد الحضور.
   - "declined": اعتذار عن الحضور.
   - "maybe": تردد.
   - "inquiry": سؤال.

المخرج (JSON فقط):
{
  "is_rsvp": true/false,
  "status": "confirmed" | "declined" | "maybe" | "inquiry" | null,
  "confidence": 0.0 - 1.0,
  "companion_count": number,
  "notes": "ملخص الرد",
  "reasoning": "سبب التصنيف"
}`;

                const userPrompt = `
آخر رسالة أُرسلت للضيف: "${lastMessage || 'غير متوفرة'}"
اسم الضيف: ${guestName || 'غير معروف'}
الرسالة: "${replyText}"
`;

                const completion = await openai.chat.completions.create({
                    model: this.modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.1, // Even more consistent for classification
                });

                const content = completion.choices[0].message.content;
                const analysis = JSON.parse(content);

                // Validate and normalize
                const result_validated = {
                    is_rsvp: Boolean(analysis.is_rsvp),
                    status: analysis.status || null,
                    confidence: Math.max(0, Math.min(1, parseFloat(analysis.confidence) || 0)),
                    companion_count: parseInt(analysis.companion_count) || 0,
                    notes: analysis.notes || null,
                    reasoning: analysis.reasoning || ''
                };

                console.log(`[RSVP-AI] ✅ OpenAI analysis successful:`, result_validated);
                return result_validated;

            } catch (error) {
                console.error(`[RSVP-AI] ❌ OpenAI Error on attempt ${attempt}:`, error.message);

                if (attempt === this.maxRetries) {
                    console.warn(`[RSVP-AI] ⚠️ All AI attempts failed, using fallback analysis`);
                    return this.fallbackAnalysis(replyText);
                }

                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Fallback analysis using simple keyword matching
     */
    fallbackAnalysis(replyText) {
        const text = replyText.toLowerCase();

        const confirmedKeywords = [
            'نعم', 'حاضر', 'حاضرين', 'موافق', 'إن شاء الله', 'ان شاء الله', 'أكيد', 'اكيد',
            'نحضر', 'حضور', 'تمام', 'تم', 'أبشر', 'ابشر', 'جايين', 'جاي', 'جايه',
            'معكم', 'قدام', 'يشرفنا', 'يسعدنا', 'بإذن الله', 'باذن الله',
            'أوكي', 'اوكي', 'ok', 'yes', 'يب', 'يس', 'ماشي', 'حياك', 'حياكم',
            'بنكون', 'بنجي', 'بنحضر', 'موجود', 'موجودين', 'حاضره', 'جايينكم',
            'هناك', 'بنكون هناك', 'نكون هناك', 'اجي', 'بجي', 'نجي',
            'على راسي', 'على الراس', 'وعليكم السلام حاضر', 'بكون عندكم',
            'شرفنا', 'يالله', 'طيب', 'مؤكد', 'متأكد', 'ان شاء الله جاي', 'ابشرو', 'سم', 'تم التاكيد', 'باذن الله جاي'
        ];
        const declinedKeywords = [
            'معتذر', 'معتذره', 'اعتذر', 'أعتذر', 'آسف', 'آسفه', 'للاسف', 'للأسف',
            'ما نقدر', 'ما أقدر', 'مانقدر', 'مااقدر', 'ما اقدر',
            'صعبة', 'صعب', 'ظروف', 'مرتبط', 'مسافر', 'مسافره', 'مشغول', 'مشغوله',
            'ما راح اقدر', 'مقدر', 'ماقدر', 'مو فاضي', 'عندي ارتباط',
            'ما بقدر', 'مابقدر', 'لا أستطيع', 'عذرا', 'مواعيدي', 'ما يناسبني',
            'no', 'لا', 'مايمديني', 'ما يمديني', 'مشاغل', 'عندي شغل',
            'ماحقدر', 'مابحضر', 'ماراح احضر', 'سامحني', 'العذر والسموحة', 'الله يوفقكم'
        ];
        const maybeKeywords = [
            'ممكن', 'ربما', 'بشوف', 'اشوف', 'نشوف', 'محتمل', 'احتمال',
            'غير متأكد', 'يمكن', 'ارد لكم', 'أرد لكم', 'بأكد لك', 'باكد لك',
            'خلني اشيك', 'بشيك', 'اتأكد', 'مو متأكد'
        ];

        // Strict Number Matching
        const cleanText = text.trim();
        if (cleanText === '1') return { is_rsvp: true, status: 'confirmed', confidence: 1.0, companion_count: 0, reasoning: 'Explicit number 1 (confirmed)' };
        if (cleanText === '2') return { is_rsvp: true, status: 'declined', confidence: 1.0, companion_count: 0, reasoning: 'Explicit number 2 (declined)' };

        if (confirmedKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'confirmed', confidence: 0.9, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }
        if (declinedKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'declined', confidence: 0.9, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }
        if (maybeKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'maybe', confidence: 0.8, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }

        return { is_rsvp: false, status: null, confidence: 0.5, companion_count: 0, notes: replyText, reasoning: 'No RSVP keywords found' };
    }
}

const rsvpAI = new RSVPAIService();
export default rsvpAI;
