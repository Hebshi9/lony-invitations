
import { test, expect } from '@playwright/test';

/**
 * LONY QA ROBOT - THE ULTIMATE AUDIT SCRIPT
 * This robot tests the unified Meta V2 architecture and the Business Ledger DNA.
 */
test.describe('Lony QA Robot - Strategic Pulse Test', () => {

    test.beforeEach(async ({ page }) => {
        // Go to the main dashboard
        await page.goto('/');
    });

    test('Audit 1: Visual Identity & Navigation', async ({ page }) => {
        // Check for the Lony logo or brand colors in the sidebar/nav
        await expect(page.locator('nav')).toBeVisible();
        
        // Navigate to Business Ledger
        await page.goto('/business-ledger');
        await expect(page).toHaveURL(/.*business-ledger/);
        
        // Ensure the Luxury Brand aesthetic is present
        const title = page.locator('h1');
        await expect(title).toContainText('سجل الأعمال');
    });

    test('Audit 2: AI Magic Ledger & Multi-Admin Notify', async ({ page }) => {
        await page.goto('/business-ledger');

        // 1. Open Magic AI Box
        await page.click('button:has-text("المدخل السحري")');
        
        // 2. Input a test debt scenario
        const testText = "جديد: العميل طلال، جوال 966500000000، حجز خدمة لوني برو بقيمة 5000 ريال، دفع عربون 1500 ريال.";
        await page.fill('textarea', testText);
        
        // 3. Trigger AI Parsing
        await page.click('button:has-text("تحليل")');
        
        // 4. Wait for AI response and verify if row is added (Auto-save is on in our current logic)
        // We look for "طلال" in the table
        await page.waitForTimeout(5000); // Give AI time to work and notify owner
        
        await expect(page.locator('table')).toContainText('طلال');
        await expect(page.locator('table')).toContainText('3500'); // 5000 - 1500 = 3500

        // 5. Test Manual Summary Send
        // This should trigger the multi-notify logic we just added to the server
        await page.click('button:has-text("كشف مديونيات لواتسابي")');
        
        // Check for success dialog or toast
        page.on('dialog', async dialog => {
            expect(dialog.message()).toContain('تم إرسال');
            await dialog.accept();
        });
    });

    test('Audit 3: Mobile Responsiveness (Lony Pocket)', async ({ page, isMobile }) => {
        if (!isMobile) return;

        await page.goto('/business-ledger');
        // Check if table is scrollable or hidden (UX Check)
        const table = page.locator('div.overflow-x-auto');
        await expect(table).toBeVisible();
    });

});
