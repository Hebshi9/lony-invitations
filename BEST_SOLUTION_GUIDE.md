# الدليل الشامل والمفصل: تشغيل بوت واتساب 24/7 على Railway 🚀

هذا الدليل سيأخذك خطوة بخطوة من الصفر حتى يكون لديك سيرفر واتساب يعمل بشكل دائم وموثوق.

---

## المرحلة الأولى: تحضير الكود ورفعه على GitHub (أساس العملية)

لكي يستطيع Railway سحب الكود وتشغيله، يجب أن يكون الكود موجوداً على GitHub أولاً.

### 1. إنشاء مستودع (Repository) جديد
1. اذهب إلى [GitHub.com](https://github.com/) وسجل الدخول.
2. اضغط على علامة **(+)** في الزاوية العلوية اليمنى واختر **New repository**.
3. سمِّ المستودع: `lony-whatsapp-bot`.
4. اجعله **Private** (خاص) لحماية بياناتك.
5. اضغط **Create repository**.

### 2. رفع الكود من جهازك
افتح مشروعك في الـ Terminal (داخل VS Code) ونفذ الأوامر التالية بالترتيب:

```bash
# 1. تهيئة Git في المجلد الحالي
git init

# 2. إضافة جميع الملفات
git add .

# 3. حفظ التغييرات (Commit)
git commit -m "Initial deploy setup"

# 4. تفرع إلى الفرع الرئيسي
git branch -M main

# 5. ربط المجلد بالمستودع الذي أنشأته (استبدل الرابط برابطك الخاص)
# مثال: git remote add origin https://github.com/YOUR_USERNAME/lony-whatsapp-bot.git
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# 6. رفع الكود
git push -u origin main
```

---

## المرحلة الثانية: إعداد السيرفر على Railway (الخطوة الأهم)

Railway هو "المكان" الذي سيعيش فيه البوت. سنحتاج لإنشاء 4 خدمات مترابطة داخله.

### 1. إنشاء المشروع
1. اذهب إلى [Railway.app](https://railway.app/) وسجل الدخول بـ **GitHub**.
2. اضغط **New Project** -> **Deploy from GitHub repo**.
3. اختر المستودع الذي رفعته للتو (`lony-whatsapp-bot`).
4. اضغط **Deploy Now**.
5. *سيقوم Railway بمحاولة البناء، لا تقلق إذا فشل في البداية، سنضبط الإعدادات.*

### 2. إضافة الخدمات المساندة (Database & Redis)
بوت الواتساب (Evolution API) يحتاج لقاعدة داتا وذاكرة مؤقتة ليعمل.
1. في لوحة تحكم مشروعك في Railway، اضغط كليك يمين في المساحة الفارغة (Canvas).
2. اختر **Database** -> ثم **PostgreSQL**.
3. كليك يمين مرة أخرى -> **Database** -> ثم **Redis**.

### 3. إضافة سيرفر Evolution API (محرك الواتساب)
هذا هو "المحرك" الذي يشغل الواتساب.
1. اضغط كليك يمين -> **New Service** -> **Docker Image**.
2. في خانة Image Name اكتب: `atendai/evolution-api:v2.1.1`
3. اضغط **Enter** لإضافتها.
4. اضغط على الخدمة الجديدة (Evolution API) للدخول لإعداداتها -> تبويب **Variables**.
5. أضف المتغيرات التالية (مهم جداً):
   - `SERVER_URL`: انسخ رابط الخدمة بعد نشرها (سيكون متاحاً في تبويب Settings -> Networking).
   - `API_KEY`: `429683C4C977415CAAFCCE10F7D57E11` (أو أي كود سري تريده).
   - `AUTHENTICATION_API_KEY`: نفس الكود أعلاه.
   - `DATABASE_CONNECTION_URI`: اضغط على أيقونة "Variable Reference" واختر `DATABASE_URL` من خدمة PostgreSQL.
   - `REDIS_URI`: اضغط "Variable Reference" واختر `REDIS_URL` من خدمة Redis.

### 4. ربط الكود الخاص بك (Node.js Backend)
هذه الخدمة هي التي تحتوي على "ذكاء" البوت (Sales AI & RSVP).
1. اضغط على الخدمة التي تم إنشاؤها من GitHub (غالباً تحمل اسم المستودع).
2. اذهب إلى تبويب **Variables**.
3. أضف المتغيرات من ملف `.env` في جهازك:
   - `EVOLUTION_URL`: رابط خدمة Evolution API (التي أضفتها في الخطوة 3).
   - `EVOLUTION_API_KEY`: نفس الكود السري `429683C4C977415CAAFCCE10F7D57E11`.
   - `OPENAI_API_KEY`: مفتاح OpenAI الخاص بك.
   - `VITE_SUPABASE_URL`: رابط Supabase.
   - `VITE_SUPABASE_ANON_KEY`: مفتاح Supabase.
   - `PORT`: `3001` (أو اتركه وسيقوم Railway بتعيينه).

---

## المرحلة الثالثة: التشغيل والربط النهائي 🔗

### 1. التأكد من العمل
انتظر بضع دقائق حتى تتحول جميع المؤشرات إلى اللون الأخضر (Active/Deployed).

### 2. إعداد الـ Webhook (تلقائي أو يدوي)
يفترض أن الكود الخاص بك سيحاول ضبط الـ Webhook تلقائياً عند البدء إذا وضعت المتغيرات بشكل صحيح.
إذا لم يحدث، يمكنك استخدام Postman لإرسال طلب `POST /webhook/set/lony-whatsapp` إلى رابط Evolution API مع رابط الكود الخاص بك.

### 3. مسح الباركود (QR Code)
1. افتح رابط خدمة (Node.js App) الخاصة بك.
2. اذهب للمسار `/api/whatsapp/connect/lony-whatsapp`.
3. سيظهر لك (أو في الـ Logs) الباركود. امسحه بجوالك.

---

**🎉 مبروك!** الآن لديك بوت واتساب يعمل على سحابة إلكترونية 24 ساعة، يرد على العملاء حتى لو انقطع النت عنك أو أطفأت جهازك.
