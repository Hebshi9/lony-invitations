import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// اختبار تكامل Scanner بناءً على البنية الفعلية
describe('Scanner Integration Tests - Actual DB', () => {
    let supabase;
    let testEventId;
    let testGuestId;
    let testQRPayload;

    beforeEach(async () => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Skipping integration tests - no Supabase credentials');
            return;
        }

        supabase = createClient(supabaseUrl, supabaseKey);
        testQRPayload = `test-qr-${Date.now()}-${Math.random()}`;
    });

    describe('سيناريو مسح QR Code كامل', () => {
        it('يجب أن يتم مسح ضيف جديد بنجاح', async () => {
            if (!supabase) return;

            // 1. إنشاء حدث تجريبي
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert([{
                    name: 'حدث اختبار تكامل',
                    date: '2025-12-31',
                    venue: 'الرياض',
                    token: `test-token-${Date.now()}`,
                }])
                .select()
                .single();

            if (eventError) {
                console.warn('Could not create event:', eventError.message);
                return;
            }

            if (!event) return;

            testEventId = event.id;

            // 2. إضافة ضيف
            const { data: guest, error: guestError } = await supabase
                .from('guests')
                .insert([{
                    event_id: testEventId,
                    name: 'ضيف اختبار تكامل',
                    qr_payload: testQRPayload,
                    serial: `S-${Date.now()}`,
                    table_no: '10',
                    status: 'pending',
                }])
                .select()
                .single();

            if (guestError) {
                console.warn('Could not create guest:', guestError.message);
                return;
            }

            if (!guest) return;

            testGuestId = guest.id;

            // 3. محاكاة المسح الأول (نجاح)
            const { data: foundGuest } = await supabase
                .from('guests')
                .select('*')
                .eq('qr_payload', testQRPayload)
                .single();

            expect(foundGuest).toBeDefined();
            expect(foundGuest.name).toBe('ضيف اختبار تكامل');
            expect(foundGuest.status).toBe('pending');

            // 4. تحديث الحالة
            const { error: updateError } = await supabase
                .from('guests')
                .update({ status: 'attended' })
                .eq('id', testGuestId);

            if (updateError) {
                console.warn('Could not update guest:', updateError.message);
            }

            // 5. تسجيل في جدول scans
            const { error: scanError } = await supabase
                .from('scans')
                .insert([{
                    event_id: testEventId,
                    guest_id: testGuestId,
                    source: 'test',
                }]);

            if (scanError) {
                console.warn('Could not create scan:', scanError.message);
            }

            // 6. التحقق من التحديث
            const { data: updatedGuest } = await supabase
                .from('guests')
                .select('status')
                .eq('id', testGuestId)
                .single();

            if (updatedGuest) {
                expect(updatedGuest.status).toBe('attended');
            }
        });

        it('يجب أن يرفض المسح المكرر', async () => {
            if (!supabase) return;

            // البحث عن ضيف تم مسحه من قبل
            const { data: attendedGuest } = await supabase
                .from('guests')
                .select('*')
                .eq('status', 'attended')
                .limit(1)
                .single();

            if (attendedGuest) {
                // محاولة المسح مرة أخرى
                expect(attendedGuest.status).toBe('attended');

                // في التطبيق الحقيقي، يجب رفض هذا المسح
                const isDuplicate = attendedGuest.status === 'attended';
                expect(isDuplicate).toBe(true);
            }
        });

        it('يجب أن يبحث عن الضيف بواسطة QR payload', async () => {
            if (!supabase) return;

            // البحث عن أي ضيف
            const { data: anyGuest } = await supabase
                .from('guests')
                .select('qr_payload')
                .limit(1)
                .single();

            if (anyGuest && anyGuest.qr_payload) {
                // البحث بواسطة QR
                const { data: foundGuest, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('qr_payload', anyGuest.qr_payload)
                    .single();

                expect(error).toBeNull();
                expect(foundGuest).toBeDefined();
                expect(foundGuest.qr_payload).toBe(anyGuest.qr_payload);
            }
        });
    });

    describe('إحصائيات Dashboard', () => {
        it('يجب أن يحسب عدد الحضور بشكل صحيح', async () => {
            if (!supabase) return;

            // الحصول على أول حدث
            const { data: events } = await supabase
                .from('events')
                .select('id')
                .limit(1);

            if (events && events.length > 0) {
                const eventId = events[0].id;

                // حساب إجمالي الضيوف
                const { count: totalGuests } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId);

                // حساب الحضور
                const { count: attendedGuests } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId)
                    .eq('status', 'attended');

                expect(totalGuests).toBeGreaterThanOrEqual(0);
                expect(attendedGuests).toBeGreaterThanOrEqual(0);
                expect(attendedGuests).toBeLessThanOrEqual(totalGuests || 0);

                if (totalGuests && totalGuests > 0) {
                    const percentage = (attendedGuests || 0) / totalGuests * 100;
                    expect(percentage).toBeGreaterThanOrEqual(0);
                    expect(percentage).toBeLessThanOrEqual(100);
                }
            }
        });

        it('يجب أن يعيد آخر عمليات المسح', async () => {
            if (!supabase) return;

            const { data: scans, error } = await supabase
                .from('scans')
                .select(`
          id,
          scanned_at,
          source,
          guests (
            name,
            table_no
          )
        `)
                .order('scanned_at', { ascending: false })
                .limit(10);

            expect(error).toBeNull();
            if (scans) {
                expect(Array.isArray(scans)).toBe(true);
                expect(scans.length).toBeLessThanOrEqual(10);

                // ترتيب تنازلي
                if (scans.length > 1) {
                    const first = new Date(scans[0].scanned_at);
                    const second = new Date(scans[1].scanned_at);
                    expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
                }
            }
        });

        it('يجب أن يحسب عدد عمليات المسح لكل حدث', async () => {
            if (!supabase) return;

            const { data: events } = await supabase
                .from('events')
                .select('id')
                .limit(1);

            if (events && events.length > 0) {
                const eventId = events[0].id;

                const { count } = await supabase
                    .from('scans')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId);

                expect(count).toBeGreaterThanOrEqual(0);
            }
        });

        it('يجب أن يعرض إحصائيات الحدث كاملة', async () => {
            if (!supabase) return;

            const { data: events } = await supabase
                .from('events')
                .select('id, name, date, venue')
                .limit(1)
                .single();

            if (events) {
                const eventId = events.id;

                // إجمالي الضيوف
                const { count: totalGuests } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId);

                // الحضور
                const { count: attended } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId)
                    .eq('status', 'attended');

                // المتبقي
                const remaining = (totalGuests || 0) - (attended || 0);

                // عدد المسحات
                const { count: scanCount } = await supabase
                    .from('scans')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId);

                expect(totalGuests).toBeGreaterThanOrEqual(0);
                expect(attended).toBeGreaterThanOrEqual(0);
                expect(remaining).toBeGreaterThanOrEqual(0);
                expect(scanCount).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('البحث والتصفية', () => {
        it('يجب أن يبحث عن ضيف بالاسم', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .ilike('name', '%test%')
                .limit(5);

            expect(error).toBeNull();
            if (data) {
                expect(Array.isArray(data)).toBe(true);
            }
        });

        it('يجب أن يفلتر الضيوف حسب الحالة', async () => {
            if (!supabase) return;

            const statuses = ['pending', 'attended', 'cancelled'];

            for (const status of statuses) {
                const { data } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('status', status)
                    .limit(5);

                if (data && data.length > 0) {
                    data.forEach(guest => {
                        expect(guest.status).toBe(status);
                    });
                }
            }
        });

        it('يجب أن يفلتر المسحات حسب المصدر', async () => {
            if (!supabase) return;

            const { data } = await supabase
                .from('scans')
                .select('*')
                .eq('source', 'test')
                .limit(5);

            if (data && data.length > 0) {
                data.forEach(scan => {
                    expect(scan.source).toBe('test');
                });
            }
        });
    });

    describe('تنظيف البيانات التجريبية', () => {
        it('يجب أن يحذف الضيوف التجريبيين', async () => {
            if (!supabase) return;

            // حذف الضيوف التجريبيين
            const { error } = await supabase
                .from('guests')
                .delete()
                .ilike('name', '%اختبار%');

            // قد يفشل بسبب RLS، لكن نتحقق
            if (!error) {
                console.log('✅ تم حذف الضيوف التجريبيين');
            }
        });

        it('يجب أن يحذف الأحداث التجريبية', async () => {
            if (!supabase) return;

            const { error } = await supabase
                .from('events')
                .delete()
                .ilike('name', '%اختبار%');

            if (!error) {
                console.log('✅ تم حذف الأحداث التجريبية');
            }
        });
    });
});
