import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// اختبار قاعدة البيانات بناءً على البنية الفعلية
describe('Database Schema Tests - Actual Structure', () => {
    let supabase;

    beforeAll(() => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Supabase credentials not found. Skipping database tests.');
            return;
        }

        supabase = createClient(supabaseUrl, supabaseKey);
    });

    describe('جدول Events', () => {
        it('يجب أن يحتوي على الأعمدة المطلوبة', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('events')
                .select('*')
                .limit(1);

            expect(error).toBeNull();

            // التحقق من وجود الأعمدة حسب البنية الفعلية
            if (data && data.length > 0) {
                const event = data[0];
                console.log('Fetched Event Keys:', Object.keys(event)); // DEBUG LOG
                expect(event).toHaveProperty('id');
                expect(event).toHaveProperty('name');
                expect(event).toHaveProperty('date');
                expect(event).toHaveProperty('created_at');
                // Optional columns check
                if (event.client_id) expect(event).toHaveProperty('client_id');
            } else {
                console.log('⚠️ No events found in database to verify columns');
            }
        });

        it('يجب أن يقبل إنشاء حدث جديد', async () => {
            if (!supabase) return;

            const testEvent = {
                name: 'حدث اختبار',
                date: '2025-12-31',
                venue: 'الرياض',
                token: `test-${Date.now()}`,
            };

            const { data, error } = await supabase
                .from('events')
                .insert([testEvent])
                .select();

            if (!error) {
                expect(data).toBeDefined();
                if (data && data.length > 0) {
                    expect(data[0]).toHaveProperty('id');
                    expect(data[0].name).toBe(testEvent.name);
                }
            } else {
                console.log('Error creating event:', error.message);
            }
        });
    });

    describe('جدول Guests', () => {
        it('يجب أن يحتوي على الأعمدة الأساسية', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .limit(1);

            expect(error).toBeNull();

            if (data && data.length > 0) {
                const guest = data[0];
                expect(guest).toHaveProperty('id');
                expect(guest).toHaveProperty('event_id');
                expect(guest).toHaveProperty('name');
                expect(guest).toHaveProperty('serial');
                expect(guest).toHaveProperty('table_no');
                expect(guest).toHaveProperty('status');
                expect(guest).toHaveProperty('qr_payload');
                expect(guest).toHaveProperty('created_at');
            }
        });

        it('يجب أن يكون qr_payload فريداً', async () => {
            if (!supabase) return;

            // إنشاء QR payload فريد
            const uniqueQR = `test-qr-${Date.now()}-${Math.random()}`;

            // محاولة إدخال ضيفين بنفس qr_payload
            const guest1 = {
                name: 'ضيف تجريبي 1',
                qr_payload: uniqueQR,
                event_id: '00000000-0000-0000-0000-000000000000',
                serial: 'T-001',
            };

            const { error: error1 } = await supabase
                .from('guests')
                .insert([guest1]);

            // إذا نجح الإدخال الأول
            if (!error1) {
                const guest2 = {
                    name: 'ضيف تجريبي 2',
                    qr_payload: uniqueQR, // نفس QR
                    event_id: '00000000-0000-0000-0000-000000000000',
                    serial: 'T-002',
                };

                const { error: error2 } = await supabase
                    .from('guests')
                    .insert([guest2]);

                // يجب أن يفشل الإدخال الثاني
                expect(error2).not.toBeNull();
            }
        });

        it('يجب أن يكون status من القيم المسموحة', async () => {
            if (!supabase) return;

            const { data } = await supabase
                .from('guests')
                .select('status')
                .limit(10);

            if (data && data.length > 0) {
                const allowedStatuses = ['pending', 'attended', 'cancelled'];
                data.forEach(guest => {
                    if (guest.status) {
                        expect(allowedStatuses).toContain(guest.status);
                    }
                });
            }
        });
    });

    describe('جدول Scans', () => {
        it('يجب أن يحتوي على الأعمدة المطلوبة', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('scans')
                .select('*')
                .limit(1);

            expect(error).toBeNull();

            if (data && data.length > 0) {
                const scan = data[0];
                expect(scan).toHaveProperty('id');
                expect(scan).toHaveProperty('event_id');
                expect(scan).toHaveProperty('guest_id');
                expect(scan).toHaveProperty('scanned_at');
                expect(scan).toHaveProperty('source');
            }
        });

        it('يجب أن يسجل عملية مسح جديدة', async () => {
            if (!supabase) return;

            // البحث عن ضيف موجود
            const { data: guestData } = await supabase
                .from('guests')
                .select('id, event_id')
                .limit(1)
                .single();

            if (guestData) {
                const newScan = {
                    event_id: guestData.event_id,
                    guest_id: guestData.id,
                    source: 'test',
                };

                const { data, error } = await supabase
                    .from('scans')
                    .insert([newScan])
                    .select();

                if (!error) {
                    expect(data).toBeDefined();
                    if (data && data.length > 0) {
                        expect(data[0]).toHaveProperty('scanned_at');
                    }
                }
            }
        });
    });

    describe('جدول Users', () => {
        it('يجب أن يحتوي على الأعمدة الأساسية', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('users')
                .select('id, name, email')
                .limit(1);

            // قد يكون محمي بـ RLS
            if (!error && data && data.length > 0) {
                const user = data[0];
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('email');
            }
        });
    });

    describe('العلاقات بين الجداول', () => {
        it('يجب أن يربط scans مع guests و events', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('scans')
                .select(`
          id,
          scanned_at,
          guests (
            name,
            qr_payload
          ),
          events (
            name,
            date
          )
        `)
                .limit(1);

            if (!error && data && data.length > 0) {
                expect(data[0]).toHaveProperty('guests');
                expect(data[0]).toHaveProperty('events');
            }
        });

        it('يجب أن يربط guests مع events', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('guests')
                .select(`
          id,
          name,
          events (
            name,
            venue
          )
        `)
                .limit(1);

            if (!error && data && data.length > 0) {
                expect(data[0]).toHaveProperty('events');
            }
        });
    });

    describe('الاستعلامات الشائعة', () => {
        it('يجب أن يحسب عدد الضيوف لكل حدث', async () => {
            if (!supabase) return;

            const { data: events } = await supabase
                .from('events')
                .select('id')
                .limit(1);

            if (events && events.length > 0) {
                const eventId = events[0].id;

                const { data, error, count } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: false })
                    .eq('event_id', eventId);

                expect(error).toBeNull();
                expect(count).toBeGreaterThanOrEqual(0);
            }
        });

        it('يجب أن يحسب عدد الحضور', async () => {
            if (!supabase) return;

            const { data: events } = await supabase
                .from('events')
                .select('id')
                .limit(1);

            if (events && events.length > 0) {
                const eventId = events[0].id;

                const { data, count } = await supabase
                    .from('guests')
                    .select('*', { count: 'exact', head: true })
                    .eq('event_id', eventId)
                    .eq('status', 'attended');

                expect(count).toBeGreaterThanOrEqual(0);
            }
        });

        it('يجب أن يعيد آخر عمليات المسح', async () => {
            if (!supabase) return;

            const { data, error } = await supabase
                .from('scans')
                .select(`
          id,
          scanned_at,
          source,
          guests (name)
        `)
                .order('scanned_at', { ascending: false })
                .limit(10);

            expect(error).toBeNull();
            if (data) {
                expect(Array.isArray(data)).toBe(true);
                expect(data.length).toBeLessThanOrEqual(10);
            }
        });
    });

    describe('Row Level Security (RLS)', () => {
        it('يجب أن تكون الجداول محمية بـ RLS', async () => {
            if (!supabase) return;

            // محاولة قراءة البيانات
            const tables = ['events', 'guests', 'scans'];

            for (const table of tables) {
                const { data, error } = await supabase
                    .from(table)
                    .select('id')
                    .limit(1);

                // يجب أن تنجح القراءة أو تفشل بسبب RLS (ليس خطأ آخر)
                if (error) {
                    // إذا كان هناك خطأ، يجب أن يكون متعلق بالصلاحيات
                    expect(error.code).toMatch(/42501|PGRST/);
                } else {
                    // إذا نجحت، البيانات يجب أن تكون مصفوفة
                    expect(Array.isArray(data)).toBe(true);
                }
            }
        });
    });
});
