# 🤖 دليل تشغيل Sales AI Agent

## 📋 المتطلبات
1. Evolution API شغال على `http://localhost:8081`
2. قاعدة بيانات Supabase محدثة
3. رقم واتساب متصل

---

## 🚀 خطوات التشغيل

### 1️⃣ إنشاء الجداول في Supabase

```bash
# افتح Supabase Dashboard → SQL Editor
# شغل ملف: supabase/migrations/sales_ai_conversations.sql
```

أو استخدم السكريبت:
```bash
node scripts/setup-sales-tables.js
```

### 2️⃣ تحديث `.env`

تأكد من وجود:
```env
ADMIN_PHONE=+966533161040          # رقمك للتصعيد
OPENAI_API_KEY=sk-proj-...         # مفتاح OpenAI
EVOLUTION_URL=http://localhost:8081
EVOLUTION_API_KEY=...
```

### 3️⃣ تشغيل السيرفر

```bash
npm run whatsapp:server
```

### 4️⃣ ربط رقمك

1. افتح: `http://localhost:5173/whatsapp-sender`
2. أضف حساب جديد
3. امسح QR Code
4. انتظر الاتصال

### 5️⃣ إعداد Webhook

إذا كنت تستخدم localhost، استخدم ngrok:

```bash
ngrok http 3001
```

بعدها سجل الـ webhook:
```bash
curl -X POST http://localhost:3001/api/whatsapp/setup-webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-NGROK-URL.ngrok.io/webhook"}'
```

---

## 🧪 التجربة

### اختبار AI فقط:
```bash
node scripts/demo-sales-ai.js
```

### اختبار شامل مع Webhook:
```bash
# شغل السيرفر في terminal منفصل
npm run whatsapp:server

# في terminal آخر
node scripts/test-webhook-ai.js
```

### الاستخدام الفعلي:
1. من أي رقم واتساب، أرسل رسالة لرقمك المربوط
2. شوف الرد التلقائي من AI
3. في حالة التصعيد، راح يوصلك إشعار

---

## 📊 متابعة المحادثات

### طريقة 1: Dashboard في الموقع
افتح: `http://localhost:5173/sales-dashboard`

### طريقة 2: من قاعدة البيانات
```sql
-- كل المحادثات النشطة
SELECT * FROM sales_dashboard 
WHERE status = 'active' 
ORDER BY last_contact_at DESC;

-- المصعّدة فقط
SELECT * FROM sales_dashboard 
WHERE escalated = true;

-- تفاصيل محادثة معينة
SELECT * FROM sales_messages 
WHERE conversation_id = 'xxx' 
ORDER BY created_at;
```

### طريقة 3: API Endpoint
```bash
curl http://localhost:3001/api/sales/conversations
```

---

## 🔔 كيف يشتغل التصعيد؟

عندما العميل:
- يطلب التحدث مع إدارة
- يطرح سؤال تقني معقد
- النية تكون `escalation`
- الأولوية `high`

يصير:
1. ✅ المحادثة تتحدث في DB → `escalated: true`
2. 📨 يرسل لرقمك الخاص ملخص المحادثة
3. 🎯 تقدر ترد مباشرة للعميل

الرسالة اللي راح توصلك:
```
🚨 *تصعيد من Sales AI*

📱 +966501234567
🎯 escalation
⚠️ high

💬 المحادثة:
👤: أبي أتكلم مع المدير
🤖: بإذن الله راح يتواصل معك أحد موظفينا

⏰ الوقت: ...
```

---

## 📝 ملاحظات مهمة

1. **الخصوصية**: كل المحادثات محفوظة في `sales_conversations` و `sales_messages`
2. **الأمان**: API Keys في `.env` ما تُرفع على GitHub
3. **التكلفة**: OpenAI GPT-4o-mini رخيص جداً (~$0.15 لكل 1M tokens)
4. **السرعة**: الرد عادةً < 2 ثانية

---

## 🐛 حل المشاكل

### المشكلة: AI ما يرد
```bash
# تحقق من API Key
node -e "console.log(process.env.OPENAI_API_KEY?.slice(-4))"

# جرب مباشرة
node scripts/demo-sales-ai.js
```

### المشكلة: Webhook ما يشتغل
```bash
# شوف logs السيرفر
# تأكد Evolution API شغال
curl http://localhost:8081/manager/status
```

### المشكلة: ما يوصل تصعيد
```bash
# تحقق من رقم الإدارة
echo $ADMIN_PHONE

# شوف الـ logs
# ابحث عن: [Webhook] 🚨 ESCALATION
```

---

## 📈 الخطوات القادمة

- [ ] ربط مع CRM (إذا عندك)
- [ ] تقارير يومية بالپ PDF
- [ ] تحليل AI للعملاء (Customer Insights)
- [ ] رد تلقائي لأسئلة شائعة (FAQ)

---

**جاهز للاستخدام!** 🎉

أي استفسار؟ شغل:
```bash
node scripts/demo-sales-ai.js
```
