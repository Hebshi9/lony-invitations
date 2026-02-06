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
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeReply(replyText, guestName = '') {
        if (!process.env.OPENAI_API_KEY) {
            console.warn('[RSVP-AI] ⚠️ API Key missing, using fallback analysis.');
            return this.fallbackAnalysis(replyText);
        }

        // Try AI analysis with retries
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[RSVP-AI] 🤖 Analyzing with OpenAI (Attempt ${attempt}/${this.maxRetries}): "${replyText}"...`);

                const systemPrompt = `
أنت خبير في فهم اللهجات السعودية والخليجية لغرض إدارة دعوات المناسبات.
مهمتك: تصنيف ردود الضيوف بدقة متناهية (High Precision).

التعليمات الصارمة جداً:
1. صنف الحالة (status) إلى أحد القيم التالية فقط:
   - "confirmed": فقط وفقط إذا كان هناك تأكيد صريح وشبه قاطع بالحضور.
     * أمثلة مؤكدة: "حاضرين", "تم", "يشرفنا", "جاي", "معكم", "باذن الله بنجي", "قدام", "ابشر", "الله يحييك (في سياق الرد ب نعم)".
   - "declined": رفض صريح أو اعتذار.
     * أمثلة: "معتذر", "مرتبط", "مسافر", "ما أقدر", "الجايات أكثر", "الله يوفقكم (بدون تأكيد)", "مبروك (بدون تأكيد)".
   - "inquiry": استفسار عن موقع أو وقت أو تفاصيل.
     * ملاحظة: "وين الموقع؟" أو "متى العشاء؟" تُصنف inquiry ولا تعتبر موافقة إلا إذا اقترنت بكلمة تأكيد.
   - "maybe": تردد أو عدم تأكيد.
     * أمثلة: "بشوف", "يمكن", "أرد لك خبر", "خلها بظروفها".

2. تحذيرات (Critical):
   - الدعاء ("الله يوفقهم", "منه المال ومنها العيال", "ألف مبروك") لوحده *ليس* تأكيداً. صنفه "declined" أو null (غير رد) إذا لم يكن فيه اعتذار واضح. لا تصنفه "confirmed" أبداً إلا بوجود كلمة تدل على المجيء.
   - الرد بـ "👍" أو ملصق مشابه يعتبر "confirmed".
   - إذا كنت شاكاً ولو بنسبة 1%، لا تعطِ "confirmed". صنفها "inquiry" أو "maybe".

3. الثقة (confidence):
   - يجب أن تكون الثقة 1.0 (100%) فقط للردود الصريحة جداً.
   - أي غموض يخفض الثقة تحت 0.8.

المخرج المطلوب (JSON):
{
  "is_rsvp": true/false (هل لهذا الرد علاقة بالدعوة؟),
  "status": "confirmed" | "declined" | "maybe" | "inquiry" | null,
  "confidence": 0.0 - 1.0,
  "companion_count": number (استخرج العدد بدقة إذا ذكر، الافتراضي 0),
  "notes": "الملاحظات",
  "reasoning": "سبب التصنيف"
}`;

                const userPrompt = `
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
                    temperature: 0.3, // Low temperature for consistent classification
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

        const confirmedKeywords = ['نعم', 'حاضر', 'موافق', 'إن شاء الله', 'ان شاء الله', 'أكيد', 'اكيد', 'نحضر', 'حضور', 'تمام', 'تم', 'أبشر', 'ابشر', 'جايين', 'جاي', 'معكم', 'قدام', 'يشرفنا', 'يسعدنا', 'بإذن الله', 'باذن الله'];
        const declinedKeywords = ['معتذر', 'اعتذر', 'أعتذر', 'آسف', 'للاسف', 'للأسف', 'ما نقدر', 'ما أقدر', 'مانقدر', 'مااقدر', 'صعبة', 'ظروف', 'مرتبط', 'مسافر', 'مشغول'];
        const maybeKeywords = ['ممكن', 'ربما', 'بشوف', 'اشوف', 'نشوف', 'محتمل', 'احتمال', 'غير متأكد', 'يمكن', 'ارد لكم'];

        if (confirmedKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'confirmed', confidence: 0.7, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }
        if (declinedKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'declined', confidence: 0.7, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }
        if (maybeKeywords.some(keyword => text.includes(keyword))) {
            return { is_rsvp: true, status: 'maybe', confidence: 0.6, companion_count: 0, notes: null, reasoning: 'Keyword match (fallback)' };
        }

        return { is_rsvp: false, status: null, confidence: 0.5, companion_count: 0, notes: replyText, reasoning: 'No RSVP keywords found' };
    }
}

const rsvpAI = new RSVPAIService();
export default rsvpAI;
