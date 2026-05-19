
import { execSync } from 'child_process';
import chalk from 'chalk'; // Assuming chalk is used or I'll use raw console colors
import fs from 'fs';

async function runAgileAudit() {
    console.log('\x1b[36m%s\x1b[0m', '🛡️  بدء تدقيق الجودة الشامل - لوني برو (Lony Agile Audit)');
    console.log('\x1b[33m%s\x1b[0m', '----------------------------------------------------------');
    console.log('\x1b[32m%s\x1b[0m', '🤖 الروبوت يستعد لفتح المتصفح ومحاكاة موظف حقيقي...');

    try {
        console.log('\n📦 جاري تشغيل الاختبارات (الواجهة + الربط + المالية)...');
        
        // Execute playwright tests
        // --headed so the user can watch it
        execSync('npx playwright test tests/e2e/executive_lifecycle.spec.js --headed', { stdio: 'inherit' });

        console.log('\n\x1b[32m%s\x1b[0m', '✅ انتهى التدقيق بنجاح!');
        console.log('\x1b[36m%s\x1b[0m', '📊 جاري فتح تقرير الجودة المرئي الآن...');
        
        // Open the report
        execSync('npx playwright show-report', { stdio: 'inherit' });

    } catch (error) {
        console.log('\n\x1b[31m%s\x1b[0m', '❌ اكتشف الروبوت وجود مشكلة أو "ثغرة" (Bug) في أحد المسارات.');
        console.log('\x1b[33m%s\x1b[0m', 'يرجى مراجعة تقرير Playwright لمعرفة التفاصيل.');
        
        try {
            execSync('npx playwright show-report', { stdio: 'inherit' });
        } catch (e) {
            console.log('لا يمكن فتح التقرير تلقائياً. ابحث عنه في مجلد playwright-report');
        }
    }
}

runAgileAudit();
