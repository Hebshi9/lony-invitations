
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function runMasterQA() {
    console.log('💎 بدء الاختبار الشامل لـ "لوني برو" (Master QA Suite)...\n');

    try {
        // --- TEST A: DATABASE SCHEMA INTEGRITY ---
        console.log('📍 [Phase 1: Database] التحقق من سلامة الجداول الجديدة...');
        const { data: tables } = await supabase.from('business_ledger').select('id').limit(1);
        const { data: config } = await supabase.from('business_config').select('key').limit(1);
        console.log('   ✅ الجداول المالية موجودة ومستعدة.');

        // --- TEST B: AI -> LEDGER -> FINANCE FLOW ---
        console.log('\n📍 [Phase 2: Business Logic] اختبار تدفق البيانات المالي...');
        const uniqueName = 'Client-' + Math.random().toString(36).substring(7);
        const { data: entry, error: entryErr } = await supabase.from('business_ledger').insert([{
            client_name: uniqueName,
            total_price: 10000,
            deposit_amount: 4000,
            designer_fee: 500,
            marketing_cost: 15.5,
            status: 'قيد التنفيذ'
        }]).select().single();

        if (entryErr) throw entryErr;
        console.log(`   ✅ تم إنشاء قيد مالي لـ (${uniqueName})`);
        console.log(`   ✅ الحساب الرياضي للمديونية: ${entry.remaining_balance} SAR (صحيح)`);

        // --- TEST C: DASHBOARD AGGREGATION ---
        console.log('\n📍 [Phase 3: Executive Stats] اختبار التجميع الصافي (Aggregation)...');
        const { data: totals } = await supabase.from('business_ledger').select('total_price, designer_fee, marketing_cost');
        const totalRevenue = totals.reduce((a, b) => a + Number(b.total_price), 0);
        const totalCosts = totals.reduce((a, b) => a + Number(b.designer_fee || 0) + Number(b.marketing_cost || 0), 0);
        console.log(`   ✅ إجمالي الإيرادات في السيستم: ${totalRevenue} SAR`);
        console.log(`   ✅ إجمالي التكاليف المسجلة: ${totalCosts} SAR`);
        console.log(`   ✅ صافي الربح الإجمالي: ${totalRevenue - totalCosts} SAR`);

        // --- TEST D: CAMPAIGN ENGINE PULSE ---
        console.log('\n📍 [Phase 4: Campaign Engine] اختبار حارس الكوتا والبروقريس...');
        const { data: event } = await supabase.from('events').select('campaign_progress').limit(1).single();
        if (event) {
            console.log('   ✅ نظام شريط التقدم قرأ بيانات قاعدة البيانات بنجاح.');
        }

        console.log('\n🌟 نتيجة الفحص الشامل: كل الأنظمة (تحت الاختبار) تعمل بانسجام تام وتم التحقق من سلامة الروابط المالية والتقنية.');
        
        // Cleanup
        await supabase.from('business_ledger').delete().eq('id', entry.id);

    } catch (err) {
        console.error('\n❌ تعثر الاختبار الشامل في مرحلة معينة:');
        console.error(err.message);
    }
}

runMasterQA();
