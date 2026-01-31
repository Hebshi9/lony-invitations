# 🔧 دليل حل المشاكل السريع

## ❌ خطأ "Failed to fetch" في تسجيل الدخول

### السبب:
التطبيق لا يستطيع الاتصال بـ Supabase

### الحل:

#### 1. تحقق من ملف `.env`
```bash
# تأكد أن الملف موجود ويحتوي على:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 2. أعد تشغيل السيرفر
```bash
# أوقف السيرفر (Ctrl+C)
# ثم شغله مرة أخرى
npm run dev
```

#### 3. تحقق من قاعدة البيانات
افتح Supabase Dashboard وتأكد من:
- ✅ المشروع يعمل
- ✅ الجداول موجودة (events, guests, scans)
- ✅ RLS مفعّل

#### 4. شغّل ملفات SQL
في Supabase SQL Editor، شغّل بالترتيب:
```
1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_workflow_system.sql
3. supabase/migrations/003_unified_studio.sql
4. supabase/migrations/004_whatsapp_integration.sql
5. supabase/migrations/005_complete_setup.sql
```

---

## ❌ المشروع لا يبني (Build fails)

### الحل:
```bash
# امسح node_modules وأعد التثبيت
rm -rf node_modules
npm install
npm run build
```

---

## ❌ الصفحة فارغة / بيضاء

### الحل:
1. افتح Console في المتصفح (F12)
2. شوف الأخطاء
3. غالباً مشكلة في المسارات - تحقق من imports

---

## ✅ اختبار سريع

```bash
# اختبر الاتصال بـ Supabase
npm run dev
# افتح: http://localhost:5173
# جرب تسجيل الدخول
```

---

## 📞 إذا استمرت المشكلة

1. تحقق من Console في المتصفح
2. تحقق من Terminal للأخطاء
3. تأكد من تشغيل جميع migrations في Supabase
