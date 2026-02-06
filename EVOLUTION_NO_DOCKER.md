# 🎯 تشغيل Evolution API بدون Docker

## الخطوات:

### 1️⃣ Clone المشروع
```bash
cd "c:\Users\user\Documents\New folder (3)"
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api
```

### 2️⃣ تثبيت Dependencies
```bash
npm install
```

### 3️⃣ إنشاء ملف `.env`
```bash
# انسخ الملف المثال
copy .env.example .env
```

### 4️⃣ تعديل `.env`
افتح `.env` وعدل:
```env
# Server
SERVER_URL=http://localhost:8081

# Database (اختياري - يستخدم SQLite افتراضياً)
DATABASE_ENABLED=false

# Authentication
AUTHENTICATION_API_KEY=429683C4C977415CAAFCCE10F7D57E11

# Instance
INSTANCE_NAME=lony-whatsapp
```

### 5️⃣ تشغيل Evolution API
```bash
npm run start:prod
```

---

## ✅ إذا اشتغل، راح تشوف:
```
🚀 Evolution API is running on port 8081
```

---

## 🔗 ربطه مع السيرفر الموجود

بعد ما يشتغل Evolution API:

### 1. شغّل سيرفر واتساب:
```bash
# في terminal جديد
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
npm run whatsapp:server
```

### 2. افتح الواجهة:
```
http://localhost:5173/whatsapp-sender
```

### 3. أضف حساب:
- رقمك: `+966503678789`
- اسم: "رقم الإدارة"
- اضغط **اتصال**

### 4. امسح QR Code من جوالك

### 5. جرب من رقم ثاني!

---

## 🐛 حل المشاكل:

### المشكلة: "npm install فشل"
**الحل:**
```bash
# جرب مع force
npm install --force

# أو مع legacy
npm install --legacy-peer-deps
```

### المشكلة: "Port 8081 مستخدم"
**الحل:**
```bash
# غير الـ port في .env:
SERVER_URL=http://localhost:8082
```

---

## ⚡ الطريقة الأسرع (إذا ما اشتغل):

Evolution API فيه **نسخة compiled جاهزة**:

```bash
# حمّل النسخة الجاهزة
wget https://github.com/EvolutionAPI/evolution-api/releases/latest/download/evolution-api.zip
unzip evolution-api.zip
cd evolution-api
npm run start:prod
```

---

## 📝 ملاحظات:

1. **Evolution API بدون Docker** → يشتغل لكن قد يحتاج تعديلات
2. **البديل الأسهل** → Docker أسرع وأضمن
3. **للتجربة** → ممكن تستخدم **Cloud Evolution API** (مجاني)

---

## 🌐 البديل السحابي (الأسهل):

استخدم Evolution API Cloud:
```
https://evolution-api.com/
```
- مجاني للتجربة
- بدون تثبيت
- جاهز للاستخدام

---

**جاهز؟ جرب الخطوات فوق!** 🚀
