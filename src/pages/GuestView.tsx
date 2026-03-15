import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { XCircle, Clock, Calendar, Loader2, MapPin, Lock as LockIcon } from 'lucide-react';
import { hasFeature, EventFeatures } from '../lib/features';

// Helper to parse date strings safely for Hijri conversion
const getSafeDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    // If it's just a date YYYY-MM-DD, add noon to prevent UTC shifting day
    if (dateStr.length === 10) return new Date(`${dateStr}T12:00:00`);
    return new Date(dateStr);
};

interface Guest {
    id: string;
    name: string;
    phone?: string;
    table_no?: string;
    serial?: string;
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
    start_date?: string;
    features?: Partial<EventFeatures>;
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
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update current time every second to handle transitions
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

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

        // --- SIMULATION MODE ---
        if (qr_token.startsWith('sim-')) {
            const mode = qr_token.split('-')[1]; // before, during, after

            // Mock Event
            const mockEvent: Event = {
                id: 'sim-event',
                name: 'حفل زفاف تجريبي',
                date: new Date().toISOString(), // Default
                location: 'قاعة اللؤلؤة، الرياض',
                location_maps_url: 'https://maps.google.com',
                qr_activation_enabled: true,
                features: {
                    enable_simple_scan: true
                }
            };

            // Adjust times based on mode
            const now = new Date();
            if (mode === 'before') {
                mockEvent.qr_active_from = new Date(now.getTime() + 86400000).toISOString(); // Tomorrow
                mockEvent.qr_active_until = new Date(now.getTime() + 172800000).toISOString();
                mockEvent.date = new Date(now.getTime() + 86400000).toISOString();
            } else if (mode === 'during') {
                mockEvent.qr_active_from = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
                mockEvent.qr_active_until = new Date(now.getTime() + 86400000).toISOString(); // Tomorrow
                mockEvent.date = new Date().toISOString();
            } else if (mode === 'after') {
                mockEvent.qr_active_from = new Date(now.getTime() - 172800000).toISOString(); // 2 days ago
                mockEvent.qr_active_until = new Date(now.getTime() - 86400000).toISOString(); // Yesterday
                mockEvent.date = new Date(now.getTime() - 86400000).toISOString();
            }

            setEvent(mockEvent);
            setGuest({
                id: 'sim-guest',
                name: 'ضيف تجريبي (Demo Guest)',
                qr_token: qr_token,
                attended: mode === 'during',
                table_no: 'VIP-1',
                companions_count: 3,
                companions_attended: 0,
                events: mockEvent
            });
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

                // Check if registration is required
                const registrationRequired = hasFeature(guestData.events, 'enable_registration') && guestData.status === 'pending';
                if (registrationRequired) {
                    // Redirect to landing page for registration
                    window.location.href = `/invite/${guestData.id}`;
                    return;
                }

                // AUTO CHECK-IN: Register check-in automatically on page load
                // Only if QR is active and has remaining scans
                const totalAllowed = 1 + (guestData.companions_count || 0);
                const totalScanned = scansData?.length || 0;
                const remaining = totalAllowed - totalScanned;

                if (remaining > 0) {
                    // AUTO CHECK-IN: Only if 'require_inspector_app' is FALSE
                    // If true, we only show the view, but DO NOT check them in.
                    if (!hasFeature(guestData.events, 'require_inspector_app')) {
                        await performCheckIn(guestData.id, guestData.events);
                    }
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
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="max-w-md w-full text-center bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] p-10 shadow-xl">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-[#B57382]/10 rounded-2xl mb-8">
                        <XCircle className="w-12 h-12 text-[#B57382]" />
                    </div>
                    <h1 className="text-3xl font-bold font-serif text-[#2C3E50] mb-4">دعوة غير صالحة</h1>
                    <p className="text-gray-500 text-lg leading-relaxed">عذراً، لم نتمكن من العثور على هذه الدعوة في سجلاتنا.</p>
                </div>
            </div>
        );
    }

    // Check QR activation window
    const now = currentTime;
    const qrActivationEnabled = event.qr_activation_enabled === true;

    let qrStatus: 'active' | 'not_started' | 'expired' = 'active';

    // Helper to ensure comparison is done in a consistent timezone (UTC)
    const getActivationDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        if (dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('+') && !dateStr.includes('Z')) {
            return new Date(dateStr.replace(' ', 'T') + 'Z');
        }
        return new Date(dateStr);
    };

