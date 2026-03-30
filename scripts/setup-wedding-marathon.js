
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupWeddingMarathon() {
    console.log('💎 Starting Lony Wedding Marathon Setup (28 Cases)...');

    // 1. Create a Master Event
    const now = new Date();
    const eventId = uuidv4();
    const { error: eventError } = await supabase.from('events').insert({
        id: eventId,
        name: '👑 حفل زفاف لوني الملكي (Real QA)',
        date: '2026-03-29',
        location: 'فندق الريتز كارلتون، الرياض',
        qr_activation_enabled: true,
        host_pin: '1234', // Fixed PIN for testing
        qr_active_from: new Date(now.getTime() + 240000).toISOString(), // Starts in exactly 4 minutes
        qr_active_until: new Date(now.getTime() + 86400000).toISOString(),
        features: {
            enable_host_pin: true,
            qr_time_restricted: true,
            enable_registration: false
        }
    });

    if (eventError) {
        console.error('❌ Failed to create event:', eventError);
        return;
    }

    console.log(`✅ Event Created: ${eventId}`);

    // 2. Define Test Cases (28 total)
    const testCases = [
        // Category A: Basic Auto Check-in (Starts in 4 mins)
        { name: 'A-01: الضيف الأول (عداد 4 دقائق)', token: 'qa-timer-4m', attended: false, companions: 0 },
        { name: 'A-02: ضيف مع مرافقين (عداد 4 دقائق)', token: 'qa-timer-comp', attended: false, companions: 3 },
        
        // Category B: PIN Protected (Ultimate Guard)
        { name: 'B-01: حماية PIN (عداد 4 دقائق)', token: 'qa-pin-timer', attended: false, companions: 0 },
        { name: 'B-02: حماية PIN (نشط حالياً)', token: 'qa-pin-active', attended: false, companions: 2, active_now: true },
        
        // Category C: Status Edge Cases
        { name: 'C-01: ضيف حاضر مسبقاً', token: 'qa-attended', attended: true, companions: 1 },
        { name: 'C-04: كود منتهي الصلاحية', token: 'qa-expired', attended: false, companions: 0, expired: true },
        
        // Category D: Hybrid "Violent" Cases
        { name: 'D-01: Triple Hybrid (PIN + Restricted + 5 Comp)', token: 'qa-violent-01', attended: false, companions: 5 },
        { name: 'D-02: Restricted + NO PIN', token: 'qa-restricted-nopin', attended: false, companions: 0 },
        
        // Remaining 20 cases will be variations of Category D and A for volume
    ];

    // Filling up to 28 cases
    for (let i = 9; i <= 28; i++) {
        testCases.push({
            name: `Case-${i}: Variant Testing`,
            token: `qa-batch-${i}`,
            attended: false,
            companions: Math.floor(Math.random() * 6),
            active_now: i % 3 === 0
        });
    }

    const testResults = [];

    for (const tc of testCases) {
        let activeFrom = new Date(now.getTime() + 240000).toISOString();
        let activeUntil = new Date(now.getTime() + 864000000).toISOString();

        if (tc.active_now) {
            activeFrom = new Date(now.getTime() - 3600000).toISOString();
        }
        if (tc.expired) {
            activeFrom = new Date(now.getTime() - 7200000).toISOString();
            activeUntil = new Date(now.getTime() - 3600000).toISOString();
        }

        const guestId = uuidv4();
        // For individual test cases that need specific event settings, we could create unique events
        // but for speed, let's use the one master event and just vary guest props if needed.
        // Wait, timing is an EVENT property. So we need multiple events for different timing states.

        let currentEventId = eventId;
        if (tc.active_now || tc.expired) {
            currentEventId = uuidv4();
            await supabase.from('events').insert({
                id: currentEventId,
                name: tc.name, // Specific name for specific timing
                date: '2026-03-29',
                qr_activation_enabled: true,
                host_pin: '1234',
                qr_active_from: activeFrom,
                qr_active_until: activeUntil,
                features: {
                    enable_host_pin: tc.name.includes('PIN'),
                    qr_time_restricted: true
                }
            });
        }

        const { error: guestError } = await supabase.from('guests').insert({
            id: guestId,
            event_id: currentEventId,
            name: tc.name,
            qr_token: tc.token,
            attended: tc.attended,
            companions_count: tc.companions,
            companions_attended: tc.attended ? tc.companions : 0
        });

        if (guestError) {
            console.error(`❌ Guest failed: ${tc.name}`, guestError);
        } else {
            testResults.push({
                ID: tc.name,
                URL: `http://localhost:5173/check-in/${tc.token}`
            });
        }
    }

    console.log('\n--- 🚀 LONY TEST PORTFOLIO (28 CASES) ---');
    console.table(testResults);
    console.log('\n💎 Test Suite Ready. Start testing now.');
}

setupWeddingMarathon();
