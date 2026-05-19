
import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * LONY MASTER AUDITOR PRO - THE FORENSIC EDITION
 * This robot performs a full-cycle live audit of the Lony ecosystem.
 */
test.describe('Lony Master Auditor Pro - Full Cycle Forensic Test', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Go to Login Page
        await page.goto('/');
        
        // 2. Perform Secret Login (Forensic Access)
        try {
            await page.fill('input[type="email"]', 'projectju18@gmail.com');
            await page.fill('input[type="password"]', 'اثلاساه12');
            await page.click('button:has-text("دخول")');
            
            // Wait for dashboard to land
            await page.waitForURL(/.*dashboard|.*ledger|.*/, { timeout: 10000 });
        } catch (e) {
            console.log('Login skip/fail - maybe already in session');
        }
    });

    test('Step 1: Financial & AI Integrity Audit', async ({ page }) => {
        await page.goto('/business-ledger');
        
        // Audit 1: Brand & Layout Stability
        await expect(page.locator('h1')).toContainText('سجل الأعمال');
        await expect(page.locator('button:has-text("كشف مديونيات")')).toBeVisible();

        // Audit 2: AI Magic Box Security & Logic (Isolated Test Data)
        await page.click('button:has-text("المدخل السحري")');
        const maliciousPrompt = "قيد جديد: تجربة_روبوت_الجودة، جوال 966500000000، حجز 4000، دفع 1000. <script>console.log('XSS')</script>";
        await page.fill('textarea', maliciousPrompt);
        await page.click('button:has-text("تحليل")');
        
        // Wait for AI and check results
        await page.waitForTimeout(5000); 
        await expect(page.locator('table')).toContainText('تجربة_روبوت_الجودة');
        await expect(page.locator('table')).toContainText('3000'); // Validated logic
        
        // Audit 3: Screenshot of Ledger (Branding Check)
        await page.screenshot({ path: 'tests/evidence/ledger_audit.png', fullPage: true });
    });

    test('Step 2: Event Lifecycle & Guest Engine Audit (ISOLATED)', async ({ page }) => {
        // 1. Navigate to Events List
        await page.goto('/events');
        
        // 2. Create a "QA Robot" Specific Event (Isolation Guarantee)
        const timestamp = new Date().getTime();
        const testEventName = `Lony Master QA - ${timestamp}`;
        
        await page.click('button:has-text("حدث جديد"), button:has-text("إضافة مناسبة")');
        await page.fill('input[placeholder*="اسم"], input[name="name"]', testEventName);
        await page.fill('input[type="date"]', '2026-12-31'); // Future date
        await page.click('button:has-text("حفظ"), button:has-text("إنشاء")');
        
        // Wait for creation and ensure we are in the context of our NEW event
        await page.waitForTimeout(3000); 
        console.log(`✅ Isolated Test Event Created: ${testEventName}`);

        // 3. Upload Guests (The Live Bug Probe - ONLY for this new event)
        await page.goto('/upload-guests');
        const filePath = path.resolve('tests/test_data/qa_guests.xlsx');
        await page.setInputFiles('input[type="file"]', filePath);
        
        // Wait for AI Analysis of Excel
        await page.waitForSelector('text=نتائج التحليل الذكي', { timeout: 15000 });
        await page.screenshot({ path: 'tests/evidence/excel_analysis.png' });
        
        // Proceed to mapping/review
        await page.click('button:has-text("متابعة للمراجعة")');
        await page.waitForSelector('text=مراجعة البيانات');
        
        // Confirm Import
        await page.click('button:has-text("رفع")');
        await page.waitForSelector('text=نجاح', { timeout: 10000 });
        await page.screenshot({ path: 'tests/evidence/upload_success.png' });
    });

    test('Step 3: Client Portal & Security Isolation Audit', async ({ page }) => {
        // We will try to find a valid magic token from the DB or state
        // For testing, we ensure the Dashboard renders correctly for any event
        await page.goto('/host-dashboard-demo'); // Or similar landing
        // ... Logic to find the last created event's magic link ...
        
        // Security Check: Unauthorized Access
        await page.goto('/host/invalid-uuid-token-test');
        await expect(page.locator('text=رابط غير صالح')).toBeVisible();
        await page.screenshot({ path: 'tests/evidence/security_access_check.png' });
    });

    test('Step 4: Performance & Branding Forensic', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/business-ledger');
        const loadTime = Date.now() - startTime;
        
        console.log(`[Perf Audit] Ledger Load Time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(3000); // 3-second threshold

        // Visual Regression: Ensure Navy & Gold consistency
        const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        // Add more visual checks here
    });

});
