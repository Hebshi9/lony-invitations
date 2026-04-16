/**
 * AI Service - V2
 * OpenAI powered Sales and RSVP logic.
 */
import OpenAI from 'openai';
import 'dotenv/config';

class AIService {
    constructor() {
        this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    async analyzeIntent(message) {
        if (!process.env.OPENAI_API_KEY) return { intent: 'unknown', response: null };

        try {
            const completion = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Analyze user intent for a luxury invitation service. Intents: inquiry, confirm, decline, change_info." },
                    { role: "user", content: message }
                ],
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            console.error('[AIService] Error:', e.message);
            return { intent: 'error', error: e.message };
        }
    }
}

export default new AIService();
