-- ============================================================
-- 🔐 LONY INVITATIONS - COMPLETE SECURITY LOCKDOWN
-- ============================================================
-- الخطوات:
-- 1. اذهب إلى https://supabase.com/dashboard/project/gxunxhzjqclddoobxvpz
-- 2. اضغط على "SQL Editor" من القائمة اليسرى
-- 3. اضغط "New query"
-- 4. الصق هذا الكود كاملاً
-- 5. اضغط "Run"
-- ============================================================


-- ✅ الخطوة 1: امسح كل المستخدمين الغرباء (غير مصرح بهم)
DELETE FROM auth.users
WHERE email != 'projectju18@gmail.com';


-- ✅ الخطوة 2: أنشئ Function تمنع أي تسجيل جديد نهائياً
CREATE OR REPLACE FUNCTION auth.prevent_unauthorized_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email IS NULL OR lower(trim(NEW.email)) != 'projectju18@gmail.com' THEN
    RAISE EXCEPTION 'Signup is permanently disabled. This system is private.';
  END IF;
  RETURN NEW;
END;
$$;


-- ✅ الخطوة 3: ربط الـ Trigger لتطبيق القانون تلقائياً على كل تسجيل
DROP TRIGGER IF EXISTS enforce_signup_restriction ON auth.users;
CREATE TRIGGER enforce_signup_restriction
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.prevent_unauthorized_signup();


-- ✅ الخطوة 4: تحقق من النتيجة - المفروض يظهر مستخدم واحد فقط
SELECT id, email, created_at, last_sign_in_at, banned_until
FROM auth.users
ORDER BY created_at;

-- ============================================================
-- ✅ النتيجة المتوقعة بعد التنفيذ:
-- • كل الغرباء محذوفون
-- • لا أحد يقدر يسجل حساب جديد (حتى لو وجد رابط التسجيل)
-- • فقط projectju18@gmail.com يقدر يدخل
-- • الـ Trigger يعمل على مستوى قاعدة البيانات مباشرة (أقوى حماية)
-- ============================================================
