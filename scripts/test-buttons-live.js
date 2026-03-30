
import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony';
// Use a test phone number - Replace with your own for testing
const TEST_PHONE = '966503678789';

async function testButtons() {
    console.log(`🧪 Testing Button Delivery for ${INSTANCE_NAME}...`);

    const payload = {
        number: TEST_PHONE,
        title: "تأكيد حضور المناسبة",
        description: "نسعد بتشريفك لنا في هذه المناسبة السعيدة. يرجى تأكيد حضورك أدناه:",
        footer: "منصة لوني للدعوات",
        buttons: [
            {
                "type": "reply",
                "displayText": "تأكيد الحضور ✅",
                "id": "accept_rsvp"
            },
            {
                "type": "reply",
                "displayText": "اعتذار ❌",
                "id": "decline_rsvp"
            }
        ]
    };

    try {
        const response = await fetch(`${EVOLUTION_URL}/message/sendButtons/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('✅ Button Send Result:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error testing buttons:', error.message);
    }
}

testButtons();
