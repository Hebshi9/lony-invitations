import 'dotenv/config'; // Load .env
import rsvpAI from '../src/services/rsvp-ai-service.js';

const testCases = [
    { text: "الله يحييكم", name: "Guest1" }, // Confirmed (strong)
    { text: "تم", name: "Guest2" },          // Confirmed (short)
    { text: "ألف مبروك الله يوفقهم", name: "Guest3" }, // Prayer only -> Should NOT be confirmed
    { text: "وين الموقع؟", name: "Guest4" }, // Inquiry -> Should not be confirmed
    { text: "بشوف وأرد لكم", name: "Guest5" }, // Maybe
    { text: "اعتذر مرتبط", name: "Guest6" }, // Declined
    { text: "الله يوفقكم بس ما أقدر أحضر", name: "Guest7" }, // Declined w/ prayer
    { text: "👍", name: "Guest8" }, // Emoji -> Confirmed
    { text: "معي 3 أشخاص", name: "Guest9" } // Confirmed w/ count
];

console.log("🚀 Starting AI Simulation Test...\n");

async function runTests() {
    for (const test of testCases) {
        console.log(`----------------------------------------`);
        console.log(`📩 Input: "${test.text}"`);

        try {
            const result = await rsvpAI.analyzeReply(test.text, test.name);

            // Color code output
            const statusColor =
                result.status === 'confirmed' ? '\x1b[32m' : // Green
                    result.status === 'declined' ? '\x1b[31m' :  // Red
                        '\x1b[33m'; // Yellow

            console.log(`🤖 Analysis: ${statusColor}${result.status?.toUpperCase() || 'NULL'}\x1b[0m`);
            console.log(`📊 Confidence: ${result.confidence} ${result.confidence >= 0.8 ? '✅ (Auto-Send)' : '❌ (Manual Review)'}`);
            console.log(`💡 Reasoning: ${result.reasoning}`);

        } catch (error) {
            console.error("❌ Error:", error.message);
        }
    }
    console.log("\n----------------------------------------");
    console.log("✅ Simulation Complete.");
}

runTests();
