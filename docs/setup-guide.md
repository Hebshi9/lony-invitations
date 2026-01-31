# 🚀 دليل الإعداد السريع - Setup Guide

## المتطلبات الأساسية

- **Node.js**: الإصدار 18 أو أحدث
- **npm** أو **yarn**
- **حساب Supabase**: [إنشاء حساب مجاني](https://supabase.com)
- **مفتاح Gemini API** (اختياري): [الحصول على مفتاح](https://makersuite.google.com/app/apikey)

---

## 📦 التثبيت

### 1. استنساخ المشروع
```bash
git clone https://github.com/your-repo/lony-invitations.git
cd lony-invitations-frontend
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إعداد ملف البيئة
```bash
cp .env.example .env
```

قم بتعديل `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-key
```

---

## 🗄️ إعداد قاعدة البيانات

### استخدام Supabase Dashboard

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اذهب إلى **SQL Editor**
3. انسخ محتوى `supabase/schema.sql`
4. الصق في المحرر واضغط **Run**

### التحقق من الإعداد

```bash
node scripts/verify-database.js
```

---

## 🚀 تشغيل المشروع

```bash
npm run dev
```

افتح [http://localhost:5173](http://localhost:5173)

---

**للمزيد من التفاصيل، راجع [README.md](../README.md)**
