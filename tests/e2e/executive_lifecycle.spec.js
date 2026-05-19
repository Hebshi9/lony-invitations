
import { test, expect } from '@playwright/test';

test.describe('Lony AI Executive Suite - Full Lifecycle Audit', () => {

    test.beforeEach(async ({ page }) => {
        // Assume dev server is running at baseURL from config
        await page.goto('/');
        // Note: For a real test, we might handle login here, but we will target the routes directly
    });

    test('Scenario 1: AI Magic Box to Ledger Flow (The Happy Path)', async ({ page }) => {
        // 1. Navigate to AI Operations
        await page.goto('/ai-operations');
        await expect(page).toHaveURL(/.*ai-operations/);
        
        // 2. Perform AI Input
        const testPrompt = `جديد: العميل فهد، جواله 966500001122، حجز بكج ارسال ضخم بقيمة 4500 ريال، دفع لي 2000 كعربون. المصمم اخذ 400. المتابعة بعد اسبوعين.`;
        await page.fill('textarea[placeholder*="اكتب هنا"]', testPrompt);
        
        // Click Analyze
        await page.click('button:has-text("تحليل")');
        
        // Wait for AI Result Panel (Gemini can take 2-4 seconds)
        await page.waitForSelector('text=معاينة البيانات المستخرجة', { timeout: 15000 });
        
        // 3. Verify AI Extraction Logic (Math Check)
        const totalPrice = await page.textContent('text=4500');
        const deposit = await page.textContent('text=2000');
        await expect(totalPrice).toBeTruthy();
        await expect(deposit).toBeTruthy();

        // 4. Confirm and Watch for DB commit
        await page.click('button:has-text("تأكيد وحفظ")');
        
        // Check for success toast/indication
        await page.waitForSelector('text=نجاح', { timeout: 5000 });
        
        // 5. Verify in Business Ledger
        await page.goto('/business-ledger');
        await expect(page.locator('table')).toContainText('فهد');
        await expect(page.locator('table')).toContainText('2500'); // The debt
    });

    test('Scenario 2: Business Ledger UX & Micro-Stats', async ({ page }) => {
        await page.goto('/business-ledger');
        
        // Verify Summary Cards render
        await expect(page.locator('text=إجمالي المبيعات')).toBeVisible();
        await expect(page.locator('text=المديونيات المعلقة')).toBeVisible();

        // Check search functionality
        const searchInput = page.locator('input[placeholder*="بحث"]');
        if (await searchInput.isVisible()) {
            await searchInput.fill('فهد');
            await expect(page.locator('tbody tr')).toHaveCount(1);
        }
    });

    test('Scenario 3: Financial Hub Strategic Visibility', async ({ page }) => {
        await page.goto('/financial-hub');
        
        // Verify the Monthly Target Gauges/Labels
        await expect(page.locator('text=الهدف الشهري الحالي')).toBeVisible();
        await expect(page.locator('text=SAR')).toContainText('SAR');

        // Verify Recharts rendering (Check for SVG elements)
        const chart = page.locator('.recharts-surface');
        await expect(chart.first()).toBeVisible();
    });

    test('Scenario 4: Navigation Stability Check (Lony Audit)', async ({ page }) => {
        const routes = ['/', '/financial-hub', '/business-ledger', '/ai-operations'];
        
        for (const route of routes) {
            await page.goto(route);
            // Ensure no white screen (Check for any lony-gold elements that are in the Layout)
            await expect(page.locator('body')).not.toContainText('Error');
            await expect(page.locator('nav')).toBeVisible();
        }
    });
});
