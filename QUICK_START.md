# 🎯 خطة التجربة المبسطة (بدون Evolution API)

## المشكلة:
Evolution API مو شغال حالياً (يحتاج Docker + إعداد معقد)

## الحل البديل: استخدام Baileys
عندك في المشروع نظام Baileys جاهز ومختبر!

---

## ✅ الخطوات (أسهل بكثير):

### 1. تنفيذ SQL في Supabase

**روح الآن:**
1. https://supabase.com/dashboard
2. اختر مشروعك
3. SQL Editor → New Query
4. **انسخ كل محتوى الملف المفتوح عندك** (`sales_ai_conversations.sql`)
5. الصق → Run
6. انتظر Success ✅

---

### 2. شغّل السيرفر

```powershell
# في terminal نظيف
cd "c:\Users\user\Documents\New folder (3)\lony-invitations-frontend"
npm run whatsapp:server
```

**ملاحظة:** راح يشتغل على port 3001

---

### 3. افتح الواجهة

في المتصفح:
```
http://localhost:5173/whatsapp-sender
```

---

### 4. ربط رقمك

في الصفحة:
1. **رقم الجوال:** `+966503678789`
2. **الاسم:** `رقم لوني - الإدارة`
3. اضغط **حفظ الحساب**
4. اضغط **اتصال (Scan QR)**
5. من جوالك: واتساب → الأجهزة المرتبطة → ربط جهاز → امسح QR

---

### 5. جرب الآن!

#### A. رسالة عادية:
من رقم ثاني، أرسل لرقمك:
```
يا هلا، وش خدماتكم؟
```

**المتوقع:**
- ✅ يوصل رد من AI خلال 2-3 ثانية
- ✅ تشوف في logs السيرفر: `[Sales AI] New conversation`
- ✅ في Supabase → `sales_conversations` → سطر جديد

#### B. تصعيد:
أرسل:
```
ممكن أكلم المدير؟
```

**المتوقع:**
- ✅ AI يرد: "بإذن الله راح يتواصل معك موظفنا..."
- ✅ **يوصلك رسالة على رقمك** (+966503678789) مع ملخص المحادثة
- ✅ في الـ logs: `[Webhook] 🚨 ESCALATION`

---

## 🔍 كيف تتحقق من النتائج:

### في Terminal:
```
[Baileys] 📨 From +966xxx: "يا هلا..."
[Sales AI] 🆕 New conversation for +966xxx
[Sales AI] Intent: inquiry, Priority: medium
```

### في Supabase:
```sql
-- شوف المحادثات
SELECT * FROM sales_conversations 
ORDER BY created_at DESC;

-- شوف الرسائل
SELECT * FROM sales_messages 
ORDER BY created_at DESC 
LIMIT 10;
```

### على جوالك (رقم الإدارة):
لما يصير تصعيد، راح يوصلك:
```
🚨 تصعيد من Sales AI

📱 +966xxxxxxx
🎯 escalation
⚠️ high

💬 المحادثة:
👤: يا هلا...
🤖: يا هلا بك...
👤: ممكن أكلم المدير؟
```

---

## ⚡ الفرق بين Baileys vs Evolution:

| Feature | Baileys (موجود) | Evolution (يحتاج إعداد) |
|---------|-----------------|-------------------------|
| Setup | ✅ جاهز | ❌ يحتاج Docker |
| QR Code | ✅ سهل | ✅ سهل |
| Webhook | ✅ شغال | ⚠️ يحتاج ngrok |
| AI Integration | ✅ جاهز | ✅ جاهز |
| **التوصية** | **ابدأ فيه** | جرب لاحقاً |

---

## 🚀 ملخص سريع (3 خطوات):

```bash
# 1. شغل السيرفر
npm run whatsapp:server

# 2. في متصفح آخر
http://localhost:5173/whatsapp-sender

# 3. ربط QR + جرب من رقم ثاني
```

---

## 🐛 المشاكل الشائعة:

### "QR Code ما يطلع"
```bash
# أعد تشغيل السيرفر
# تأكد من port 3001 مو مستخدم
```

### "ما يرد AI"
```bash
# تحقق من OpenAI key:
node -e "require('dotenv').config(); console.log(process.env.OPENAI_API_KEY?.slice(0,10))"
```

### "ما يوصل تصعيد"
```bash
# تحقق رقمك صح:
node -e "require('dotenv').config(); console.log(process.env.ADMIN_PHONE)"
# لازم: +966503678789
```

---

**ابدأ الآن!** 
1️⃣ SQL في Supabase
2️⃣ `npm run whatsapp:server`
3️⃣ افتح الواجهة وربط QR
4️⃣ جرب!

**تواجه مشكلة؟** شاركني screenshot من Terminal + الواتساب
