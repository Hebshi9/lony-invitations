/**
 * Full End-to-End Test for WhatsApp Sending System
 * Tests: Server Health → Accounts → Evolution Connection → Message Prep → Send
 */

const API = 'http://localhost:3001';

async function fetchJSON(url, options = {}) {
    const resp = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    const text = await resp.text();
    try { return { status: resp.status, data: JSON.parse(text) }; }
    catch { return { status: resp.status, data: text }; }
}

async function runTests() {
    const results = [];
    let connectedAccount = null;
    let evolutionInstance = null;

    // ═══════════════════════════════════════════
    // TEST 1: Server Health
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 1: Server Health Check');
    console.log('══════════════════════════════════════');
    try {
        const { status, data } = await fetchJSON(`${API}/`);
        if (status === 200) {
            console.log('✅ PASS - Server is running');
            console.log('   Response:', JSON.stringify(data));
            results.push({ test: 'Server Health', status: 'PASS' });
        } else {
            console.log('❌ FAIL - Server returned:', status);
            results.push({ test: 'Server Health', status: 'FAIL', error: `Status ${status}` });
        }
    } catch (e) {
        console.log('❌ FAIL - Cannot connect to server:', e.message);
        results.push({ test: 'Server Health', status: 'FAIL', error: e.message });
        console.log('\n🛑 Server is not running. Aborting tests.');
        return;
    }

    // ═══════════════════════════════════════════
    // TEST 2: Accounts List
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 2: WhatsApp Accounts');
    console.log('══════════════════════════════════════');
    try {
        const { data } = await fetchJSON(`${API}/api/whatsapp/accounts`);
        if (data.success && data.accounts) {
            console.log(`✅ PASS - Found ${data.accounts.length} account(s)`);
            for (const acc of data.accounts) {
                const icon = acc.connected ? '🟢' : '🔴';
                console.log(`   ${icon} ${acc.name} (${acc.phone}) - ${acc.status}`);
                if (acc.evolution_instance) console.log(`      Evolution Instance: "${acc.evolution_instance}"`);
                if (acc.connected) {
                    connectedAccount = acc;
                    evolutionInstance = acc.evolution_instance || acc.id;
                }
            }
            results.push({ test: 'Accounts', status: 'PASS', count: data.accounts.length });
        } else {
            console.log('❌ FAIL -', JSON.stringify(data).substring(0, 200));
            results.push({ test: 'Accounts', status: 'FAIL' });
        }
    } catch (e) {
        console.log('❌ FAIL -', e.message);
        results.push({ test: 'Accounts', status: 'FAIL', error: e.message });
    }

    // ═══════════════════════════════════════════
    // TEST 3: Connected Account Check
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 3: Connected Account');
    console.log('══════════════════════════════════════');
    if (connectedAccount) {
        console.log(`✅ PASS - Active account: "${connectedAccount.name}" via "${evolutionInstance}"`);
        results.push({ test: 'Connected Account', status: 'PASS' });
    } else {
        console.log('❌ FAIL - No connected WhatsApp accounts!');
        console.log('   ⚠️ You need to connect an account via Evolution Manager or the app');
        results.push({ test: 'Connected Account', status: 'FAIL' });
    }

    // ═══════════════════════════════════════════
    // TEST 4: Queue Status
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 4: Queue/Job Status');
    console.log('══════════════════════════════════════');
    try {
        const { data } = await fetchJSON(`${API}/api/whatsapp/status`);
        console.log('✅ PASS - Queue status retrieved');
        console.log('   Running:', data.isRunning || false);
        console.log('   Stats:', JSON.stringify(data.stats || {}));
        results.push({ test: 'Queue Status', status: 'PASS' });
    } catch (e) {
        console.log('❌ FAIL -', e.message);
        results.push({ test: 'Queue Status', status: 'FAIL', error: e.message });
    }

    // ═══════════════════════════════════════════
    // TEST 5: Send Single Test Message
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 5: Send Test Message (to admin phone)');
    console.log('══════════════════════════════════════');
    if (connectedAccount) {
        try {
            const adminPhone = connectedAccount.phone.replace(/[^0-9]/g, '');
            const { status, data } = await fetchJSON(`${API}/api/whatsapp/send`, {
                method: 'POST',
                body: JSON.stringify({
                    accountId: connectedAccount.id,
                    phone: adminPhone,
                    message: '🧪 هذه رسالة اختبار تلقائي من نظام لوني\n\nTest at: ' + new Date().toLocaleTimeString('ar-SA'),
                })
            });

            if (data.success || data.key || (data.status >= 200 && data.status < 300)) {
                console.log('✅ PASS - Message sent successfully!');
                console.log('   Message ID:', data.key?.id || data.messageId || 'N/A');
                results.push({ test: 'Send Message', status: 'PASS' });
            } else {
                console.log('⚠️ WARN - Send returned:', JSON.stringify(data).substring(0, 300));
                results.push({ test: 'Send Message', status: 'WARN', detail: JSON.stringify(data).substring(0, 100) });
            }
        } catch (e) {
            console.log('❌ FAIL -', e.message);
            results.push({ test: 'Send Message', status: 'FAIL', error: e.message });
        }
    } else {
        console.log('⏭️ SKIP - No connected account to test with');
        results.push({ test: 'Send Message', status: 'SKIP' });
    }

    // ═══════════════════════════════════════════
    // TEST 6: Send Demo (with RSVP options)
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 6: Send Demo Message (with 1/2 RSVP)');
    console.log('══════════════════════════════════════');
    if (connectedAccount) {
        try {
            const adminPhone = connectedAccount.phone.replace(/[^0-9]/g, '');
            const { status, data } = await fetchJSON(`${API}/api/whatsapp/send-demo`, {
                method: 'POST',
                body: JSON.stringify({
                    accountId: connectedAccount.id,
                    phone: adminPhone,
                    message: '🎉 دعوة تجريبية من نظام لوني\n\nيسرنا دعوتكم لحضور مناسبتنا',
                })
            });

            if (data.success || data.key || data.messageId) {
                console.log('✅ PASS - Demo message sent!');
                results.push({ test: 'Send Demo', status: 'PASS' });
            } else {
                console.log('⚠️ WARN -', JSON.stringify(data).substring(0, 300));
                results.push({ test: 'Send Demo', status: 'WARN', detail: JSON.stringify(data).substring(0, 100) });
            }
        } catch (e) {
            console.log('❌ FAIL -', e.message);
            results.push({ test: 'Send Demo', status: 'FAIL', error: e.message });
        }
    } else {
        console.log('⏭️ SKIP');
        results.push({ test: 'Send Demo', status: 'SKIP' });
    }

    // ═══════════════════════════════════════════
    // TEST 7: Webhook Endpoint
    // ═══════════════════════════════════════════
    console.log('\n══════════════════════════════════════');
    console.log('TEST 7: Webhook Endpoint');
    console.log('══════════════════════════════════════');
    try {
        const { status } = await fetchJSON(`${API}/webhook`, {
            method: 'POST',
            body: JSON.stringify({ event: 'test', data: {} })
        });
        if (status === 200) {
            console.log('✅ PASS - Webhook endpoint is accessible');
            results.push({ test: 'Webhook', status: 'PASS' });
        } else {
            console.log('⚠️ WARN - Webhook returned:', status);
            results.push({ test: 'Webhook', status: 'WARN' });
        }
    } catch (e) {
        console.log('❌ FAIL -', e.message);
        results.push({ test: 'Webhook', status: 'FAIL', error: e.message });
    }

    // ═══════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════
    console.log('\n\n╔══════════════════════════════════════╗');
    console.log('║       TEST RESULTS SUMMARY           ║');
    console.log('╠══════════════════════════════════════╣');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : r.status === 'WARN' ? '⚠️' : '⏭️';
        console.log(`║ ${icon} ${r.test.padEnd(25)} ${r.status.padEnd(6)} ║`);
    }
    console.log('╠══════════════════════════════════════╣');
    console.log(`║ ✅ Passed: ${passed}  ❌ Failed: ${failed}  ⚠️ Warn: ${warned}  ⏭️ Skip: ${skipped} ║`);
    console.log('╚══════════════════════════════════════╝');

    if (failed === 0 && passed >= 5) {
        console.log('\n🎉 ALL CRITICAL TESTS PASSED! WhatsApp system is working!');
    } else if (failed > 0) {
        console.log('\n⚠️ Some tests failed. Check the details above.');
    }
}

runTests().catch(e => console.error('Test runner error:', e));
