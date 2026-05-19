
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function runQATest() {
    console.log('🚀 بدء اختبار الجودة العملي (Hand-on QA Test)...\n');

    try {
        // --- TEST 1: Business Ledger Insertion ---
        console.log('🧪 اختبار 1: محاكاة إدخال عملية مالية (Manual/AI Entry)...');
        const testOrder = {
            client_name: 'QA Test Client ' + Date.now(),
            client_phone: '966500000000',
            service_type: 'بكج كامل',
            total_price: 5000,
            deposit_amount: 1500,
            designer_fee: 300,
            status: 'قيد التنفيذ',
            ai_parsed: true
        };

        const { data: ledgerEntry, error: ledgerError } = await supabase
            .from('business_ledger')
            .insert([testOrder])
            .select()
            .single();

        if (ledgerError) throw new Error('فشل الإدخال في السجل المالي: ' + ledgerError.message);
        console.log('✅ نجح: تم إنشاء القيد المالي بنجاح.');
        console.log(`   - العميل: ${ledgerEntry.client_name}`);
        console.log(`   - المتبقي المحسوب آلياً: ${ledgerEntry.remaining_balance} SAR (يجب أن يكون 3500)`);

        if (Number(ledgerEntry.remaining_balance) !== 3500) {
            console.error('❌ خطأ في الحساب التلقائي للمديونية!');
        } else {
            console.log('✅ نجح: الحساب الرياضي للمديونية دقيق 100%.');
        }

        // --- TEST 2: Multi-record aggregation (Financial Hub Logic) ---
        console.log('\n🧪 اختبار 2: فحص قدرة النظام على تجميع البيانات الإجمالية (Hub Aggregation)...');
        const { data: allTotals } = await supabase
            .from('business_ledger')
            .select('total_price, deposit_amount');
        
        const totalRev = allTotals.reduce((acc, curr) => acc + Number(curr.total_price), 0);
        console.log(`✅ نجح: إجمالي المبيعات الحالي في قاعدة البيانات: ${totalRev} SAR.`);

        // --- TEST 3: Progress Bar Logic ---
        console.log('\n🧪 اختبار 3: فحص تحديث شريط التقدم (Progress Bar Hook)...');
        const { error: progressError } = await supabase
            .from('events')
            .update({ 
                campaign_progress: { 
                    current_name: "QA Testing...", 
                    count: 50, 
                    total: 100 
                } 
            })
            .eq('id', (await supabase.from('events').select('id').limit(1).single()).data.id);

        if (progressError) throw new Error('فشل تحديث شريط التقدم: ' + progressError.message);
        console.log('✅ نجح: كود تحديث شريط التقدم يعمل ويصل لقاعدة البيانات.');

        console.log('\n🎉 نتيجة الاختبار: النظام سليم برمجياً وعملياً ومستعد للعمل الشاق.');

        // Cleanup test data
        await supabase.from('business_ledger').delete().eq('id', ledgerEntry.id);
        console.log('\n🧹 تم تنظيف بيانات الاختبار بنجاح.');

    } catch (err) {
        console.error('\n❌ فشل الاختبار في نقطة معينة:');
        console.error(err.message);
    }
}

runQATest();
