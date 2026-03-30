const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function audit() {
    console.log('============================================');
    console.log('  LONY INVITATIONS - FULL READINESS AUDIT');
    console.log('============================================\n');

    // 1. Database Connection
    console.log('--- 1. DATABASE CONNECTION ---');
    const tables = ['events', 'guests', 'scans'];
    for (const t of tables) {
        const { count, error } = await s.from(t).select('*', { count: 'exact', head: true });
        if (error) {
            console.log('  [FAIL] ' + t + ': ' + error.message);
        } else {
            console.log('  [OK] ' + t + ': ' + count + ' records');
        }
    }

    // 2. Latest Events & PIN Status
    console.log('\n--- 2. LATEST EVENTS & PIN STATUS ---');
    const { data: events } = await s.from('events').select('id, name, host_pin, features').order('created_at', { ascending: false }).limit(3);
    if (events) {
        events.forEach(function(e) {
            var pinEnabled = e.features && e.features.enable_host_pin ? true : false;
            var pinSet = e.host_pin ? 'YES (' + e.host_pin + ')' : 'NO';
            console.log('  Event: ' + e.name);
            console.log('    PIN Feature Enabled: ' + pinEnabled);
            console.log('    PIN Set: ' + pinSet);
            console.log('    Smart QR Route: ' + (pinEnabled && e.host_pin ? '/s/:token (SECURE)' : '/check-in.html (LEGACY)'));
            console.log('');
        });
    }

    // 3. Sample Guests
    console.log('--- 3. SAMPLE GUESTS (first event) ---');
    if (events && events[0]) {
        const { data: guests } = await s.from('guests').select('id, name, qr_token, companions_count, status, attended').eq('event_id', events[0].id).limit(5);
        if (guests) {
            guests.forEach(function(g) {
                console.log('  ' + g.name + ' | token: ' + (g.qr_token ? g.qr_token.substr(0, 8) + '...' : 'N/A') + ' | companions: ' + g.companions_count + ' | status: ' + g.status + ' | attended: ' + g.attended);
            });
        }
    }

    // 4. Feature System Check
    console.log('\n--- 4. FEATURE CHECK (first event) ---');
    if (events && events[0] && events[0].features) {
        var feats = events[0].features;
        var featureKeys = ['enable_host_pin', 'enable_simple_scan', 'require_inspector_app', 'enable_registration', 'privacy_mode', 'qr_time_restricted'];
        featureKeys.forEach(function(k) {
            console.log('  ' + k + ': ' + (feats[k] ? 'ON' : 'OFF'));
        });
    }

    // 5. Scans Check
    console.log('\n--- 5. RECENT SCANS ---');
    const { data: recentScans } = await s.from('scans').select('id, guest_id, scanned_at, scan_type').order('scanned_at', { ascending: false }).limit(3);
    if (recentScans && recentScans.length > 0) {
        recentScans.forEach(function(sc) {
            console.log('  Scan: ' + sc.scan_type + ' at ' + sc.scanned_at);
        });
    } else {
        console.log('  No scans recorded yet');
    }

    console.log('\n============================================');
    console.log('  AUDIT COMPLETE');
    console.log('============================================');
}

audit().catch(function(e) { console.error('Audit error:', e); });
