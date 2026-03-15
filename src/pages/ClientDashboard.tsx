import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent } from '../components/ui/Card';
import { Loader2, Users, CheckCircle, Activity, Lock, XCircle, Calendar, MapPin, Clock } from 'lucide-react';

const ClientDashboard: React.FC = () => {
    const { magicToken } = useParams<{ magicToken: string }>();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [totalGuests, setTotalGuests] = useState(0);
    const [attendedGuests, setAttendedGuests] = useState(0);
    const [confirmedGuests, setConfirmedGuests] = useState(0);
    const [declinedGuests, setDeclinedGuests] = useState(0);
    const [guestsList, setGuestsList] = useState<any[]>([]);
    const [event, setEvent] = useState<any>(null);
    const [isExpired, setIsExpired] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'guests' | 'info'>('overview');

    useEffect(() => {
        fetchData();
        // Poll every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [magicToken]);

    const fetchData = async () => {
        try {
            // Get event by magicToken
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('magic_link_token', magicToken)
                .single();

            if (eventError || !eventData) {
                setLoading(false);
                return; // Invalid token
            }

            setEvent(eventData);

            // Check Expiration (48 hours after event date)
            if (eventData.date) {
                const eventDate = new Date(eventData.date);
                const now = new Date();
                const diffHours = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
                if (diffHours > 48) {
                    setIsExpired(true);
                    setLoading(false);
                    return; // Stop fetching details if expired
                }
            }

            // Get all guests for this event
            const { data: guests, error: guestsError } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', eventData.id)
                .order('created_at', { ascending: false });

            if (guestsError) throw guestsError;

            setGuestsList(guests || []);
            setTotalGuests(guests?.length || 0);

            const attended = guests?.filter(g => g.status === 'attended').length || 0;
            const confirmed = guests?.filter(g => g.rsvp_status === 'confirmed' || g.override_status === 'confirmed').length || 0;
            const declined = guests?.filter(g => g.rsvp_status === 'declined' || g.override_status === 'declined').length || 0;

            setAttendedGuests(attended);
            setConfirmedGuests(confirmed);
            setDeclinedGuests(declined);

            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-lony-gold w-10 h-10" />
        </div>
    );

    if (!event) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
            <Card className="max-w-md">
                <CardContent className="p-8 text-center">
                    <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">رابط غير صالح</h2>
                    <p className="text-gray-600 mb-6">
                        هذا الرابط غير صحيح أو تم حذفه.
                    </p>
                </CardContent>
            </Card>
        </div>
    );

    if (isExpired) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
            <Card className="max-w-md shadow-2xl border-t-4 border-lony-navy">
                <CardContent className="p-8 text-center">
                    <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">انتهت المناسبة السعيدة</h2>
                    <p className="text-gray-600 mb-6 font-medium">
                        تم أرشفة البيانات بنجاح بحمد الله.<br />
                        لتحقيق أعلى معايير الخصوصية والأمان لضيوفكم، تم إغلاق لوحة التحكم هذه.
                    </p>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-center">
                        <p className="text-sm text-blue-800 font-bold">
                            شكراً لاختياركم لوني (Lony Invitations) لمناسبتكم.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const attendancePercentage = totalGuests > 0 ? Math.round((attendedGuests / totalGuests) * 100) : 0;
    const confirmationPercentage = totalGuests > 0 ? Math.round((confirmedGuests / totalGuests) * 100) : 0;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-kufi" dir="rtl">
            {/* Header */}
            <div className="bg-lony-navy text-white p-6 rounded-b-[2rem] shadow-xl">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                    <Activity className="w-5 h-5" />
                    <span className="text-xs uppercase tracking-widest">Host Portal</span>
                </div>
                <h1 className="text-2xl font-bold font-amiri tracking-wide truncate">{event.name}</h1>
                <p className="text-white/60 text-sm mt-1">تحديث للبيانات كل 30 ثانية</p>
            </div>

            {/* Tabs Navigation */}
            <div className="px-6 -mt-6">
                <div className="bg-white rounded-xl shadow-md p-1 flex justify-between">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-lony-gold text-lony-navy shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        الإحصائيات
                    </button>
                    <button
                        onClick={() => setActiveTab('guests')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${activeTab === 'guests' ? 'bg-lony-gold text-lony-navy shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        الضيوف ({totalGuests})
                    </button>
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${activeTab === 'info' ? 'bg-lony-gold text-lony-navy shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        المناسبة
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-4 pb-20">
                {/* Tab: Overview */}
                {activeTab === 'overview' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Main Stats Card */}
                        <Card className="border-none shadow-lg overflow-hidden relative">
                            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-lony-gold via-yellow-300 to-lony-gold"></div>
                            <CardContent className="p-6 text-center pt-8">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-full border-4 border-lony-navy/10 flex flex-col items-center justify-center relative bg-gray-50 mb-2">
                                            <span className="text-2xl font-bold text-lony-navy">{attendancePercentage}%</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">نسبة الحضور</span>
                                        <span className="text-xs text-gray-500 mt-1">{attendedGuests} زائر في القاعة</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-24 h-24 rounded-full border-4 border-green-500/10 flex flex-col items-center justify-center relative bg-green-50 mb-2">
                                            <span className="text-2xl font-bold text-green-700">{confirmationPercentage}%</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">تأكيد الحضور (RSVP)</span>
                                        <span className="text-xs text-gray-500 mt-1">{confirmedGuests} مؤكد</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-white border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-28">
                                    <span className="text-2xl font-bold text-gray-800 mb-1">{totalGuests}</span>
                                    <span className="text-sm font-medium text-gray-500">إجمالي المدعوين</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50/50 border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-28">
                                    <span className="text-2xl font-bold text-red-600 mb-1">{declinedGuests}</span>
                                    <span className="text-sm font-medium text-red-800">اعتذار عن الحضور</span>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Tab: Guests */}
                {activeTab === 'guests' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 mb-4 border border-blue-100 flex items-start gap-3">
                            <Users className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p>تُعرض هنا قائمة ضيوفك لتعرف حالة تأكيدهم وردودهم. (يتم تحديث الردود آلياً عند رد الضيف على الواتساب).</p>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            {guestsList.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">لم يتم إضافة ضيوف بعد.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {guestsList.map(guest => (
                                        <div key={guest.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <div>
                                                <p className="font-bold text-gray-800">{guest.name}</p>
                                                <p className="text-xs text-gray-500 mt-1">{guest.phone || 'بدون رقم'}</p>
                                            </div>
                                            <div className="text-left flex flex-col items-end gap-1">
                                                {/* Attendance Status */}
                                                {guest.status === 'attended' ? (
                                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold inline-flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> تم الدخول
                                                    </span>
                                                ) : (
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-medium">لم يحضر بعد</span>
                                                )}

                                                {/* RSVP Status */}
                                                {(guest.override_status === 'confirmed' || guest.rsvp_status === 'confirmed') && (
                                                    <span className="text-blue-600 text-[10px] font-bold">مؤكد حضوره</span>
                                                )}
                                                {(guest.override_status === 'declined' || guest.rsvp_status === 'declined') && (
                                                    <span className="text-red-500 text-[10px] font-bold">معتذر</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab: Event Info */}
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="border-none shadow-md">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Calendar className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm text-gray-500 font-bold mb-1">تاريخ المناسبة</h3>
                                        <p className="text-lg text-gray-800 font-medium">{event.date || 'غير محدد'}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 w-full"></div>

                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-lony-gold/20 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-6 h-6 text-lony-navy" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm text-gray-500 font-bold mb-1">مكان المناسبة (القاعة)</h3>
                                        <p className="text-lg text-gray-800 font-medium">{event.venue || 'غير محدد'}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 w-full"></div>

                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm text-gray-500 font-bold mb-1">وقت فتح بوابات القاعة</h3>
                                        <p className="text-lg text-gray-800 font-medium">
                                            {event.opening_time ? new Date(event.opening_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'حسب ما هو مطبوع في الدعوة'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="text-center mt-8 pb-4 opacity-50">
                    <img src="/logo.png" className="h-6 mx-auto mb-2 grayscale opacity-50" alt="Lony" />
                    <p className="text-xs text-gray-400">Powered by Lony Invitations System</p>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
