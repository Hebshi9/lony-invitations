# ⚡ دليل الإعداد السريع - Quick Setup Guide

## المتطلبات

- Node.js 18+
- npm أو yarn
- حساب Supabase

---

## 🚀 التثبيت

### 1. استنساخ المشروع
```bash
git clone <repository-url>
cd lony-invitations-frontend
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إعداد البيئة
```bash
cp .env.example .env
```

عدّل ملف `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. إعداد قاعدة البيانات

افتح Supabase SQL Editor وشغّل الملفات بالترتيب:

```bash
# في Supabase SQL Editor:
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_workflow_system.sql
3. supabase/migrations/003_unified_studio.sql
4. supabase/migrations/004_whatsapp_integration.sql
5. supabase/migrations/005_complete_setup.sql
```

### 5. تشغيل التطبيق
```bash
npm run dev
```

افتح: http://localhost:5173

---

## 📱 الميزات الرئيسية

### للمسؤول
- إنشاء الأحداث وإدارتها
- رفع قوائم الضيوف
- تصميم الدعوات (Invitation Studio)
- إرسال دعوات WhatsApp
- لوحة تحكم شاملة

### للعميل
- لوحة تحكم خاصة
- متابعة الحضور لحظياً
- إحصائيات مفصلة

### للمشرف
- ماسح QR على الجوال
- تسجيل الحضور
- دعم المرافقين

---

## 🧪 الاختبار

```bash
npm test              # اختبارات سريعة
npm run test:all      # جميع الاختبارات
```

---

## 🏗️ البناء للإنتاج

```bash
npm run build
npm run preview  # معاينة البناء
```

---

## 📚 التوثيق الإضافي

- [هيكل المشروع](ARCHITECTURE.md)
- [دليل الاستوديو](guides/studio-guide.md)
- [دليل WhatsApp](guides/whatsapp-guide.md)
- [دليل الاختبار](guides/testing-guide.md)

---

## 🆘 المساعدة

إذا واجهت مشاكل:
1. تحقق من ملف `.env`
2. تأكد من تشغيل جميع migrations
3. راجع console المتصفح للأخطاء
4. راجع التوثيق في مجلد `docs/`
