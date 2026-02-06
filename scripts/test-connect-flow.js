// Test connection endpoint
async function testConnect() {
    const accountId = '33d6b1c6-7526-4cf1-965f-bf18521e243c'; // Lony Client (7344)

    console.log('🧪 Testing WhatsApp Connection Flow\n');

    // Step 1: Call connect
    console.log('1️⃣ Calling /connect...');
    try {
        const res = await fetch(`http://localhost:3001/api/whatsapp/connect/${accountId}`, {
            method: 'POST'
        });
        const data = await res.json();
        console.log('   Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('   ❌ Error:', e.message);
        return;
    }

    // Step 2: Wait a bit
    console.log('\n2️⃣ Waiting 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));

    // Step 3: Check QR status
    console.log('\n3️⃣ Checking /qr-status...');
    try {
        const res = await fetch(`http://localhost:3001/api/whatsapp/qr-status/${accountId}`);
        const data = await res.json();
        console.log('   Response:', JSON.stringify(data, null, 2));

        if (data.qr) {
            console.log('\n   ✅ QR Code received! Length:', data.qr.length);
        } else {
            console.log('\n   ⚠️  No QR code yet');
        }
    } catch (e) {
        console.log('   ❌ Error:', e.message);
    }

    console.log('\n✅ Test Complete\n');
}

testConnect();
