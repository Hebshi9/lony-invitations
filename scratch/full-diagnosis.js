import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fullDiagnosis() {
    console.log("═══════════════════════════════════════════════════");
    console.log("   🔬 تشخيص كامل لمشكلة الإرسال على Netlify Live");
    console.log("═══════════════════════════════════════════════════\n");

    // 1. Check which columns EXIST in events table
    const { data: sample, error: sampleErr } = await supabase.from('events').select('*').limit(1);
    const existingColumns = sample && sample[0] ? Object.keys(sample[0]) : [];
    console.log("📋 أعمدة جدول events الموجودة فعلاً:");
    console.log(existingColumns.join(', '));

    // 2. Check SPECIFIC columns used by send-campaign-background.mjs
    const requiredColumns = ['campaign_status', 'campaign_jitter_override', 'campaign_progress', 'template_name'];
    console.log("\n🔍 فحص الأعمدة المطلوبة من محرك الإرسال:");
    for (const col of requiredColumns) {
        const exists = existingColumns.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? 'موجود' : '⚠️ مفقود!'}`);
    }

    // 3. Simulate the EXACT update that fails in the background function (line 56-63)
    console.log("\n🧪 محاكاة تحديث campaign_status (نفس ما يفعله محرك الإرسال):");
    const eventId = sample?.[0]?.id;
    if (eventId) {
        const { error: updateErr } = await supabase.from('events').update({ 
            campaign_status: 'sending',
            campaign_progress: { current_name: "تجربة...", count: 0, total: 1 }
        }).eq('id', eventId);
        
        if (updateErr) {
            console.log(`  ❌ فشل التحديث: ${updateErr.message}`);
            console.log(`  📌 هذا هو بالضبط السبب في فشل الإرسال!`);
        } else {
            console.log("  ✅ التحديث نجح");
        }
    }

    // 4. Test update with campaign_progress ONLY (without campaign_status)
    console.log("\n🧪 محاكاة تحديث campaign_progress فقط (بدون campaign_status):");
    if (eventId) {
        const { error: updateErr2 } = await supabase.from('events').update({ 
            campaign_progress: { current_name: "تجربة بدون status", count: 0, total: 1 }
        }).eq('id', eventId);
        
        if (updateErr2) {
            console.log(`  ❌ فشل أيضاً: ${updateErr2.message}`);
        } else {
            console.log("  ✅ نجح! (هذا يثبت أن campaign_progress يعمل لوحده)");
        }
    }

    // 5. Check Meta token
    console.log("\n🔑 فحص توكن Meta:");
    try {
        const res = await fetch('https://graph.facebook.com/v21.0/me', {
            headers: { 'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}` }
        });
        const data = await res.json();
        console.log(`  ${res.ok ? '✅' : '❌'} Token: ${res.ok ? 'صالح' : 'منتهي'} - ${JSON.stringify(data)}`);
    } catch (e) {
        console.log(`  ❌ خطأ في الاتصال: ${e.message}`);
    }

    // Summary
    const missingCols = requiredColumns.filter(c => !existingColumns.includes(c));
    console.log("\n═══════════════════════════════════════════════════");
    console.log("   📊 النتيجة النهائية");
    console.log("═══════════════════════════════════════════════════");
    if (missingCols.length > 0) {
        console.log(`\n🚨 السبب المؤكد: الأعمدة التالية مفقودة من جدول events:`);
        console.log(`   ${missingCols.join(', ')}`);
        console.log(`\n💊 الحل: نفذ هذا في Supabase SQL Editor:`);
        for (const col of missingCols) {
            if (col === 'campaign_status') {
                console.log(`   ALTER TABLE events ADD COLUMN campaign_status text DEFAULT 'idle';`);
            } else if (col === 'campaign_jitter_override') {
                console.log(`   ALTER TABLE events ADD COLUMN campaign_jitter_override integer;`);
            } else if (col === 'template_name') {
                console.log(`   ALTER TABLE events ADD COLUMN template_name text DEFAULT 'lony';`);
            }
        }
    } else {
        console.log("\n✅ جميع الأعمدة موجودة. المشكلة في مكان آخر.");
    }
}

fullDiagnosis();
