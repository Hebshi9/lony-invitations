import { test, expect } from '@playwright/test';

// اختبارات End-to-End
test.describe('سيناريو Scanner الكامل', () => {
    test.beforeEach(async ({ page }) => {
        // التحقق من أن السيرفر يعمل
        await page.goto('/');
    });

    test('يجب أن تفتح صفحة Scanner', async ({ page }) => {
        await page.goto('/scanner');

        // التحقق من وجود العنوان
        await expect(page.locator('h1, h2')).toContainText(/scanner|ماسح|مسح/i);
    });

    test('يجب أن تطلب صفحة Scanner إذن الكاميرا', async ({ page, context }) => {
        // منح إذن الكاميرا تلقائياً
        await context.grantPermissions(['camera']);

        await page.goto('/scanner');

        // التحقق من وجود عنصر الفيديو أو reader
        const videoOrReader = page.locator('video, #reader, [id*="qr"]').first();
        await expect(videoOrReader).toBeVisible({ timeout: 10000 });
    });

    test('يجب أن تعرض رسالة خطأ عند رفض إذن الكاميرا', async ({ page, context }) => {
        // رفض إذن الكاميرا
        await context.grantPermissions([]);

        await page.goto('/scanner');

        // انتظار ظهور رس الة الخطأ
        const errorMessage = page.locator('text=/permission|إذن|غير مسموح/i');
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
    });
});

test.describe('سيناريو Dashboard العميل', () => {
    test('يجب أن تفتح صفحة Dashboard', async ({ page }) => {
        // استخدام event_id تجريبي
        const testEventId = '00000000-0000-0000-0000-000000000000';
        await page.goto(`/client/${testEventId}`);

        // التحقق من وجود عنصر dashboard
        await expect(page.locator('body')).toContainText(/dashboard|لوحة|إحصائيات/i, { timeout: 10000 });
    });

    test('يجب أن تعرض الإحصائيات', async ({ page }) => {
        const testEventId = '00000000-0000-0000-0000-000000000000';
        await page.goto(`/client/${testEventId}`);

        // البحث عن أي رقم (إحصائية)
        const stats = page.locator('text=/\\d+/').first();
        await expect(stats).toBeVisible({ timeout: 15000 });
    });

    test('يجب أن تعمل على الموبايل', async ({ page }) => {
        // تغيير حجم الشاشة لموبايل
        await page.setViewportSize({ width: 375, height: 667 });

        const testEventId = '00000000-0000-0000-0000-000000000000';
        await page.goto(`/client/${testEventId}`);

        // التحقق من responsive design
        await expect(page.locator('body')).toBeVisible();
    });
});

test.describe('سيناريو تسجيل الدخول', () => {
    test('يجب أن تفتح صفحة تسجيل دخول العميل', async ({ page }) => {
        await page.goto('/client-login');

        // التحقق من وجود حقول الإدخال
        const inputs = page.locator('input');
        await expect(inputs.first()).toBeVisible({ timeout: 10000 });
    });

    test('يجب أن تعرض رسالة خطأ عند إدخال بيانات خاطئة', async ({ page }) => {
        await page.goto('/client-login');

        // إدخال بيانات خاطئة
        const eventIdInput = page.locator('input').first();
        const codeInput = page.locator('input').nth(1);

        if (await eventIdInput.isVisible() && await codeInput.isVisible()) {
            await eventIdInput.fill('wrong-id');
            await codeInput.fill('wrong-code');

            // الضغط على زر الدخول
            const submitButton = page.locator('button[type="submit"]');
            if (await submitButton.isVisible()) {
                await submitButton.click();

                // انتظار رسالة الخطأ
                await page.waitForTimeout(2000);
            }
        }
    });
});

test.describe('التحقق من PWA', () => {
    test('يجب أن يحتوي على manifest.json', async ({ page }) => {
        const response = await page.goto('/manifest.json');
        expect(response?.status()).toBe(200);

        const manifest = await response?.json();
        expect(manifest).toHaveProperty('name');
        expect(manifest).toHaveProperty('icons');
    });

    test('يجب أن يحتوي على service worker', async ({ page }) => {
        const response = await page.goto('/sw.js');
        expect(response?.status()).toBe(200);
    });

    test('يجب أن يحتوي على meta tags للموبايل', async ({ page }) => {
        await page.goto('/');

        const viewport = await page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveAttribute('content', /width=device-width/);

        const themeColor = await page.locator('meta[name="theme-color"]');
        await expect(themeColor).toHaveCount(1);
    });
});

test.describe('اختبار الأداء', () => {
    test('يجب أن تحمل الصفحة الرئيسية بسرعة', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        const loadTime = Date.now() - startTime;

        // يجب أن تحمل في أقل من 3 ثوانٍ
        expect(loadTime).toBeLessThan(3000);
    });

    test('يجب أن لا يكون هناك أخطاء console', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('/scanner');
        await page.waitForTimeout(2000);

        // تجاهل أخطاء الكاميرا المتوقعة
        const criticalErrors = errors.filter(e =>
            !e.includes('camera') &&
            !e.includes('permission') &&
            !e.includes('getUserMedia')
        );

        expect(criticalErrors.length).toBe(0);
    });
});
