import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Users, Send, CheckCircle, Scan, RefreshCw, Download, MessageCircle, Lock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { hasFeature, EventFeatures } from '../lib/features';

const AnalyticsDashboard: React.FC = () => {
    const [stats, setStats] = useState({
        totalGuests: 0,
        totalInvited: 0,
        confirmed: 0,
        scanned: 0,
        whatsappSent: 0
    });
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Fetch Events 
    useEffect(() => {
        const loadEvents = async () => {
            const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
            if (data && data.length > 0) {
                setEvents(data);
                setSelectedEventId(data[0].id);
                setSelectedEvent(data[0]);
            }
        };
        loadEvents();
    }, []);

    // Update selected event when ID changes
    useEffect(() => {
        const event = events.find(e => e.id === selectedEventId);
        if (event) setSelectedEvent(event);
    }, [selectedEventId, events]);

    // Fetch Stats when event changes
    useEffect(() => {
        if (!selectedEventId) return;
        fetchStats();
    }, [selectedEventId]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // 1. Guests Stats
            const { data: guests } = await supabase
                .from('guests')
                .select('status, card_generated')
                .eq('event_id', selectedEventId);

            const total = guests?.length || 0;
            const cofirmedCount = guests?.filter(g => g.status === 'confirmed').length || 0;
            const generatedCount = guests?.filter(g => g.card_generated).length || 0;

            // 2. Scans
            const { count: scanCount } = await supabase
                .from('scans')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', selectedEventId);

            // 3. WhatsApp Messages (Assuming we log them in whatsapp_messages linked to event indirectly or just count sent guests)
            // For now, let's assume 'status=sent' in guests table implies whatsapp sent if we update it there, 
            // OR query whatsapp_messages table.
            // Let's query checks on guests table for now as it's cleaner if we updated it.
            // Actually, let's check whatsapp_messages table if possible.
            // But for simplicity, let's use guest status or card_generated as proxy for "Invited" for now.

            setStats({
                totalGuests: total,
                totalInvited: generatedCount, // Proxy for invited
                confirmed: cofirmedCount,
                scanned: scanCount || 0,
                whatsappSent: generatedCount // Approx
            });

        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateRSVPReport = (guests: any[], event: any) => {
        const confirmed = guests.filter((g: any) => g.rsvp_status === 'confirmed');
        const declined = guests.filter((g: any) => g.rsvp_status === 'declined');
        const noResponse = guests.filter((g: any) => !g.rsvp_status || g.rsvp_status === 'pending');

        let report = `📊 *تقرير RSVP - ${event.name}*\n\n`;
        report += `📅 التاريخ: ${event.date}\n`;
        report += `📍 المكان: ${event.location}\n\n`;
        report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // إحصائيات
        report += `📈 *الإحصائيات:*\n`;
        report += `✅ أكدوا الحضور: ${confirmed.length}\n`;
        report += `❌ اعتذروا: ${declined.length}\n`;
        report += `❓ لم يردوا: ${noResponse.length}\n`;
        report += `📊 الإجمالي: ${guests.length}\n\n`;
        report += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // قائمة المؤكدين
        if (confirmed.length > 0) {
            report += `✅ *المؤكدين (${confirmed.length}):*\n\n`;
            confirmed.forEach((g: any, i: number) => {
                report += `${i + 1}. ${g.name}\n`;
                report += `   📱 ${g.phone}\n\n`;
            });
            report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        // قائمة المعتذرين
        if (declined.length > 0) {
            report += `❌ *المعتذرين (${declined.length}):*\n\n`;
            declined.forEach((g: any, i: number) => {
                report += `${i + 1}. ${g.name}\n`;
                report += `   📱 ${g.phone}\n\n`;
            });
            report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        // قائمة غير المؤكدين
        if (noResponse.length > 0) {
            report += `❓ *لم يردوا (${noResponse.length}):*\n\n`;
            noResponse.forEach((g: any, i: number) => {
                report += `${i + 1}. ${g.name}\n`;
                report += `   📱 ${g.phone}\n\n`;
            });
        }

        return report;
    };

    const sendReportToClient = async () => {
        if (!selectedEventId) {
            alert('الرجاء اختيار حدث أولاً');
            return;
        }

        const clientPhone = prompt('أدخل رقم واتساب العميل (مع كود الدولة، مثال: 966500000000):');
        if (!clientPhone) return;

        try {
            setLoading(true);

            // جلب بيانات الحدث والضيوف
            const { data: event } = await supabase
                .from('events')
                .select('*')
                .eq('id', selectedEventId)
                .single();

            const { data: guests } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', selectedEventId);

            if (!event || !guests) {
                throw new Error('لم يتم العثور على البيانات');
            }

            // توليد التقرير
            const report = generateRSVPReport(guests, event);

            // إرسال عبر WhatsApp API
            const response = await fetch('http://localhost:3001/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: 'primary',
                    phone: clientPhone,
                    message: report
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('✅ تم إرسال التقرير للعميل بنجاح!');
            } else {
                throw new Error(result.error || 'فشل الإرسال');
            }
        } catch (error: any) {
            console.error('Error sending report:', error);
            alert('❌ خطأ في إرسال التقرير: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!selectedEventId) return;
        setLoading(true);
        try {
            // Fetch comprehensive data
            const { data: guests, error } = await supabase
                .from('guests')
                .select(`
                    name,
                    phone,
                    table_no,
                    category,
                    companions_count,
                    status,
                    card_generated,
                    card_generated_at,
                    card_number,
                    qr_token
                `)
                .eq('event_id', selectedEventId);

            if (error || !guests) throw error;

            // Transform data for clean excel
            const excelRows = guests.map(g => ({
                'الاسم': g.name,
                'رقم الجوال': g.phone,
                'رقم الطاولة': g.table_no,
                'الفئة': g.category,
                'عدد المرافقين': g.companions_count,
                'الحالة (RSVP)': g.status === 'confirmed' ? 'حاضر' : g.status === 'declined' ? 'عتذر' : 'معلق',
                'تم توليد الكرت': g.card_generated ? 'نعم' : 'لا',
                'رقم الكرت': g.card_number,
                'تاريخ التوليد': g.card_generated_at ? new Date(g.card_generated_at).toLocaleDateString('ar-SA') : '-',
                'رابط الدعوة': `https://lonyinvite.netlify.app/check-in.html?token=${g.qr_token}`
            }));

            // Generate Sheet
            const ws = XLSX.utils.json_to_sheet(excelRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "التقرير الشامل");

            // Save File
            XLSX.writeFile(wb, `Lony_Report_${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (err) {
            console.error(err);
            alert('حدث خطأ أثناء تصدير التقرير');
        } finally {
            setLoading(false);
        }
    };

    const dataPie = [
        { name: 'حضور مؤكد', value: stats.confirmed, color: '#10B981' }, // Green
        { name: 'لم يرد', value: stats.totalGuests - stats.confirmed, color: '#E5E7EB' } // Gray
    ];

    const dataBar = [
        { name: 'الضيوف', value: stats.totalGuests },
        { name: 'الكروت', value: stats.totalInvited },
        { name: 'الحضور (Scan)', value: stats.scanned }
    ];

    // Check if live analytics feature is enabled
    if (selectedEvent && !hasFeature(selectedEvent, 'live_analytics')) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">التحليلات المباشرة غير مفعلة</h2>
                        <p className="text-gray-600 mb-6">
                            ميزة التحليلات المباشرة غير متاحة لهذا الحدث. يرجى تفعيلها من إعدادات الحدث.
                        </p>
                        <div className="bg-blue-50 rounded-lg p-4 text-right">
                            <p className="text-sm text-blue-800">
                                💡 يمكنك تفعيل هذه الميزة من صفحة تعديل الحدث
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto font-kufi" dir="rtl">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-lony-navy font-amiri">لوحة الإحصائيات (Analytics)</h1>
                <div className="flex gap-2">
                    <select
                        className="p-2 border rounded-lg"
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                    >
                        {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button onClick={fetchStats} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-bold"
                        disabled={loading || !selectedEventId}
                    >
                        <Download className="w-4 h-4" />
                        تصدير Excel
                    </button>
                    <button
                        onClick={sendReportToClient}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-bold"
                        disabled={loading || !selectedEventId}
                    >
                        <MessageCircle className="w-4 h-4" />
                        إرسال تقرير للعميل
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">إجمالي الضيوف</p>
                            <h3 className="text-3xl font-bold text-gray-800">{stats.totalGuests}</h3>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Users className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">تمت الدعوة</p>
                            <h3 className="text-3xl font-bold text-purple-600">{stats.totalInvited}</h3>
                        </div>
                        <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                            <Send className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">تأكيد حضور (RSVP)</p>
                            <h3 className="text-3xl font-bold text-green-600">{stats.confirmed}</h3>
                        </div>
                        <div className="bg-green-100 p-3 rounded-full text-green-600">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">تم المسح (Scanned)</p>
                            <h3 className="text-3xl font-bold text-orange-600">{stats.scanned}</h3>
                        </div>
                        <div className="bg-orange-100 p-3 rounded-full text-orange-600">
                            <Scan className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="h-80">
                    <CardHeader>
                        <CardTitle className="text-lg">نسبة الحضور المتوقعة</CardTitle>
                    </CardHeader>
                    <CardContent className="h-full pb-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {dataPie.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 text-xs mt-[-20px]">
                            {dataPie.map((item) => (
                                <div key={item.name} className="flex items-center gap-1">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                    {item.name}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="h-80">
                    <CardHeader>
                        <CardTitle className="text-lg">نظرة عامة</CardTitle>
                    </CardHeader>
                    <CardContent className="h-full pb-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataBar}>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
