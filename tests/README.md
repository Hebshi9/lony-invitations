# 🧪 دليل الاختبارات - Lony Invitations Testing Guide

## 📋 نظرة عامة

يحتوي المشروع على 3 أنواع من الاختبارات:

1. **🔬 اختبارات قاعدة البيانات** (Database Tests)
2. **🔗 اختبارات التكامل** (Integration Tests)
3. **🎭 اختبارات End-to-End** (E2E Tests)

---

## 🚀 تشغيل الاختبارات

### تثبيت المكتبات المطلوبة:
```bash
npm install -D vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @playwright/test
```

### تثبيت متصفحات Playwright:
```bash
npx playwright install
```

---

## 📝 الأوامر

### اختبار كل شيء:
```bash
npm run test:all
```

### اختبارات الوحدة (Unit Tests):
```bash
npm test
```

### اختبارات قاعدة البيانات:
```bash
npm run test:db
```

### اختبارات التكامل:
```bash
npm run test:integration
```

### اختبارات E2E:
```bash
npm run test:e2e
```

### واجهة Playwright:
```bash
npm run test:e2e:ui
```

### تقرير التغطية (Coverage):
```bash
npm run test:coverage
```

---

## 🔬 اختبارات قاعدة البيانات

**الملف:** `tests/database/schema.test.js`

### ما يتم اختباره:
- ✅ وجود الجداول (events, guests, scans)
- ✅ وجود الأعمدة المطلوبة
- ✅ القيود (Constraints):
  - qr_payload فريد (Unique)
  - Foreign Keys
- ✅ Row Level Security (RLS)
- ✅ السياسات (Policies)

### مثال:
```bash
npm run test:db
```

**النتيجة المتوقعة:**
```
✓ يجب أن يحتوي على الأعمدة المطلوبة
✓ يجب أن يكون qr_payload فريداً
✓ يجب أن يكون RLS مفعلاً
```

---

## 🔗 اختبارات التكامل

**الملف:** `tests/integration/scanner.test.js`

### ما يتم اختباره:
- ✅ سيناريو مسح QR كامل:
  1. إنشاء حدث
  2. إضافة ضيف
  3. مسح QR Code
  4. تحديث الحالة
  5. تسجيل في scans
- ✅ منع التكرار (Duplicate Detection)
- ✅ منع التجاوز (Max Scans)
- ✅ منع المسح بعد الانتهاء (Expired Events)
- ✅ حساب الإحصائيات

### مثال:
```bash
npm run test:integration
```

**السيناريو:**
```
1. ✅ مسح ضيف جديد → نجاح
2. ⚠️ مسح نفس الضيف → تكرار
3. ❌ مسح بعد max_scans → رفض
4. ❌ مسح بعد انتهاء الحدث → رفض
```

---

## 🎭 اختبارات E2E

**الملف:** `tests/e2e/scanner-workflow.spec.js`

### ما يتم اختباره:
- ✅ فتح صفحة Scanner
- ✅ طلب إذن الكاميرا
- ✅ عرض رسالة خطأ عند الرفض
- ✅ عرض Dashboard
- ✅ عرض الإحصائيات
- ✅ Responsive Design (موبايل)
- ✅ PWA (manifest.json, sw.js)
- ✅ الأداء (سرعة التحميل)

### مثال:
```bash
npm run test:e2e
```

**النتيجة:**
- تقرير HTML: `playwright-report/index.html`
- لقطات الشاشة عند الفشل

---

## ⚙️ الإعداد

### 1. متغيرات البيئة (.env):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

### 2. قاعدة البيانات:
```bash
# تأكد من تشغيل schema أولاً
npm run db:setup
```

### 3. السيرفر:
```bash
# في نافذة منفصلة
npm run dev
```

---

## 📊 التقارير

### Vitest:
```bash
npm run test:coverage
```
**الناتج:** `coverage/index.html`

### Playwright:
```bash
npm run test:e2e
```
**الناتج:** `playwright-report/index.html`

---

## 🐛 استكشاف الأخطاء

### المشكلة: "Supabase credentials not found"
**الحل:**
```bash
# تأكد من وجود .env
cp .env.example .env
# أضف المتغيرات الصحيحة
```

### المشكلة: "Permission denied (RLS)"
**الحل:**
- الاختبارات تتوقع أن السياسات تسمح بالقراءة العامة
- راجع `supabase/schema.sql` السطر 55-65

### المشكلة: "Browser not found"
**الحل:**
```bash
npx playwright install
```

### المشكلة: "Port 5173 already in use"
**الحل:**
```bash
# أوقف السيرفر الحالي
Ctrl+C
# أو غير البورت في vite.config.js
```

---

## ✅ قائمة التحقق

قبل Production، تأكد من:

- [ ] جميع الاختبارات تعمل: `npm run test:all`
- [ ] لا توجد أخطاء console
- [ ] التغطية (Coverage) > 70%
- [ ] PWA يعمل على الموبايل
- [ ] Scanner يقرأ QR بنجاح
- [ ] Dashboard يعرض الإحصائيات
- [ ] RLS يعمل بشكل صحيح

---

## 📚 المصادر

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Supabase Testing](https://supabase.com/docs/guides/database/testing)

---

**🎯 الهدف: 100% Confidence في Production!**
