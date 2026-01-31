# 🤝 دليل المساهمة - Contributing Guide

مرحباً بك في مشروع **Lony Invitations**! نحن نرحب بمساهماتك 🎉

---

## 📋 جدول المحتويات

1. [البدء السريع](#البدء-السريع)
2. [معايير الكود](#معايير-الكود)
3. [هيكلة المشروع](#هيكلة-المشروع)
4. [كيفية إضافة ميزة جديدة](#كيفية-إضافة-ميزة-جديدة)
5. [الاختبارات](#الاختبارات)
6. [Pull Requests](#pull-requests)

---

## 🚀 البدء السريع

### 1. Fork المشروع
```bash
# استنساخ المشروع
git clone https://github.com/your-username/lony-invitations.git
cd lony-invitations-frontend

# إنشاء branch جديد
git checkout -b feature/your-feature-name
```

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. إعداد البيئة
```bash
# نسخ ملف .env.example
cp .env.example .env

# إضافة المفاتيح الخاصة بك
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

### 4. تشغيل المشروع
```bash
npm run dev
```

---

## 📏 معايير الكود

### TypeScript
- ✅ استخدم TypeScript لجميع الملفات الجديدة
- ✅ أضف types واضحة لجميع المتغيرات والدوال
- ✅ تجنب استخدام `any`

```typescript
// ❌ سيء
function processGuest(data: any) {
  return data.name;
}

// ✅ جيد
interface Guest {
  id: string;
  name: string;
  eventId: string;
}

function processGuest(data: Guest): string {
  return data.name;
}
```

### React Components
- ✅ استخدم Functional Components مع Hooks
- ✅ أضف JSDoc comments للمكونات الرئيسية
- ✅ اتبع نمط التسمية: `PascalCase` للمكونات

```typescript
/**
 * ماسح QR Code للدعوات
 * @description يسمح للمشرفين بمسح دعوات الضيوف
 * @param {string} eventId - معرف الحدث
 */
export default function Scanner({ eventId }: { eventId: string }) {
  // ...
}
```

### CSS/Styling
- ✅ استخدم Tailwind CSS للتنسيق
- ✅ اتبع نظام الألوان الموحد
- ✅ تأكد من دعم RTL للعربية

```tsx
// ✅ جيد
<div className="bg-lony-navy text-white p-4 rounded-lg">
  محتوى
</div>
```

### التسمية
- **الملفات**: `PascalCase.tsx` للمكونات، `camelCase.ts` للـ utilities
- **المتغيرات**: `camelCase`
- **الثوابت**: `UPPER_SNAKE_CASE`
- **المكونات**: `PascalCase`

---

## 🏗️ هيكلة المشروع

```
src/
├── pages/              # صفحات التطبيق
│   ├── admin/         # صفحات الإدارة
│   ├── client/        # صفحات العميل
│   └── guest/         # صفحات الضيف
├── components/         # مكونات قابلة لإعادة الاستخدام
│   ├── editor/        # محررات التصميم
│   ├── lists/         # قوائم البيانات
│   └── ui/            # مكونات UI أساسية
├── lib/               # مكتبات مساعدة
├── services/          # خدمات الأعمال
├── hooks/             # React Hooks مخصصة
├── contexts/          # React Contexts
├── types/             # TypeScript Types
└── constants/         # ثوابت التطبيق
```

---

## ✨ كيفية إضافة ميزة جديدة

### 1. خطط للميزة
- حدد الهدف بوضوح
- ارسم تصور للواجهة
- حدد التغييرات المطلوبة في قاعدة البيانات

### 2. أنشئ الملفات
```bash
# مثال: إضافة ميزة تصدير PDF
src/
├── pages/
│   └── admin/
│       └── ExportPDF.tsx        # الصفحة الجديدة
├── services/
│   └── pdf-service.ts           # منطق التصدير
└── types/
    └── pdf.ts                   # Types للـ PDF
```

### 3. اتبع النمط الموحد
```typescript
// src/services/pdf-service.ts
import { Guest, Event } from '@/types';

/**
 * تصدير قائمة الضيوف إلى PDF
 * @param event - بيانات الحدث
 * @param guests - قائمة الضيوف
 * @returns Promise<Blob> - ملف PDF
 */
export async function exportGuestsToPDF(
  event: Event,
  guests: Guest[]
): Promise<Blob> {
  // منطق التصدير
}
```

### 4. أضف الاختبارات
```typescript
// tests/pdf-service.test.ts
import { describe, it, expect } from 'vitest';
import { exportGuestsToPDF } from '@/services/pdf-service';

describe('PDF Export Service', () => {
  it('should export guests to PDF', async () => {
    const result = await exportGuestsToPDF(mockEvent, mockGuests);
    expect(result).toBeInstanceOf(Blob);
  });
});
```

### 5. حدّث التوثيق
- أضف الميزة إلى `CHANGELOG.md`
- حدّث `README.md` إذا لزم الأمر
- أضف أمثلة استخدام

---

## 🧪 الاختبارات

### تشغيل الاختبارات
```bash
# جميع الاختبارات
npm run test

# اختبار ملف محدد
npm run test -- Scanner.test.tsx

# اختبار مع coverage
npm run test:coverage
```

### كتابة اختبارات جيدة
```typescript
describe('Scanner Component', () => {
  it('should scan QR code successfully', async () => {
    // Arrange
    const mockGuest = { id: '1', name: 'أحمد' };
    
    // Act
    render(<Scanner eventId="event-1" />);
    await scanQRCode(mockGuest.id);
    
    // Assert
    expect(screen.getByText('أحمد')).toBeInTheDocument();
  });
});
```

---

## 🔄 Pull Requests

### قبل إرسال PR

1. ✅ **تأكد من عمل الكود**
```bash
npm run dev      # اختبر محلياً
npm run build    # تأكد من البناء
npm run test     # شغّل الاختبارات
```

2. ✅ **نظّف الكود**
```bash
npm run lint     # تحقق من الأخطاء
npm run format   # نسّق الكود
```

3. ✅ **اكتب commit واضح**
```bash
git commit -m "feat: add PDF export feature"
git commit -m "fix: resolve QR scanner camera issue"
git commit -m "docs: update README with new setup steps"
```

### نمط Commit Messages
- `feat:` - ميزة جديدة
- `fix:` - إصلاح خطأ
- `docs:` - تحديث التوثيق
- `style:` - تنسيق الكود
- `refactor:` - إعادة هيكلة
- `test:` - إضافة اختبارات
- `chore:` - مهام صيانة

### قالب PR
```markdown
## الوصف
وصف واضح للتغييرات

## نوع التغيير
- [ ] ميزة جديدة
- [ ] إصلاح خطأ
- [ ] تحسين
- [ ] تحديث توثيق

## الاختبار
كيف تم اختبار التغييرات؟

## Screenshots (إن وجدت)
أضف صور للواجهة

## Checklist
- [ ] الكود يعمل محلياً
- [ ] تم إضافة اختبارات
- [ ] تم تحديث التوثيق
```

---

## 🐛 الإبلاغ عن الأخطاء

### قالب Issue
```markdown
**وصف المشكلة:**
وصف واضح للمشكلة

**خطوات إعادة الإنتاج:**
1. اذهب إلى '...'
2. اضغط على '...'
3. شاهد الخطأ

**السلوك المتوقع:**
ماذا كان يجب أن يحدث؟

**Screenshots:**
إن وجدت

**البيئة:**
- المتصفح: [Chrome 120]
- نظام التشغيل: [Windows 11]
- نسخة المشروع: [2.0.0]
```

---

## 📞 التواصل

- **Issues**: للأخطاء والاقتراحات
- **Discussions**: للأسئلة العامة
- **Email**: support@lony-invitations.com

---

## 📜 الترخيص

بمساهمتك، توافق على أن يكون عملك تحت نفس ترخيص المشروع (MIT License).

---

**شكراً لمساهمتك! 🙏**

نحن نقدر وقتك وجهدك في تحسين Lony Invitations ❤️
