import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { CheckCircle, XCircle, Clock, Users, RefreshCw, ArrowLeftRight } from 'lucide-react';

interface Guest {
    id: string;
    name: string;
    phone?: string;
    rsvp_status: string;
    status: string;
    companions_count: number;
    rsvp_at?: string;
}

interface Replacement {
    id: string;
    original_guest_name: string;
    replacement_guest_name: string;
    replacement_phone: string;
    card_generated: boolean;
    card_sent: boolean;
    created_at: string;
}

const RSVPDashboard: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [guests, setGuests] = useState<Guest[]>([]);
    const [replacements, setReplacements] = useState<Replacement[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'confirmed' | 'declined' | 'pending'>('all');

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (selectedEventId) fetchData();
    }, [selectedEventId]);

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('id, name, date, client_phone').order('date', { ascending: false });
        if (data) {
            setEvents(data);
            if (data.length > 0) setSelectedEventId(data[0].id);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        const [guestsRes, replacementsRes] = await Promise.all([
            supabase.from('guests').select('*').eq('event_id', selectedEventId).order('created_at', { ascending: false }),
            supabase.from('guest_replacements').select('*').eq('event_id', selectedEventId).order('created_at', { ascending: false })
        ]);
        if (guestsRes.data) setGuests(guestsRes.data);
        if (replacementsRes.data) setReplacements(replacementsRes.data);
        setLoading(false);
    };

    const stats = {
        total: guests.length,
        confirmed: guests.filter(g => g.rsvp_status === 'confirmed').length,
        declined: guests.filter(g => g.rsvp_status === 'declined').length,
        pending: guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length,
        maybe: guests.filter(g => g.rsvp_status === 'maybe').length,
        attended: guests.filter(g => g.status === 'attended').length,
        companions: guests.reduce((sum, g) => sum + (g.companions_count || 0), 0),
    };

    const filteredGuests = filter === 'all'
        ? guests
        : guests.filter(g => {
            if (filter === 'pending') return !g.rsvp_status || g.rsvp_status === 'pending';
            return g.rsvp_status === filter;
        });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'confirmed':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3" /> مؤكد
                </span>;
            case 'declined':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3" /> معتذر
                </span>;
            case 'maybe':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Clock className="w-3 h-3" /> متردد
                </span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Clock className="w-3 h-3" /> بانتظار
                </span>;
        }
    };

    const confirmedPct = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;
    const declinedPct = stats.total > 0 ? Math.round((stats.declined / stats.total) * 100) : 0;
    const pendingPct = stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;

    return (
        <div className="p-6 max-w-7xl mx-auto" dir="rtl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">📊 لوحة إدارة RSVP</h1>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <select
                        className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        value={selectedEventId}
                        onChange={e => setSelectedEventId(e.target.value)}
                    >
                        {events.map(ev => (
                            <option key={ev.id} value={ev.id}>{ev.name}</option>
                        ))}
                    </select>
                    <Button onClick={fetchData} variant="outline" className="gap-2">
                        <RefreshCw className="w-4 h-4" /> تحديث
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="p-4 text-center">
                        <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                        <p className="text-sm text-blue-700">إجمالي الضيوف</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('confirmed')}>
                    <CardContent className="p-4 text-center">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-green-900">{stats.confirmed}</p>
                        <p className="text-sm text-green-700">مؤكد ({confirmedPct}%)</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('declined')}>
                    <CardContent className="p-4 text-center">
                        <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-red-900">{stats.declined}</p>
                        <p className="text-sm text-red-700">معتذر ({declinedPct}%)</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setFilter('pending')}>
                    <CardContent className="p-4 text-center">
                        <Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                        <p className="text-3xl font-bold text-amber-900">{stats.pending}</p>
                        <p className="text-sm text-amber-700">بانتظار ({pendingPct}%)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Progress Bar */}
            <Card className="mb-6">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-700">نسبة الاستجابة</h3>
                        <span className="text-sm text-gray-500">({stats.confirmed + stats.declined} من {stats.total})</span>
                    </div>
                    <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex">
                        <div className="bg-green-500 h-full transition-all" style={{ width: `${confirmedPct}%` }} title={`مؤكد: ${confirmedPct}%`}></div>
                        <div className="bg-red-500 h-full transition-all" style={{ width: `${declinedPct}%` }} title={`معتذر: ${declinedPct}%`}></div>
                        <div className="bg-amber-400 h-full transition-all" style={{ width: `${pendingPct}%` }} title={`بانتظار: ${pendingPct}%`}></div>
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>🟢 مؤكد {confirmedPct}%</span>
                        <span>🔴 معتذر {declinedPct}%</span>
                        <span>🟡 بانتظار {pendingPct}%</span>
                    </div>
                </CardContent>
            </Card>

            {/* Replacements Section */}
            {replacements.length > 0 && (
                <Card className="mb-6 border-purple-200">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-800">
                            <ArrowLeftRight className="w-5 h-5" /> البدلاء ({replacements.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {replacements.map(r => (
                                <div key={r.id} className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                                    <div>
                                        <span className="text-red-600 line-through text-sm">{r.original_guest_name}</span>
                                        <span className="mx-2">→</span>
                                        <span className="text-green-700 font-medium">{r.replacement_guest_name}</span>
                                        {r.replacement_phone && <span className="text-gray-500 text-sm mr-2">({r.replacement_phone})</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        {r.card_generated && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">🎫 كرت ✓</span>}
                                        {r.card_sent && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">📩 أُرسل ✓</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Guests Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            قائمة الضيوف
                            {filter !== 'all' && (
                                <Button variant="ghost" onClick={() => setFilter('all')} className="text-xs text-blue-600">
                                    عرض الكل
                                </Button>
                            )}
                        </CardTitle>
                        <span className="text-sm text-gray-500">{filteredGuests.length} ضيف</span>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-gray-50">
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">#</th>
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">الاسم</th>
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">الجوال</th>
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">الحالة</th>
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">المرافقين</th>
                                        <th className="py-3 px-4 text-right font-medium text-gray-600">تاريخ الرد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredGuests.map((guest, i) => (
                                        <tr key={guest.id} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 text-gray-500">{i + 1}</td>
                                            <td className="py-3 px-4 font-medium">{guest.name}</td>
                                            <td className="py-3 px-4 text-gray-600 ltr" dir="ltr">{guest.phone || '-'}</td>
                                            <td className="py-3 px-4">{getStatusBadge(guest.rsvp_status)}</td>
                                            <td className="py-3 px-4 text-center">{guest.companions_count || 0}</td>
                                            <td className="py-3 px-4 text-gray-500 text-xs">
                                                {guest.rsvp_at ? new Date(guest.rsvp_at).toLocaleDateString('ar-SA') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default RSVPDashboard;
