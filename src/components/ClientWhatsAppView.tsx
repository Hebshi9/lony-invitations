import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { RefreshCw, CheckCircle, Clock, Download } from 'lucide-react';

interface GuestStatus {
    guest_name: string;
    phone: string;
    delivery_status: string;
    whatsapp_rsvp_status: string;
    sent_at: string;
    delivered_at: string;
    read_at: string;
}

interface RSVPStats {
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_confirmed: number;
    total_declined: number;
    total_maybe: number;
    total_no_response: number;
}

export default function ClientWhatsAppView({ eventId }: { eventId: string }) {
    const [guests, setGuests] = useState<GuestStatus[]>([]);
    const [stats, setStats] = useState<RSVPStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'confirmed' | 'declined' | 'pending'>('all');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // تحديث كل 10 ثواني
        return () => clearInterval(interval);
    }, [eventId]);

    const fetchData = async () => {
        // Fetch guest statuses
        const { data: guestData } = await supabase
            .from('client_whatsapp_view')
            .select('*')
            .eq('event_id', eventId);

        if (guestData) {
            setGuests(guestData);
        }

        // Fetch stats
        const { data: statsData } = await supabase
            .rpc('get_rsvp_stats', { p_event_id: eventId });

        if (statsData && statsData.length > 0) {
            setStats(statsData[0]);
        }

        setLoading(false);
    };

    const getFilteredGuests = () => {
        switch (filter) {
            case 'confirmed':
                return guests.filter(g => g.whatsapp_rsvp_status === 'confirmed');
            case 'declined':
                return guests.filter(g => g.whatsapp_rsvp_status === 'declined');
            case 'pending':
                return guests.filter(g => !g.whatsapp_rsvp_status && g.delivery_status === 'read');
            default:
                return guests;
        }
    };

    const exportDeclinedList = () => {
        const declined = guests.filter(g => g.whatsapp_rsvp_status === 'declined');
        const csv = 'الاسم,الرقم\n' + declined.map(g => `${g.guest_name},${g.phone}`).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `معتذرين_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const filteredGuests = getFilteredGuests();

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>📊 إحصائيات الدعوات</CardTitle>
                        <button
                            onClick={fetchData}
                            className="p-2 hover:bg-gray-100 rounded"
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </CardHeader>
                <CardContent>
                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg text-center">
                                <div className="text-3xl font-bold text-blue-600">{stats.total_sent}</div>
                                <div className="text-sm text-gray-600 mt-1">تم الإرسال</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg text-center">
                                <div className="text-3xl font-bold text-green-600">{stats.total_delivered}</div>
                                <div className="text-sm text-gray-600 mt-1">تم التسليم</div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-lg text-center border-2 border-emerald-300">
                                <div className="text-3xl font-bold text-emerald-600">{stats.total_confirmed}</div>
                                <div className="text-sm text-gray-600 mt-1">✅ أكدوا الحضور</div>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg text-center border-2 border-red-300">
                                <div className="text-3xl font-bold text-red-600">{stats.total_declined}</div>
                                <div className="text-sm text-gray-600 mt-1">❌ اعتذروا</div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <CardTitle>📋 قائمة الضيوف</CardTitle>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => setFilter('all')}
                                variant={filter === 'all' ? 'default' : 'outline'}
                                size="sm"
                            >
                                الكل ({guests.length})
                            </Button>
                            <Button
                                onClick={() => setFilter('confirmed')}
                                variant={filter === 'confirmed' ? 'default' : 'outline'}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                            >
                                أكدوا ({stats?.total_confirmed || 0})
                            </Button>
                            <Button
                                onClick={() => setFilter('declined')}
                                variant={filter === 'declined' ? 'default' : 'outline'}
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                            >
                                اعتذروا ({stats?.total_declined || 0})
                            </Button>
                            <Button
                                onClick={() => setFilter('pending')}
                                variant={filter === 'pending' ? 'default' : 'outline'}
                                size="sm"
                                className="bg-gray-600 hover:bg-gray-700"
                            >
                                لم يردوا ({stats?.total_no_response || 0})
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {filter === 'declined' && filteredGuests.length > 0 && (
                        <div className="mb-4">
                            <Button
                                onClick={exportDeclinedList}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <Download className="w-4 h-4 ml-2" />
                                تحميل قائمة المعتذرين (CSV)
                            </Button>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-right">الاسم</th>
                                    <th className="p-3 text-right">الرقم</th>
                                    <th className="p-3 text-center">حالة التسليم</th>
                                    <th className="p-3 text-center">الرد</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGuests.map((guest, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-medium">{guest.guest_name}</td>
                                        <td className="p-3 font-mono text-xs">{guest.phone}</td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {guest.delivery_status === 'read' && (
                                                    <>
                                                        <CheckCircle className="w-4 h-4 text-purple-500" />
                                                        <span className="text-xs text-purple-600">تم القراءة</span>
                                                    </>
                                                )}
                                                {guest.delivery_status === 'delivered' && (
                                                    <>
                                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                                        <span className="text-xs text-green-600">تم التسليم</span>
                                                    </>
                                                )}
                                                {guest.delivery_status === 'sent' && (
                                                    <>
                                                        <Clock className="w-4 h-4 text-blue-500" />
                                                        <span className="text-xs text-blue-600">قيد الإرسال</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-center">
                                            {guest.whatsapp_rsvp_status === 'confirmed' && (
                                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                                    ✅ أكد الحضور
                                                </span>
                                            )}
                                            {guest.whatsapp_rsvp_status === 'declined' && (
                                                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                                    ❌ اعتذر
                                                </span>
                                            )}
                                            {guest.whatsapp_rsvp_status === 'maybe' && (
                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                                    ❓ ربما
                                                </span>
                                            )}
                                            {!guest.whatsapp_rsvp_status && guest.delivery_status === 'read' && (
                                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                    لم يرد بعد
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredGuests.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                لا توجد بيانات لعرضها
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
