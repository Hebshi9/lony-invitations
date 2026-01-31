import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, Users, Clock, Calendar, Loader2, AlertCircle } from 'lucide-react';

interface Guest {
    id: string;
    name: string;
    phone?: string;
    table_no?: string;
    companions_count?: number;
    companions_attended?: number;
    attended: boolean;
    attended_at?: string;
    qr_token: string;
    events?: Event;
}

interface Event {
    id: string;
    name: string;
    date: string;
    location?: string;
    location_maps_url?: string;
    wifi_ssid?: string;
    wifi_password?: string;
    wifi_security?: 'WPA' | 'WEP' | 'nopass';
    qr_activation_enabled?: boolean;
    qr_active_from?: string;
    qr_active_until?: string;
}

interface Scan {
    id: string;
    guest_id: string;
    scanned_at: string;
    scan_type: 'entry' | 'companion';
}

export default function GuestView() {
    const { qr_token } = useParams<{ qr_token: string }>();
    const [guest, setGuest] = useState<Guest | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [scans, setScans] = useState<Scan[]>([]);
    const [checkingIn, setCheckingIn] = useState(false);

    useEffect(() => {
        if (qr_token) {
            fetchGuestData();
        } else {
            setLoading(false);
        }
    }, [qr_token]);

    const fetchGuestData = async () => {
        if (!qr_token) {
            setLoading(false);
            return;
        }

        try {
            // Fetch guest data
            const { data: guestData, error: guestError } = await supabase
                .from('guests')
                .select(`
                    *,
                    events (*)
                `)
                .eq('qr_token', qr_token)
                .single();

            if (guestError) throw guestError;

            if (guestData) {
                setGuest(guestData);
                setEvent(guestData.events);

                // Fetch scan history
                const { data: scansData } = await supabase
                    .from('scans')
                    .select('*')
                    .eq('guest_id', guestData.id)
                    .order('scanned_at', { ascending: false });

                if (scansData) {
                    setScans(scansData);
                }

                // AUTO CHECK-IN: Register check-in automatically on page load
                // Only if QR is active and has remaining scans
                const totalAllowed = 1 + (guestData.companions_count || 0);
                const totalScanned = scansData?.length || 0;
                const remaining = totalAllowed - totalScanned;

                if (remaining > 0) {
                    // Perform auto check-in
                    await performCheckIn(guestData.id, guestData.events);
                }
            }
        } catch (error) {
            console.error('Error fetching guest:', error);
        } finally {
            setLoading(false);
        }
    };

    const performCheckIn = async (guestId: string, eventData: any) => {
        try {
            const now = new Date().toISOString();

            // Record scan
            const { error: scanError } = await supabase
                .from('scans')
                .insert({
                    guest_id: guestId,
                    event_id: eventData?.id,
                    scanned_at: now,
                    scan_type: 'entry'
                });

            if (scanError) throw scanError;

            // Update guest attendance
            const { data: currentGuest } = await supabase
                .from('guests')
                .select('companions_attended, attended_at')
                .eq('id', guestId)
                .single();

            const newCompanionsAttended = (currentGuest?.companions_attended || 0) + 1;

            const { error: updateError } = await supabase
                .from('guests')
                .update({
                    attended: true,
                    attended_at: currentGuest?.attended_at || now,
                    companions_attended: newCompanionsAttended
                })
                .eq('id', guestId);

            if (updateError) throw updateError;

            // Refresh data to show updated scan
            await fetchGuestData();
        } catch (error) {
            console.error('Error during auto check-in:', error);
        }
    };

    const handleCheckIn = async () => {
        if (!guest) return;

        setCheckingIn(true);

        try {
            const now = new Date().toISOString();

            // Record scan
            const { error: scanError } = await supabase
                .from('scans')
                .insert({
                    guest_id: guest.id,
                    event_id: event?.id,
                    scanned_at: now,
                    scan_type: 'entry'
                });

            if (scanError) throw scanError;

            // Update guest attendance
            const newCompanionsAttended = (guest.companions_attended || 0) + 1;
            const totalAllowed = 1 + (guest.companions_count || 0);

            const { error: updateError } = await supabase
                .from('guests')
                .update({
                    attended: true,
                    attended_at: guest.attended_at || now,
                    companions_attended: newCompanionsAttended
                })
                .eq('id', guest.id);

            if (updateError) throw updateError;

            // Refresh data
            await fetchGuestData();
        } catch (error) {
            console.error('Error checking in:', error);
            alert('حدث خطأ أثناء تسجيل الدخول');
        } finally {
            setCheckingIn(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 text-lg font-semibold">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    if (!guest || !event) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
                <div className="text-center bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                    <XCircle className="w-24 h-24 text-red-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-red-600 mb-3">دعوة غير صالحة</h1>
                    <p className="text-gray-600 text-lg">عذراً، لم نتمكن من العثور على هذه الدعوة</p>
                </div>
            </div>
        );
    }

    // Check QR activation window
    const now = new Date();
    const qrActiveFrom = event.qr_active_from ? new Date(event.qr_active_from) : null;
    const qrActiveUntil = event.qr_active_until ? new Date(event.qr_active_until) : null;
    const qrActivationEnabled = event.qr_activation_enabled || false;

    let qrStatus: 'active' | 'not_started' | 'expired' = 'active';
    let timeUntilActive = 0;

    if (qrActivationEnabled) {
        if (qrActiveFrom && now < qrActiveFrom) {
            qrStatus = 'not_started';
            timeUntilActive = qrActiveFrom.getTime() - now.getTime();
        } else if (qrActiveUntil && now > qrActiveUntil) {
            qrStatus = 'expired';
        }
    }

    // Countdown Timer Component
    const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
        const [timeLeft, setTimeLeft] = useState({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0
        });

        useEffect(() => {
            const timer = setInterval(() => {
                const now = new Date().getTime();
                const distance = targetDate.getTime() - now;

                if (distance < 0) {
                    clearInterval(timer);
                    window.location.reload(); // Reload when countdown ends
                    return;
                }

                setTimeLeft({
                    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((distance % (1000 * 60)) / 1000)
                });
            }, 1000);

            return () => clearInterval(timer);
        }, [targetDate]);

        return (
            <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white text-center">
                    <div className="text-3xl font-bold">{timeLeft.days}</div>
                    <div className="text-xs mt-1">يوم</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white text-center">
                    <div className="text-3xl font-bold">{timeLeft.hours}</div>
                    <div className="text-xs mt-1">ساعة</div>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white text-center">
                    <div className="text-3xl font-bold">{timeLeft.minutes}</div>
                    <div className="text-xs mt-1">دقيقة</div>
                </div>
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white text-center">
                    <div className="text-3xl font-bold">{timeLeft.seconds}</div>
                    <div className="text-xs mt-1">ثانية</div>
                </div>
            </div>
        );
    };

    // Show countdown if QR not active yet
    if (qrStatus === 'not_started' && qrActiveFrom) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-100 py-6 px-4" dir="rtl">
                <div className="max-w-lg mx-auto space-y-4">
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <Clock className="w-20 h-20 text-blue-600 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">الدعوة قيد الانتظار</h1>
                        <p className="text-gray-600 mb-6">هذه الدعوة ستكون قابلة للاستخدام في:</p>

                        <CountdownTimer targetDate={qrActiveFrom} />

                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-4 border-2 border-blue-200">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">{event.name}</h2>
                            <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                                <Calendar className="w-5 h-5" />
                                <span>{event.date}</span>
                            </div>
                            {event.location && (
                                <div className="flex items-center justify-center gap-2 text-gray-600">
                                    <MapPin className="w-5 h-5" />
                                    <span>{event.location}</span>
                                </div>
                            )}
                        </div>

                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                            <p className="text-yellow-800 font-semibold">
                                ⏰ التفعيل: {qrActiveFrom.toLocaleString('ar-SA', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>

                        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-600">مدعو: <span className="font-bold text-gray-800">{guest.name}</span></p>
                            {guest.table_no && (
                                <p className="text-sm text-gray-600 mt-1">طاولة: <span className="font-bold text-gray-800">{guest.table_no}</span></p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show expired message if QR expired
    if (qrStatus === 'expired') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 p-4">
                <div className="text-center bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
                    <XCircle className="w-24 h-24 text-gray-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-gray-700 mb-3">انتهت صلاحية الدعوة</h1>
                    <p className="text-gray-600 text-lg mb-4">عذراً، انتهت فترة صلاحية هذه الدعوة</p>

                    <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-600">الحدث: <span className="font-bold text-gray-800">{event.name}</span></p>
                        <p className="text-sm text-gray-600 mt-1">التاريخ: <span className="font-bold text-gray-800">{event.date}</span></p>
                    </div>
                </div>
            </div>
        );
    }

    const totalAllowed = 1 + (guest.companions_count || 0);
    const totalScanned = scans.length;
    const remaining = Math.max(0, totalAllowed - totalScanned);
    const canCheckIn = remaining > 0;
    const firstScan = scans.length > 0 ? scans[scans.length - 1] : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 py-6 px-4" dir="rtl">
            <div className="max-w-lg mx-auto space-y-4">
                {/* Event Header */}
                <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
                    <Calendar className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
                    <h2 className="text-2xl font-bold text-gray-800">{event.name}</h2>
                    <p className="text-gray-600 mt-1">{event.date}</p>
                </div>

                {/* Guest Info Card */}
                <div className="bg-white rounded-2xl shadow-xl p-6">
                    <div className="text-center mb-6">
                        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${canCheckIn ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-600'
                            }`}>
                            {canCheckIn ? (
                                <CheckCircle className="w-10 h-10 text-white" />
                            ) : (
                                <XCircle className="w-10 h-10 text-white" />
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">{guest.name}</h1>
                        {guest.table_no && (
                            <div className="inline-block bg-indigo-100 text-indigo-800 px-4 py-2 rounded-full font-bold text-lg">
                                طاولة {guest.table_no}
                            </div>
                        )}
                    </div>

                    {/* Companions Info */}
                    {guest.companions_count && guest.companions_count > 0 && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border-2 border-indigo-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Users className="w-6 h-6 text-indigo-600" />
                                    <div>
                                        <div className="text-sm text-gray-600">عدد المرافقين</div>
                                        <div className="font-bold text-gray-800 text-2xl">{guest.companions_count}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-gray-600">الإجمالي المسموح</div>
                                    <div className="font-bold text-indigo-600 text-2xl">{totalAllowed}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Scan Status */}
                    <div className={`rounded-xl p-5 mb-4 border-2 ${canCheckIn
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                        : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-sm text-gray-600">تم المسح</div>
                                <div className="font-bold text-3xl text-gray-800">{totalScanned}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-gray-600">المتبقي</div>
                                <div className={`font-bold text-3xl ${canCheckIn ? 'text-green-600' : 'text-red-600'}`}>
                                    {remaining}
                                </div>
                            </div>
                        </div>

                        {canCheckIn ? (
                            <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">يمكن تسجيل الدخول ({remaining} مرة متبقية)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-semibold">تم استنفاد جميع المحاولات</span>
                            </div>
                        )}
                    </div>


                </div>

                {/* Scan History */}
                {scans.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Clock className="w-6 h-6 text-indigo-600" />
                            سجل الدخول
                        </h3>
                        <div className="space-y-3">
                            {scans.map((scan, index) => {
                                const scanDate = new Date(scan.scanned_at);
                                const isFirst = index === scans.length - 1;

                                return (
                                    <div
                                        key={scan.id}
                                        className={`p-4 rounded-xl border-2 ${isFirst
                                            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300'
                                            : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold text-gray-800">
                                                    {isFirst ? '🎉 الدخول الأول' : `الدخول رقم ${scans.length - index}`}
                                                </div>
                                                <div className="text-sm text-gray-600 mt-1">
                                                    {scanDate.toLocaleDateString('ar-SA', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-indigo-600 text-lg">
                                                    {scanDate.toLocaleTimeString('ar-SA', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-4 text-gray-500 text-sm">
                    <p>Powered by <span className="font-bold text-indigo-600">Lony Invitations</span></p>
                </div>
            </div>
        </div>
    );
}
