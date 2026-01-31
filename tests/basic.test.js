import { describe, it, expect } from 'vitest';

// اختبار بسيط للتحقق من أن Vitest يعمل
describe('اختبار أساسي', () => {
    it('يجب أن ينجح هذا الاختبار', () => {
        expect(1 + 1).toBe(2);
    });

    it('يجب أن تعمل العمليات النصية', () => {
        const greeting = 'مرحباً';
        expect(greeting).toBe('مرحباً');
        expect(greeting.length).toBeGreaterThan(0);
    });

    it('يجب أن تعمل المصفوفات', () => {
        const numbers = [1, 2, 3];
        expect(numbers).toHaveLength(3);
        expect(numbers).toContain(2);
    });

    it('يجب أن تعمل الكائنات', () => {
        const user = {
            name: 'أحمد',
            role: 'admin'
        };

        expect(user).toHaveProperty('name');
        expect(user.name).toBe('أحمد');
    });
});

// اختبار بيئة React
describe('بيئة React', () => {
    it('يجب أن يكون jsdom متاحاً', () => {
        expect(typeof window).toBe('object');
        expect(typeof document).toBe('object');
    });

    it('يجب أن تعمل DOM APIs', () => {
        const div = document.createElement('div');
        div.textContent = 'اختبار';

        expect(div.nodeName).toBe('DIV');
        expect(div.textContent).toBe('اختبار');
    });
});
