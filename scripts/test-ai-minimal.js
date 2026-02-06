
import rsvpAI from '../src/services/rsvp-ai-service.js';

async function testAI() {
    try {
        console.log('STARTING_TEST');
        const result = await rsvpAI.analyzeReply('تمام موافقين', 'User');
        if (result.reasoning.includes('fallback')) {
            console.log('FALLBACK_TRIGGERED');
        } else {
            console.log('SUCCESS_AI_RESPONSE');
        }
    } catch (e) {
        console.log('OUTER_ERROR');
    }
}
testAI();
