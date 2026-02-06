# 🚀 دليل التجربة الواقعية - Sales AI

## المتطلبات قبل البدء:
- ✅ رقم واتساب (للبيزنس) متصل بالإنترنت
- ✅ رقم ثاني للاختبار (أي رقم عادي)
- ✅ Evolution API شغال

---

## الخطوة 1: تشغيل Evolution API

### إذا عندك Docker:
```bash
cd evolution-api
docker-compose up -d
```

### إذا ما عندك Docker:
Evolution API يحتاج Docker. خيارات بديلة:
1. استخدم Baileys بدلاً (موجود في المشروع)
2. ثبت Docker Desktop من: https://www.docker.com/products/docker-desktop

### تحقق إن Evolution شغال:
```bash
curl http://localhost:8081/manager/status
```
لازم يرجع: `{"status":"ok"}`

---

## الخطوة 2: تشغيل السيرفر

في terminal جديد:
```bash
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
npm run whatsapp:server
```

لازم تشوف:
```
🚀 Adapter Server running on port 3001
🔗 Connected to Evolution API at http://localhost:8081
```

---

## الخطوة 3: ربط رقمك بالنظام

### A. افتح الواجهة:
```
http://localhost:5173/whatsapp-sender
```

### B. أضف حساب:
1. اكتب رقم جوالك: `+966503678789` (رقم الإدارة)
2. اكتب اسم: "رقم لوني الرسمي"
3. اضغط **حفظ الحساب**

### C. اتصل:
1. اضغط **اتصال (Scan QR)**
2. راح يطلع QR Code
3. من جوالك:
   - افتح واتساب
   - ⋮ → الأجهزة المرتبطة
   - ربط جهاز
   - امسح الـ QR Code

### D. تأكد من الاتصال:
لازم تشوف:
- ✅ حالة الحساب: **متصل** (أخضر)
- اسم الجوال يظهر

---

## الخطوة 4: إعداد Webhook (للرسائل الواردة)

Evolution API يحتاج يعرف وين يرسل الرسائل الجديدة.

### إذا localhost (على جهازك):
تحتاج Ngrok:

```bash
# Terminal جديد
ngrok http 3001
```

راح يعطيك URL مثل:
```
https://1234-abc-def.ngrok-free.app
```

### سجّل الـ Webhook:
```bash
# غيّر YOUR-NGROK-URL بالـ URL اللي طلع لك
curl -X POST http://localhost:3001/api/whatsapp/setup-webhook -H "Content-Type: application/json" -d "{\"url\": \"https://YOUR-NGROK-URL.ngrok-free.app/webhook\"}"
```

---

## الخطوة 5: اختبار النظام! 🎉

### A. من جوال تاني (أي رقم):
أرسل رسالة للرقم اللي ربطته (`+966503678789`):

```
يا هلا، وش الخدمات اللي تقدمونها؟
```

### B. شوف النتيجة:
1. **على جوالك الثاني:** لازم يوصلك رد من AI خلال ثوان:
   ```
   يا هلا بك! نحن في لوني للدعوات نقدم...
   ```

2. **في Terminal السيرفر:** لازم تشوف:
   ```
   [Webhook] 📨 From +966xxxxxxxx: "يا هلا..."
   [Webhook] 🤖 Prospected Client inquiry: +966xxxxxxxx
   [Sales AI] 🆕 New conversation for +966xxxxxxxx
   [Sales AI] Intent: inquiry, Priority: medium
   ```

3. **في Database:** شوف الجدول `sales_conversations` - لازم فيه سطر جديد

---

## الخطوة 6: اختبار التصعيد 🚨

### من نفس الرقم الثاني، أرسل:
```
ممكن أكلم المدير؟
```

### النتيجة المتوقعة:
1. **على الجوال الثاني:** رد من AI:
   ```
   بإذن الله راح يتواصل معك موظفنا قريباً للإجابة على استفسارك
   ```

2. **على جوالك (رقم الإدارة +966503678789):** لازم يوصلك رسالة:
   ```
   🚨 تصعيد من Sales AI
   
   📱 +966xxxxxxxx
   🎯 escalation
   ⚠️ high
   
   💬 المحادثة:
   👤: يا هلا، وش الخدمات...
   🤖: يا هلا بك! نحن في لوني...
   👤: ممكن أكلم المدير؟
   🤖: بإذن الله راح يتواصل...
   ```

---

## ✅ نجحت التجربة إذا:
- ✅ AI رد على الرسالة الأولى
- ✅ وصلك تنبيه التصعيد على رقمك
- ✅ المحادثات محفوظة في Database
- ✅ السيرفر يطبع logs واضحة

---

## 🐛 إذا ما اشتغل:

### المشكلة: ما يوصل رد من AI
**الحل:**
```bash
# شوف logs السيرفر - ابحث عن errors
# تحقق من OpenAI API key:
node -e "console.log(process.env.OPENAI_API_KEY?.slice(0,7))"
# لازم يطلع: sk-proj
```

### المشكلة: ما يوصل تصعيد لرقمك
**الحل:**
```bash
# تحقق رقم الإدارة صحيح:
node -e "require('dotenv').config(); console.log(process.env.ADMIN_PHONE)"
# لازم يطلع: +966503678789

# شوف logs السيرفر - ابحث عن:
# [Webhook] 🚨 ESCALATION
```

### المشكلة: Evolution API ما يشتغل
**الحل:**
```bash
# تحقق Docker شغال:
docker ps

# شوف logs:
docker logs evolution-api
```

---

## 📹 فيديو المشكلة؟
أرسل screenshot من:
1. Terminal السيرفر (آخر 20 سطر)
2. شاشة الواتساب (الرسائل)
3. Supabase → Table Editor → sales_conversations

---

**جاهز؟ ابدأ من الخطوة 1!** 🚀