    if (qrActivationEnabled) {
        const activeFrom = getActivationDate(event.qr_active_from);
        const activeUntil = getActivationDate(event.qr_active_until);

        if (activeFrom && now.getTime() < (activeFrom.getTime() - 500)) {
            qrStatus = 'not_started';
        } else if (activeUntil && now.getTime() > activeUntil.getTime()) {
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

                if (distance <= 0) {
                    clearInterval(timer);
                    // No reload needed, the parent's currentTime state update will handle the transition
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
            <div className="grid grid-cols-4 gap-2 md:gap-4 mb-6">
                {[
                    { label: 'يوم', value: timeLeft.days, color: 'from-[#C5A059]/10 to-[#E5DCC5]/10', border: 'border-[#C5A059]/30' },
                    { label: 'ساعة', value: timeLeft.hours, color: 'from-[#B57382]/10 to-[#D69CA8]/10', border: 'border-[#B57382]/30' },
                    { label: 'دقيقة', value: timeLeft.minutes, color: 'from-[#8FA08E]/10 to-[#A9B8A8]/10', border: 'border-[#8FA08E]/30' },
                    { label: 'ثانية', value: timeLeft.seconds, color: 'from-gray-200/50 to-gray-100/50', border: 'border-gray-200' }
                ].map((item, idx) => (
                    <div key={idx} className={`bg-gradient-to-br ${item.color} ${item.border} border backdrop-blur-md rounded-2xl p-3 md:p-5 text-center`}>
                        <div className="text-2xl md:text-3xl font-black text-[#2C3E50] tabular-nums">
                            {String(item.value).padStart(2, '0')}
                        </div>
                        <div className="text-[10px] md:text-xs uppercase tracking-widest text-[#C5A059] mt-1 font-bold">{item.label}</div>
                    </div>
                ))}
            </div>
        );
    };

    // Show countdown if QR not active yet
    if (qrStatus === 'not_started') {
        const targetDate = getActivationDate(event.qr_active_from);
        if (!targetDate) return null; // Should not happen if qrStatus is not_started

        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
                {/* Decorative Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#B57382]/10 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="max-w-xl w-full z-10">
                    <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] shadow-xl p-8 md:p-12 text-center relative">
                        {/* Premium Header */}
                        <div className="mb-10">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-[#C5A059] to-[#D4AF37] rounded-2xl shadow-[0_4px_20px_rgba(197,160,89,0.3)] mb-6 transform -rotate-3">
                                <Clock className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black font-serif mb-4 text-[#2C3E50] leading-tight">
                                نتشرف بدعوتك
                            </h1>
                            <div className="h-1 w-24 bg-gradient-to-r from-[#C5A059] to-[#E5DCC5] mx-auto rounded-full"></div>
                        </div>

                        {/* Event Details Card */}
                        <div className="bg-white/60 rounded-3xl p-6 mb-10 border border-[#E5DCC5] space-y-4">
                            <h2 className="text-2xl font-bold font-serif text-[#C5A059] mb-2">{event.name}</h2>

                            <div className="flex flex-wrap justify-center gap-6 text-[#2C3E50]">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-[#8FA08E]" />
                                    <span className="text-lg">{event.date}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[#C5A059] font-bold">
                                    <span>{event.date ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(getSafeDate(event.date)!) : ''} هـ</span>
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-[#B57382]" />
                                        <span className="text-lg">{event.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Countdown Section */}
                        <div className="mb-10">
                            <p className="text-gray-500 mb-6 uppercase tracking-widest text-sm font-bold">يفتح مسح الباركود خلال</p>
                            <CountdownTimer targetDate={targetDate} />
                        </div>

                        {/* Guest Welcome */}
                        <div className="border-t border-[#E5DCC5] pt-8 mb-4">
                            <p className="text-gray-500 mb-2">أهلاً بك</p>
                            <h3 className="text-2xl font-bold text-[#2C3E50] font-serif">{guest.name}</h3>
                            {guest.table_no && (
                                <div className="mt-4 inline-flex items-center gap-2 bg-[#C5A059]/10 text-[#C5A059] px-6 py-2 rounded-full border border-[#C5A059]/20">
                                    <span className="font-bold">طاولة: {guest.table_no}</span>
                                </div>
                            )}
                        </div>

                        {/* Bottom Info */}
                        <div className="mt-8 flex items-center justify-center gap-2 text-[#B57382]/80 text-sm">
                            <LockIcon className="w-4 h-4" />
                            <span>يتم تأمين الدخول حتى الموعد المحدد</span>
                        </div>
                    </div>

                    {/* Footer Logo */}
                    <div className="mt-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-white border border-[#E5DCC5] flex items-center justify-center mx-auto mb-4 shadow-sm text-[#C5A059]">
                            L
                        </div>
                        <p className="text-gray-500 text-sm tracking-widest uppercase">
                            بواسطة <span className="text-[#C5A059] font-bold ml-1 italic">LONY INVITATIONS</span>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show expired message if QR expired
    if (qrStatus === 'expired') {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="max-w-md w-full text-center bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] p-10 shadow-xl">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-200/50 rounded-2xl mb-8">
                        <Clock className="w-12 h-12 text-gray-400" />
                    </div>
                    <h1 className="text-3xl font-bold font-serif text-[#2C3E50] mb-4">انتهت الصلاحية</h1>
                    <p className="text-gray-500 text-lg mb-8">عذراً، انتهت فترة صلاحية هذه الدعوة للحدث التالي:</p>

                    <div className="bg-white/60 rounded-2xl p-6 border border-[#E5DCC5]">
                        <h2 className="text-xl font-bold font-serif text-[#C5A059] mb-2">{event.name}</h2>
                        <p className="text-gray-500">{event.date}</p>
                    </div>
                </div>
            </div>
        );
    }

    const totalAllowed = 1 + (guest.companions_count || 0);
    const totalScanned = scans.length;
    const remaining = Math.max(0, totalAllowed - totalScanned);
    const canCheckIn = remaining > 0;

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] py-10 px-6 relative overflow-hidden" dir="rtl">
            {/* Decorative Backgrounds */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#C5A059]/10 rounded-full blur-[150px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#B57382]/10 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="max-w-xl mx-auto space-y-8 z-10 relative">
                {/* Event Header Card */}
                <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] p-8 text-center shadow-xl">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#C5A059]/10 rounded-2xl mb-4 text-[#C5A059]">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <h2 className="text-3xl font-black font-serif text-[#C5A059] mb-2">{event.name}</h2>
                    <div className="flex flex-col items-center gap-1 text-gray-600">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[#8FA08E]" />
                            <span>{event.date}</span>
                        </div>
                        <div className="text-[#C5A059] text-sm font-bold">
                            {event.date ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(getSafeDate(event.date)!) : ''} هـ
                        </div>
                    </div>
                </div>

                {/* Digital QR Card */}
                <div className="bg-white/90 backdrop-blur-xl border border-[#E5DCC5] rounded-[3rem] p-8 md:p-12 shadow-2xl overflow-hidden relative group">
                    {/* Status Badge */}
                    <div className="flex justify-center mb-8">
                        <div className={`px-6 py-2 rounded-full font-bold text-sm uppercase tracking-widest border transition-all duration-500 ${canCheckIn
                            ? 'bg-[#8FA08E]/10 text-[#5C6E5B] border-[#8FA08E]/20 shadow-sm'
                            : 'bg-[#B57382]/10 text-[#915664] border-[#B57382]/20 shadow-sm'
                            }`}>
                            {canCheckIn ? 'تذكرة صالحة' : 'تم استهلاك التذكرة'}
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-black font-serif text-[#2C3E50] mb-2 tracking-tight">{guest.name}</h1>
                        <p className="text-gray-500 text-lg">يسعدنا حضورك</p>
                    </div>

                    <div className="relative mb-10 flex justify-center">
                        <div className="absolute inset-0 bg-[#C5A059]/10 blur-[60px] rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <div className="relative bg-white p-6 rounded-[2.5rem] shadow-lg border border-[#E5DCC5]/50 transition-transform hover:scale-105 duration-500">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/v/' + guest.qr_token)}&bgcolor=ffffff&color=2C3E50&margin=10`}
                                alt="QR Code"
                                className="w-48 h-48 md:w-56 md:h-56 mix-blend-multiply"
                            />
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        {guest.table_no && (
                            <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-[#E5DCC5] text-center">
                                <p className="text-gray-500 text-xs mb-1 uppercase font-bold tracking-tighter">رقم الطاولة</p>
                                <p className="text-2xl font-black text-[#2C3E50]">{guest.table_no}</p>
                            </div>
                        )}
                        <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-[#E5DCC5] text-center col-span-1">
                            <p className="text-gray-500 text-xs mb-1 uppercase font-bold tracking-tighter">المرافقين</p>
                            <p className="text-2xl font-black text-[#2C3E50]">{guest.companions_count || 0}</p>
                        </div>
                    </div>

                    {/* Scan Progress */}
                    <div className={`rounded-3xl p-6 border transition-all ${canCheckIn
                        ? 'bg-[#8FA08E]/5 border-[#8FA08E]/20'
                        : 'bg-[#B57382]/5 border-[#B57382]/20'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-500 text-sm font-bold">حالة الدخول</p>
                            <p className="text-[#2C3E50] font-black">{totalScanned} / {totalAllowed}</p>
                        </div>
                        <div className="h-3 bg-white/50 rounded-full overflow-hidden border border-[#E5DCC5]">
                            <div
                                className={`h-full transition-all duration-1000 ease-out ${canCheckIn ? 'bg-gradient-to-r from-[#8FA08E] to-[#6C7E6B]' : 'bg-[#B57382]'}`}
                                style={{ width: `${(totalScanned / totalAllowed) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Scan History - Elegant List */}
                {scans.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] p-8 shadow-xl">
                        <h3 className="text-xl font-bold font-serif text-[#C5A059] mb-6 flex items-center gap-3">
                            <Clock className="w-6 h-6" />
                            سجل الحضور
                        </h3>
                        <div className="space-y-4">
                            {scans.slice(0, 5).map((scan, idx) => {
                                const d = new Date(scan.scanned_at);
                                return (
                                    <div key={scan.id} className="flex items-center justify-between p-4 bg-[#FDFBF7] rounded-2xl border border-[#E5DCC5] group hover:bg-[#F9F6F0] transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-[#8FA08E]/10 flex items-center justify-center text-[#5C6E5B] font-bold">
                                                {scans.length - idx}
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#2C3E50]">دخول معتمد</p>
                                                <p className="text-xs text-gray-500 italic">بواسطة المضيف</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[#2C3E50] font-bold">{d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                                            <p className="text-[10px] text-gray-500">{d.toLocaleDateString('ar-SA')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-8 opacity-60">
                    <div className="h-[1px] w-20 bg-gray-300 mx-auto mb-4"></div>
                    <p className="text-[10px] tracking-[0.2em] font-black uppercase text-gray-500">Official Guest Portal • Lony Platform</p>
                </div>
            </div>

            {/* SECURITY OVERLAY */}
            {event && hasFeature(event, 'require_inspector_app') && (
                <div className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-10 duration-700">
                    <div className="bg-orange-500/10 backdrop-blur-2xl border border-orange-500/20 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-6">
                        <div className="bg-orange-500 p-4 rounded-2xl shadow-lg shadow-orange-500/20">
                            <LockIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h4 className="font-black text-white text-lg">وضع الأمان مفعل</h4>
                            <p className="text-sm text-gray-400 leading-snug">صلاحية الدخول تمنح فقط عبر مسح الرمز من خلال تطبيق المنظمين الرسمي.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
