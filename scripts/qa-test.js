/**
 * 🧪 SMART QA TEST — Full End-to-End WhatsApp System Test
 * يختبر كل شي بدون متصفح — أسرع 100x
 * 
 * Usage: node scripts/qa-test.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API_URL = 'http://localhost:3001/api/whatsapp';
const WEBHOOK_URL = 'http://localhost:3001/webhook';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

// ===================== HELPERS =====================
function log(emoji, msg) { console.log(`${emoji}  ${msg}`); }
function header(title) { console.log(`\n${'═'.repeat(50)}\n  ${title}\n${'═'.repeat(50)}`); }

async function test(name, fn) {
    totalTests++;
    try {
        await fn();
        passed++;
        log('✅', `${name}`);
    } catch (e) {
        failed++;
        failures.push({ name, error: e.message });
        log('❌', `${name} — ${e.message}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

async function fetchJSON(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return res.json();
}

// ===================== TESTS =====================

header('1️⃣  SERVER HEALTH');

await test('Server is running', async () => {
    const res = await fetchJSON('http://localhost:3001/');
    assert(res.status === 'running', `Expected "running", got "${res.status}"`);
});

await test('Accounts endpoint works', async () => {
    const res = await fetchJSON(`${API_URL}/accounts`);
    assert(res.success === true, 'Accounts fetch failed');
    assert(Array.isArray(res.accounts), 'No accounts array');
    log('📋', `  Found ${res.accounts.length} account(s). Connected: ${res.accounts.filter(a => a.connected).length}`);
});

// =====================================================
header('2️⃣  DATABASE — client_phone Column');

await test('client_phone column exists in events', async () => {
    const { data, error } = await supabase.from('events').select('client_phone').limit(1);
    assert(!error, `Error: ${error?.message}`);
    log('📋', `  client_phone column exists ✓`);
});

await test('rsvp_cycle_status column exists', async () => {
    const { data, error } = await supabase.from('events').select('rsvp_cycle_status').limit(1);
    assert(!error, `Error: ${error?.message}`);
});

await test('guest_replacements table exists', async () => {
    const { data, error } = await supabase.from('guest_replacements').select('id').limit(1);
    assert(!error, `Error: ${error?.message}`);
});

// =====================================================
header('3️⃣  EVENTS & GUESTS DATA');

// Find a test event
const { data: events } = await supabase.from('events').select('id, name, client_phone').order('created_at', { ascending: false }).limit(5);
log('📋', `  Found ${events?.length || 0} events`);

let testEventId = events?.[0]?.id;
let testEventName = events?.[0]?.name;

if (testEventId) {
    log('🎯', `  Using event: "${testEventName}" (${testEventId.substring(0, 8)}...)`);

    await test('Can save client_phone to event', async () => {
        const { error } = await supabase.from('events').update({ client_phone: '0501234567' }).eq('id', testEventId);
        assert(!error, `Error: ${error?.message}`);

        const { data: check } = await supabase.from('events').select('client_phone').eq('id', testEventId).single();
        assert(check?.client_phone === '0501234567', `Expected 0501234567, got ${check?.client_phone}`);
    });

    const { data: guests } = await supabase.from('guests').select('id, name, phone, rsvp_status, card_image_url').eq('event_id', testEventId).limit(10);
    log('📋', `  Found ${guests?.length || 0} guests in this event`);

    if (guests?.length > 0) {
        const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
        const declined = guests.filter(g => g.rsvp_status === 'declined').length;
        const pending = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length;
        log('📊', `  RSVP: ✅${confirmed} ❌${declined} ⏳${pending}`);
    }
} else {
    log('⚠️', '  No events found — skipping event-specific tests');
}

// =====================================================
header('4️⃣  API ENDPOINTS');

await test('Generate AI message works', async () => {
    const res = await fetchJSON(`${API_URL}/generate-message`, {
        method: 'POST',
        body: JSON.stringify({ context: 'حفل تخرج', tone: 'formal' })
    });
    assert(res.success === true, `AI generation failed: ${res.error || 'unknown'}`);
    assert(res.message?.length > 10, 'Generated message too short');
    log('📝', `  Generated: "${res.message.substring(0, 60)}..."`);
});

if (testEventId) {
    await test('Prepare messages endpoint works', async () => {
        const res = await fetchJSON(`${API_URL}/prepare-messages`, {
            method: 'POST',
            body: JSON.stringify({
                eventId: testEventId,
                template: 'تجربة QA: يا هلا {{name}} 🌹',
                messagePhase: 'invite',
                filters: { rsvp_status: 'all' }
            })
        });
        assert(res.success === true, `Prepare failed: ${res.error || 'unknown'}`);
        log('📋', `  Prepared ${res.count} messages`);

        // Clean up test messages
        if (res.count > 0) {
            await supabase.from('whatsapp_messages')
                .delete()
                .eq('event_id', testEventId)
                .eq('message_phase', 'invite')
                .eq('status', 'pending')
                .like('message_text', '%تجربة QA%');
            log('🧹', `  Cleaned up test messages`);
        }
    });
}

await test('Status endpoint works', async () => {
    const res = await fetchJSON(`${API_URL}/status`);
    assert(res.success === true, 'Status failed');
    assert(typeof res.status.isRunning === 'boolean', 'Missing isRunning');
});

// =====================================================
header('5️⃣  WEBHOOK HANDLER (Simulated)');

await test('Webhook accepts POST', async () => {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'connection.update', data: {} })
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
});

await test('Webhook ignores non-message events', async () => {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'STATUS_UPDATE',
            data: { key: { remoteJid: '966500000000@s.whatsapp.net' } }
        })
    });
    assert(res.status === 200, 'Should return 200');
});

await test('Webhook handles MESSAGES_UPSERT (uppercase)', async () => {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'MESSAGES_UPSERT',
            instance: 'test_instance',
            data: {
                key: { remoteJid: '966599999999@s.whatsapp.net', fromMe: false },
                message: { conversation: 'مرحبا هذا تيست' }
            }
        })
    });
    assert(res.status === 200, 'Should return 200');
});

await test('Webhook handles messages.upsert (lowercase)', async () => {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'messages.upsert',
            instance: 'test_instance',
            data: {
                key: { remoteJid: '966599999999@s.whatsapp.net', fromMe: false },
                message: { conversation: 'تيست 2' }
            }
        })
    });
    assert(res.status === 200, 'Should return 200');
});

await test('Webhook ignores fromMe messages', async () => {
    const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'MESSAGES_UPSERT',
            instance: 'test_instance',
            data: {
                key: { remoteJid: '966599999999@s.whatsapp.net', fromMe: true },
                message: { conversation: 'this should be ignored' }
            }
        })
    });
    assert(res.status === 200, 'Should return 200');
});

// =====================================================
header('6️⃣  RSVP DETECTION (Number Mapping)');

// Create a temporary test guest
let testGuestId = null;
if (testEventId) {
    const { data: testGuest, error } = await supabase.from('guests').insert({
        event_id: testEventId,
        name: 'QA Test Guest',
        phone: '966500000001',
        qr_payload: `qa-test-${Date.now()}`,
        status: 'pending',
        rsvp_status: null
    }).select().single();

    if (!error && testGuest) {
        testGuestId = testGuest.id;
        log('👤', `  Created test guest: ${testGuest.name} (${testGuestId.substring(0, 8)}...)`);

        await test('RSVP: "1" triggers confirmation', async () => {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'MESSAGES_UPSERT',
                    instance: 'test_instance',
                    data: {
                        key: { remoteJid: '966500000001@s.whatsapp.net', fromMe: false },
                        message: { conversation: '1' }
                    }
                })
            });

            // Wait for webhook to process
            await new Promise(r => setTimeout(r, 2000));

            const { data: guest } = await supabase.from('guests').select('rsvp_status').eq('id', testGuestId).single();
            assert(guest?.rsvp_status === 'confirmed', `Expected "confirmed", got "${guest?.rsvp_status}"`);
        });

        // Reset for next test
        await supabase.from('guests').update({ rsvp_status: null }).eq('id', testGuestId);

        await test('RSVP: "٢" (Arabic 2) triggers decline', async () => {
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'MESSAGES_UPSERT',
                    instance: 'test_instance',
                    data: {
                        key: { remoteJid: '966500000001@s.whatsapp.net', fromMe: false },
                        message: { conversation: '٢' }
                    }
                })
            });
            await new Promise(r => setTimeout(r, 2000));

            const { data: guest } = await supabase.from('guests').select('rsvp_status').eq('id', testGuestId).single();
            assert(guest?.rsvp_status === 'declined', `Expected "declined", got "${guest?.rsvp_status}"`);
        });

        // Cleanup test guest
        await supabase.from('guests').delete().eq('id', testGuestId);
        await supabase.from('whatsapp_replies').delete().eq('guest_id', testGuestId).catch(() => { });
        await supabase.from('whatsapp_rsvp').delete().eq('guest_id', testGuestId).catch(() => { });
        log('🧹', `  Cleaned up test guest`);
    }
}

// Reset client_phone
if (testEventId) {
    await supabase.from('events').update({ client_phone: null }).eq('id', testEventId);
}

// =====================================================
header('📊  FINAL RESULTS');

console.log(`\n  Total:  ${totalTests}`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);

if (failures.length > 0) {
    console.log('\n  ❌ FAILURES:');
    for (const f of failures) {
        console.log(`    • ${f.name}: ${f.error}`);
    }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(failed === 0 ? '  🎉 ALL TESTS PASSED!' : `  ⚠️ ${failed} TEST(S) FAILED`);
console.log(`${'═'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
