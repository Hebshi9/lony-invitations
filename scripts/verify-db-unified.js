// =====================================================================================================
// Database Verification & Update Script
// =====================================================================================================
// يتحقق من الاتصال بقاعدة البيانات ويعرض حالة الجداول والحقول
// =====================================================================================================

// =====================================================================================================
// Fix: Use dynamic import for ES modules in Node.js
// =====================================================================================================

console.log('🔍 التحقق من اتصال قاعدة البيانات...\n');

async function verifyDatabase() {
    // Dynamic import for ES modules
    const { supabase } = await import('../src/lib/supabaseClient.js');

    try {
        // ============================================
        // 1. Test Connection
        // ============================================
        console.log('1️⃣ اختبار الاتصال...');
        const { data: testData, error: testError } = await supabase
            .from('events')
            .select('count')
            .limit(1);

        if (testError) {
            console.error('❌ فشل الاتصال:', testError.message);
            return;
        }

        console.log('✅ الاتصال ناجح!\n');

        // ============================================
        // 2. Check Events Table
        // ============================================
        console.log('2️⃣ فحص جدول Events...');
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('*')
            .limit(1);

        if (eventsError) {
            console.error('❌ خطأ:', eventsError.message);
        } else {
            console.log('✅ جدول Events موجود');
            if (events && events.length > 0) {
                const eventFields = Object.keys(events[0]);
                console.log('📋 الحقول الموجودة:', eventFields.join(', '));

                // Check for new fields
                const newFields = ['location_lat', 'location_lng', 'location_maps_url', 'wifi_ssid', 'wifi_password', 'wifi_security'];
                const missingFields = newFields.filter(f => !eventFields.includes(f));

                if (missingFields.length > 0) {
                    console.log('⚠️  الحقول الناقصة:', missingFields.join(', '));
                    console.log('➡️  يجب تشغيل: UNIFIED_STUDIO_SCHEMA.sql');
                } else {
                    console.log('✅ جميع الحقول الجديدة موجودة!');
                }
            } else {
                console.log('ℹ️  الجدول فارغ (لا يوجد أحداث بعد)');
            }
        }
        console.log('');

        // ============================================
        // 3. Check Guests Table
        // ============================================
        console.log('3️⃣ فحص جدول Guests...');
        const { data: guests, error: guestsError } = await supabase
            .from('guests')
            .select('*')
            .limit(1);

        if (guestsError) {
            console.error('❌ خطأ:', guestsError.message);
        } else {
            console.log('✅ جدول Guests موجود');
            if (guests && guests.length > 0) {
                const guestFields = Object.keys(guests[0]);
                console.log('📋 الحقول الموجودة:', guestFields.join(', '));

                // Check for new fields
                const newFields = ['serial', 'category', 'card_generated', 'card_downloaded', 'attended_at'];
                const missingFields = newFields.filter(f => !guestFields.includes(f));

                if (missingFields.length > 0) {
                    console.log('⚠️  الحقول الناقصة:', missingFields.join(', '));
                    console.log('➡️  يجب تشغيل: UNIFIED_STUDIO_SCHEMA.sql');
                } else {
                    console.log('✅ جميع الحقول الجديدة موجودة!');
                }
            } else {
                console.log('ℹ️  الجدول فارغ (لا يوجد ضيوف بعد)');
            }
        }
        console.log('');

        // ============================================
        // 4. Count Records
        // ============================================
        console.log('4️⃣ إحصائيات البيانات...');

        const { count: eventsCount } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true });

        const { count: guestsCount } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true });

        const { count: scansCount } = await supabase
            .from('scans')
            .select('*', { count: 'exact', head: true });

        console.log(`📊 Events: ${eventsCount || 0}`);
        console.log(`📊 Guests: ${guestsCount || 0}`);
        console.log(`📊 Scans: ${scansCount || 0}`);
        console.log('');

        // ============================================
        // 5. Check New Tables
        // ============================================
        console.log('5️⃣ فحص الجداول الجديدة...');

        // Check card_templates
        const { error: templatesError } = await supabase
            .from('card_templates')
            .select('count')
            .limit(1);

        if (templatesError) {
            console.log('⚠️  card_templates: غير موجود');
            console.log('➡️  يجب تشغيل: UNIFIED_STUDIO_SCHEMA.sql');
        } else {
            console.log('✅ card_templates: موجود');
        }

        // Check export_jobs
        const { error: exportError } = await supabase
            .from('export_jobs')
            .select('count')
            .limit(1);

        if (exportError) {
            console.log('⚠️  export_jobs: غير موجود');
            console.log('➡️  يجب تشغيل: UNIFIED_STUDIO_SCHEMA.sql');
        } else {
            console.log('✅ export_jobs: موجود');
        }

        console.log('');

        // ============================================
        // Summary
        // ============================================
        console.log('═══════════════════════════════════════');
        console.log('📌 الملخص:');
        console.log('═══════════════════════════════════════');
        console.log('✅ الاتصال بقاعدة البيانات: ناجح');
        console.log('✅ Supabase URL:', supabase.supabaseUrl);
        console.log('');
        console.log('📝 التوصيات:');
        if (missingFields.length > 0 || templatesError || exportError) {
            console.log('⚠️  يوجد تحديثات مطلوبة!');
            console.log('');
            console.log('قم بتنفيذ الخطوات التالية:');
            console.log('1. افتح Supabase SQL Editor');
            console.log('2. انسخ محتوى: supabase/UNIFIED_STUDIO_SCHEMA.sql');
            console.log('3. الصقه وشغّله');
        } else {
            console.log('✅ قاعدة البيانات محدثة ومهيئة بالكامل!');
            console.log('✅ يمكنك البدء باستخدام /studio مباشرة!');
        }
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ خطأ غير متوقع:', error);
    }
}

// Run verification
verifyDatabase();
