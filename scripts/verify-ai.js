
import fetch from 'node-fetch';

async function testAI() {
    console.log("🚀 Testing AI Endpoint...");
    try {
        const response = await fetch('http://localhost:3001/api/whatsapp/generate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: 'test-event-id', // Mock ID
                context: 'invite for wedding',
                tone: 'formal'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Response:", data);

        if (data.success && data.message) {
            console.log("✨ Generated Message:", data.message);
        } else {
            console.error("❌ Failed:", data);
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testAI();
