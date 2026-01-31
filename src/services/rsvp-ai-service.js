import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_GEMINI_API_KEY
    : process.env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY || '');

/**
 * RSVP AI Service - Analyze WhatsApp replies for RSVP intent
 */
class RSVPAIService {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    /**
     * Analyze a reply text for RSVP intent
     * @param {string} replyText - The text of the reply
     * @param {string} guestName - Name of the guest (optional, for context)
     * @returns {Promise<Object>} Analysis result
     */
    async analyzeReply(replyText, guestName = '') {
        try {
            const prompt = `
أنت نظام ذكي لتحليل ردود الضيوف على دعوات الأفراح والمناسبات عبر WhatsApp.

مهمتك: تحليل الرد التالي وتحديد:
1. هل هو رد على الدعوة (RSVP)؟
2. إذا كان كذلك، ما هي الحالة؟ (مؤكد/معتذر/ربما)
3. هل ذكر عدد المرافقين؟
4. أي ملاحظات إضافية؟

${guestName ? `اسم الضيف: ${guestName}` : ''}
نص الرد: "${replyText}"

قم بالرد بصيغة JSON فقط، بدون أي نص إضافي:
{
  "is_rsvp": true/false,
  "status": "confirmed"/"declined"/"maybe"/null,
  "confidence": 0.0-1.0,
  "companion_count": عدد المرافقين (0 إذا لم يذكر),
  "notes": "ملاحظات إضافية أو null",
  "reasoning": "سبب التصنيف"
}

أمثلة:
- "إن شاء الله حاضرين" → confirmed, confidence: 0.95
- "شكراً على الدعوة، لكن للأسف ما نقدر نحضر" → declined, confidence: 0.9
- "ممكن، بشوف الظروف" → maybe, confidence: 0.8
- "حاضرين أنا وزوجتي" → confirmed, companion_count: 1, confidence: 0.95
- "شكراً" → is_rsvp: false (رد عام، ليس RSVP)
- "متى الموعد؟" → is_rsvp: false (سؤال، ليس RSVP)

تحليلك:`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to extract JSON from AI response');
            }

            const analysis = JSON.parse(jsonMatch[0]);

            // Validate and normalize
            return {
                is_rsvp: Boolean(analysis.is_rsvp),
                status: analysis.status || null,
                confidence: Math.max(0, Math.min(1, parseFloat(analysis.confidence) || 0)),
                companion_count: parseInt(analysis.companion_count) || 0,
                notes: analysis.notes || null,
                reasoning: analysis.reasoning || ''
            };

        } catch (error) {
            console.error('Error analyzing reply:', error);

            // Fallback: Simple keyword matching
            return this.fallbackAnalysis(replyText);
        }
    }

    /**
     * Fallback analysis using simple keyword matching
     */
    fallbackAnalysis(replyText) {
        const text = replyText.toLowerCase();

        // Confirmed keywords
        const confirmedKeywords = [
            'حاضر', 'موافق', 'إن شاء الله', 'أكيد', 'نحضر', 'حضور',
            'yes', 'sure', 'definitely', 'will attend'
        ];

        // Declined keywords
        const declinedKeywords = [
            'معتذر', 'آسف', 'ما نقدر', 'ما أقدر', 'للأسف', 'مشغول',
            'no', 'sorry', 'cannot', 'can\'t', 'unable'
        ];

        // Maybe keywords
        const maybeKeywords = [
            'ممكن', 'ربما', 'بشوف', 'محتمل', 'غير متأكد',
            'maybe', 'perhaps', 'might', 'not sure'
        ];

        // Check for confirmed
        if (confirmedKeywords.some(keyword => text.includes(keyword))) {
            return {
                is_rsvp: true,
                status: 'confirmed',
                confidence: 0.7,
                companion_count: 0,
                notes: null,
                reasoning: 'Keyword match (fallback)'
            };
        }

        // Check for declined
        if (declinedKeywords.some(keyword => text.includes(keyword))) {
            return {
                is_rsvp: true,
                status: 'declined',
                confidence: 0.7,
                companion_count: 0,
                notes: null,
                reasoning: 'Keyword match (fallback)'
            };
        }

        // Check for maybe
        if (maybeKeywords.some(keyword => text.includes(keyword))) {
            return {
                is_rsvp: true,
                status: 'maybe',
                confidence: 0.6,
                companion_count: 0,
                notes: null,
                reasoning: 'Keyword match (fallback)'
            };
        }

        // Not an RSVP
        return {
            is_rsvp: false,
            status: null,
            confidence: 0.5,
            companion_count: 0,
            notes: replyText,
            reasoning: 'No RSVP keywords found'
        };
    }

    /**
     * Batch analyze multiple replies
     */
    async analyzeReplies(replies) {
        const results = [];

        for (const reply of replies) {
            const analysis = await this.analyzeReply(
                reply.reply_text,
                reply.guest_name
            );

            results.push({
                ...reply,
                analysis
            });

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return results;
    }
}

// Singleton instance
const rsvpAI = new RSVPAIService();

export default rsvpAI;
