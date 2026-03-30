import rsvpAI from './src/services/rsvp-ai-service.js';
import dotenv from 'dotenv';

dotenv.config();

const dialectWords = [
    'أبشر',
    'قدام',
    'تم',
    'حاضرين',
    'بإذن الله نكون موجودين',
    'ما اقدر والله عندي ظروف',
    'العذر والسموحة ما يمديني',
    'حياك الله',
    'تسلم',
    'الخطة قدام'
];

async function testDialect() {
    console.log('--- Testing Dialect RSVP Analysis ---');
    for (const word of dialectWords) {
        console.log(`\nInput: "${word}"`);
        try {
            const result = await rsvpAI.analyzeReply(word, 'احمد', 'نتمنى حضورك لمناسبتنا');
            console.log(`Status: ${result.status} | Confidence: ${result.confidence} | is_rsvp: ${result.is_rsvp}`);
            console.log(`Reasoning: ${result.reasoning}`);
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
}

testDialect();
