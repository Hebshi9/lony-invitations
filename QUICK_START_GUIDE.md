# 🚀 دليل التشغيل الكامل - Docker جاهز

## ✅ الوضع الحالي
- **Docker**: جاهز ومثبت ✓
- **Sales AI**: منفصل تماماً عن إرسال الدعوات ✓
- **Evolution API**: جاهز للتشغيل

---

## 📋 خطوات التشغيل (بالترتيب)

### 1️⃣ تشغيل Evolution API (Docker)

```bash
cd "c:\Users\user\Documents\New folder (3)\evolution-api-local"
docker-compose up -d
```

**✅ تأكد إنه شغّال:**
```bash
docker ps
# يجب تشوف container اسمه evolution-api
```

**🌐 اختبار:**
```
http://localhost:8081
```

---

### 2️⃣ تشغيل WhatsApp Server (Evolution Adapter)

في **terminal جديد**:

```bash
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
npm run whatsapp:evolution
```

**✅ المفترض تشوف:**
```
🚀 Adapter Server running on port 3001
🔗 Connected to Evolution API at http://localhost:8081
```

---

### 3️⃣ تشغيل Frontend

في **terminal ثالث**:

```bash
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
npm run dev
```

**🌐 افتح المتصفح:**
```
http://localhost:5173
```

---

## 🎯 الآن عندك صفحتين منفصلتين:

### 📲 إرسال الدعوات (WhatsApp Sender)
```
http://localhost:5173/whatsapp-sender
```
- إرسال الدعوات للضيوف
- إرسال كروت الباركود
- تتبع حالة الإرسال

### 🤖 Sales AI (منفصل تماماً)
```
http://localhost:5173/sales-ai
```
- محادثات العملاء المحتملين
- ردود AI الذكية
- تصعيدات للإدارة

---

## 🔗 الربط مع رقمك

1. افتح: `http://localhost:5173/whatsapp-sender`
2. اضغط **إضافة حساب**
3. رقمك: `+966503678789`
4. اضغط **اتصال**
5. امسح QR Code من جوالك (WhatsApp > الأجهزة المرتبطة)

---

## 🐛 إذا ما اشتغل

### مشكلة: Evolution API ما يشتغل
```bash
# تأكد من Docker شغال
docker ps

# لو مافيه containers، شغّله:
cd evolution-api-local
docker-compose up -d
```

### مشكلة: WhatsApp Server يعطي خطأ
```bash
# تأكد من .env فيه:
# EVOLUTION_URL=http://localhost:8081
# EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11
# ADMIN_PHONE=+966503678789
# OPENAI_API_KEY=sk-...
```

### مشكلة: Sales AI ما يشتغل
```bash
# تأكد من الجداول في قاعدة البيانات
node scripts/setup-sales-tables.js
```

---

## ✨ الفرق بين الصفحتين

| الميزة | WhatsApp Sender | Sales AI |
|--------|----------------|----------|
| **الغرض** | إرسال دعوات للضيوف | التعامل مع العملاء المحتملين |
| **الردود** | RSVP للضيوف | عروض بيع ومفاوضات |
| **AI المستخدم** | RSVP AI (تأكيد/اعتذار) | Sales AI (لوني) |
| **الجمهور** | ضيوف الأحداث | عملاء جدد |

---

## 🎬 جرب الآن!

1. شغّل Docker ✓
2. شغّل WhatsApp Server ✓
3. شغّل Frontend ✓
4. اوصل رقمك ✓
5. جرب من رقم ثاني! 🚀

**للاختبار:**
- أرسل لرقمك دعوة من ضيف → RSVP AI يرد
- أرسل من رقم جديد "وش خدماتكم؟" → Sales AI يرد

---

**جاهز؟ 💪**
