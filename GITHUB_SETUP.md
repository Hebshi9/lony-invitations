# 🚀 رفع المشروع على GitHub - دليل سريع

## الخطوة 1️⃣: إنشاء Repository على GitHub (دقيقة واحدة)

1. افتح الرابط: https://github.com/new
2. املأ المعلومات:
   - **Repository name**: `lony-invitations-platform`
   - **Description**: `Premium QR Code Invitation Platform with WhatsApp Integration`
   - **Visibility**: Private (أو Public حسب رغبتك)
   - ⚠️ **لا تضيف** README, .gitignore, أو license
3. اضغط **"Create repository"**

---

## الخطوة 2️⃣: تنفيذ السكريبت التلقائي

بعد إنشاء الـ repository، نفذ الملف التالي:

### في PowerShell:
```powershell
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
.\setup-github.ps1
```

**ملاحظة**: السكريبت سيطلب منك رابط الـ repository الذي أنشأته.

---

## الخطوة 3️⃣: ربط Netlify بـ GitHub (3 دقائق)

1. اذهب إلى: https://app.netlify.com
2. اضغط **"Add new site"** → **"Import an existing project"**
3. اختر **"Deploy with GitHub"**
4. اختر repository: `lony-invitations-platform`
5. **Build settings** (سيتم اكتشافها تلقائياً من `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
6. اضغط **"Deploy"**

### إعداد Environment Variables في Netlify:
اذهب إلى: **Site settings** → **Environment variables** → **Add a variable**

أضف المتغيرات التالية (من ملف `.env` الخاص بك):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- أي متغيرات أخرى من `.env`

---

## ✅ النتيجة النهائية

بعد الانتهاء:
- ✅ الكود موجود على GitHub
- ✅ كل push للكود = Deploy تلقائي على Netlify
- ✅ لديك URL خاص بالموقع من Netlify

---

## 📝 ملاحظات مهمة

- ملف `.gitignore` موجود ويحمي الملفات الحساسة (`.env`, `node_modules`, إلخ)
- جلسات WhatsApp (`.wwebjs_auth/`) **محمية** ولن يتم رفعها
- Netlify سيعمل Deploy تلقائي مع كل تغيير على branch `main`
