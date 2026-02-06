// Quick connection test
async function testAll() {
    console.log('🧪 Testing All Services\n');

    // Test WhatsApp Server
    console.log('1️⃣ Testing WhatsApp Server (port 3001)...');
    try {
        const res = await fetch('http://localhost:3001/api/whatsapp/accounts');
        const data = await res.json();
        console.log('   ✅ WhatsApp Server: OK');
        console.log('   Accounts:', data.accounts?.length || 0);
    } catch (e) {
        console.log('   ❌ WhatsApp Server: FAILED -', e.message);
    }

    // Test Frontend
    console.log('\n2️⃣ Testing Frontend (port 5173)...');
    try {
        const res = await fetch('http://localhost:5173');
        if (res.ok) {
            console.log('   ✅ Frontend: OK');
        } else {
            console.log('   ⚠️  Frontend: Status', res.status);
        }
    } catch (e) {
        console.log('   ❌ Frontend: FAILED -', e.message);
    }

    console.log('\n✅ Test Complete\n');
}

testAll();
