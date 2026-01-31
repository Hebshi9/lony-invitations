# ⚡ تم إصلاح WORKFLOW_SCHEMA.sql

## المشكلة:
```
ERROR: column "user_id" does not exist
```

## السبب:
Supabase لا يسمح بـ `REFERENCES auth.users(id)` مباشرة

## الحل: ✅
استبدلنا:
```sql
user_id UUID REFERENCES auth.users(id)
```

بـ:
```sql
user_id UUID  -- auth.uid() from Supabase Auth
```

---

## جرب الآن:

1. افتح Supabase SQL Editor
2. الصق محتوى `WORKFLOW_SCHEMA.sql` (المحدّث)
3. RUN
4. يجب أن يعمل بدون أخطاء! ✅

---

## ملاحظة:
`user_id` سيتم ملؤه من `auth.uid()` عند الإدراج، وRLS policies ستتحقق منه تلقائياً.
