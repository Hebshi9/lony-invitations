# 📦 Supabase Storage Setup

## خطوات إنشاء Bucket للكروت

### 1. اذهب لـ Supabase Dashboard
```
https://supabase.com/dashboard/project/YOUR_PROJECT_ID/storage/buckets
```

### 2. أنشئ Bucket جديد
- اضغط "New bucket"
- الاسم: `invitation-cards`
- Public: ✅ نعم (حتى يمكن الوصول للصور عبر URL)
- اضغط "Create bucket"

### 3. تأكد من الإعدادات
```sql
-- تحقق من وجود الbucket
SELECT * FROM storage.buckets WHERE name = 'invitation-cards';

-- يجب أن يكون public = true
```

### 4. إعدادات RLS (Row Level Security)
```sql
-- السماح بالقراءة للجميع
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'invitation-cards' );

-- السماح بالرفع للمستخدمين المصرح لهم
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'invitation-cards' 
  AND auth.role() = 'authenticated'
);

-- السماح بالتحديث
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'invitation-cards' 
  AND auth.role() = 'authenticated'
);
```

### 5. اختبار الرفع
```typescript
// في console المتصفح
const testUpload = async () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const { data, error } = await supabase.storage
        .from('invitation-cards')
        .upload('test/test.txt', blob);
    
    if (error) {
        console.error('Upload failed:', error);
    } else {
        console.log('Upload success!', data);
        
        // احصل على الرابط
        const { data: { publicUrl } } = supabase.storage
            .from('invitation-cards')
            .getPublicUrl('test/test.txt');
        
        console.log('Public URL:', publicUrl);
    }
};

testUpload();
```

### 6. تنظيف الملفات القديمة (اختياري)
```sql
-- حذف الملفات الأقدم من 30 يوم
DELETE FROM storage.objects
WHERE bucket_id = 'invitation-cards'
AND created_at < NOW() - INTERVAL '30 days';
```

---

## ✅ التحقق النهائي

بعد إنشاء الbucket، تأكد من:
1. ✅ الاسم: `invitation-cards`
2. ✅ Public: نعم
3. ✅ RLS Policies: موجودة
4. ✅ الاختبار: نجح

**الآن جاهز للاستخدام!** 🎉
