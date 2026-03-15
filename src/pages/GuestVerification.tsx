import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'react-qr-code';
import { Button } from '../components/ui/Button';
import { Check, X, AlertTriangle, MapPin, Calendar, Award, Clock, Lock as LockIcon } from 'lucide-react';
import { EventFeatures } from '../lib/features';

// Helper to parse date strings safely for Hijri conversion
const getSafeDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    // If it's just a date YYYY-MM-DD, add noon to prevent UTC shifting day
    if (dateStr.length === 10) return new Date(`${dateStr}T12:00:00`);
    return new Date(dateStr);
};

const CountdownTimer: React.FC<{ targetDate: Date; onExpire?: () => void }> = ({ targetDate, onExpire }) => {
    const [timeLeft, setTimeLeft] = useState({
        days: 0, hours: 0, minutes: 0, seconds: 0
    });
    const expiredFired = useRef(false);

    useEffect(() => {
        const calculate = () => {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;

            if (distance <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                if (!expiredFired.current) {
                    expiredFired.current = true;
                    onExpire?.();
                }
                return;
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
        };

        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [targetDate, onExpire]);

    return (
        <div className="grid grid-cols-4 gap-2 md:gap-4 mb-6">
            {[
                { label: 'يوم', value: timeLeft.days },
                { label: 'ساعة', value: timeLeft.hours },
                { label: 'دقيقة', value: timeLeft.minutes },
                { label: 'ثانية', value: timeLeft.seconds }
            ].map((item, idx) => (
                <div key={idx} className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-2xl p-3 text-center min-w-[70px] transition-all hover:border-[#C5A059]/50 group shadow-sm">
                    <div className="text-2xl md:text-3xl font-black text-[#2C3E50] group-hover:scale-110 transition-transform duration-300">
                        {item.value.toString().padStart(2, '0')}
                    </div>
                    <div className="text-[10px] md:text-xs text-[#C5A059] font-bold uppercase tracking-widest mt-1">
                        {item.label}
                    </div>
                </div>
            ))}
        </div>
    );
};

const GuestVerification: React.FC = () => {
    const { guestId } = useParams<{ guestId: string }>();
    const [guest, setGuest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
    const [isInspector, setIsInspector] = useState(false);
    // Fires true the moment the countdown hits zero (smooth transition)
    const [countdownExpired, setCountdownExpired] = useState(false);

    // Auto Check-in State
    const [autoCheckDone, setAutoCheckDone] = useState(false);
    const [scanResult, setScanResult] = useState<{
        success: boolean;
        message: string;
        remaining: number;
        canForce?: boolean;
    } | null>(null);
    const checkInAttempted = useRef(false);
    const handleCountdownExpire = useCallback(() => setCountdownExpired(true), []);

    // Host Mode State
    const [isHostMode, setIsHostMode] = useState(false);
    const [showHostLogin, setShowHostLogin] = useState(false);
    const [hostPinInput, setHostPinInput] = useState('');

    useEffect(() => {
        // Interval to keep time and trigger re-renders for status checks
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        // Check for inspector mode
        const inspectorMode = localStorage.getItem('lony_inspector_mode') === 'true';
        setIsInspector(inspectorMode);

        // Check for host mode
        const hostMode = localStorage.getItem('lony_host_mode') === 'true';
        setIsHostMode(hostMode);

        if (guestId) fetchGuest();

        return () => clearInterval(timer);
    }, [guestId]);

    // Trigger auto check-in when guest data is loaded and user is inspector or HOST
    useEffect(() => {
        const activationTime = guest?.events?.qr_active_from;
        const now = currentTime;
        const isLocked = guest?.events?.qr_activation_enabled && activationTime && now < new Date(activationTime);

        if ((isInspector || isHostMode) && guest && !checkInAttempted.current && !isLocked) {
            checkInAttempted.current = true;
            // For Host Mode: ONLY if Simple Scan is enabled
            if (isHostMode && !guest.events?.enable_simple_scan) {
                return; // Package doesn't support it
            }
            performAutoCheckIn();
        }
    }, [isInspector, isHostMode, guest, currentTime]);

    const fetchGuest = async () => {
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*, events(name, date, venue, settings, activation_time, qr_active_from, qr_active_until, qr_activation_enabled, enable_simple_scan, host_pin)')
                .eq('qr_token', guestId)
                .single();

            if (error) throw error;
            setGuest(data);
            setRsvpStatus(data.status);
        } catch (error) {
            console.error('Error fetching guest:', error);
        } finally {
            setLoading(false);
        }
    };

    const performAutoCheckIn = async (force: boolean = false) => {
        if (!guest) return;

        try {
            const activationTime = getActivationDate(guest.events?.qr_active_from);
            const activationEnabled = guest.events?.qr_activation_enabled === true;
            // STAFF (Inspector/Host) can ALWAYS check in
            if (!isInspector && !isHostMode && activationEnabled && activationTime && currentTime < activationTime && !force) {
                const target = activationTime;
                setScanResult({
                    success: false,
                    message: `يبدأ الدخول في: ${target.toLocaleDateString('ar-SA')} - ${target.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
                    remaining: 0
                });
                setAutoCheckDone(true);
                return;
            }

            const totalAllowed = 1 + (guest.companions_count || 0);
            const alreadyScanned = guest.scan_count || 0;
            const remaining = totalAllowed - alreadyScanned;

            // 2. Check Limits (unless forced)
            if (remaining <= 0 && !force) {
                setScanResult({
                    success: false,
                    message: 'تم استخدام هذه الدعوة بالكامل مسبقاً',
                    remaining: 0,
                    canForce: true
                });
                setAutoCheckDone(true);
                return;
            }

            // Perform Check-in
            const newCount = alreadyScanned + 1;
            const newRemaining = force ? 0 : totalAllowed - newCount;

            const updateData: any = {
                status: 'attended',
                scan_count: newCount
            };

            if (force) {
                updateData.notes = (guest.notes || '') + `\n[${new Date().toISOString()}] Forced Entry by Inspector`;
            }

            const { error } = await supabase
                .from('guests')
                .update(updateData)
                .eq('id', guest.id);

            if (error) throw error;

            // Refresh guest data
            const { data: updatedGuest } = await supabase
                .from('guests')
                .select('*')
                .eq('id', guest.id)
                .single();

            if (updatedGuest) setGuest({ ...guest, ...updatedGuest });

            setScanResult({
                success: true,
                message: force ? 'تم تسجيل الدخول القسري بنجاح' : 'تم تسجيل الدخول بنجاح',
                remaining: updatedGuest ? (1 + (updatedGuest.companions_count || 0) - (updatedGuest.scan_count || 0)) : newRemaining
            });

            setAutoCheckDone(true);

        } catch (err) {
            console.error(err);
            setScanResult({
                success: false,
                message: 'حدث خطأ في النظام',
                remaining: 0
            });
            setAutoCheckDone(true);
        }
    };

    const handleRsvp = async (status: 'confirmed' | 'declined') => {
        try {
            setLoading(true);
            const { error } = await supabase
                .from('guests')
                .update({ status })
                .eq('id', guest.id);

            if (error) throw error;
            setRsvpStatus(status);
        } catch (error) {
            console.error('Error updating RSVP:', error);
            alert('حدث خطأ، حاول مرة أخرى');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-[#C5A059]/20 border-t-[#C5A059] rounded-full animate-spin mb-4 mx-auto"></div>
                <p className="text-[#C5A059] font-black tracking-widest text-sm uppercase">LONY INVITATIONS</p>
            </div>
        </div>
    );

    if (!guest) return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#2C3E50] p-6" dir="rtl">
            <div className="text-center p-12 bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[3rem] shadow-xl max-w-sm w-full">
                <AlertTriangle className="w-20 h-20 text-[#B57382]/80 mx-auto mb-6" />
                <h2 className="text-3xl font-black font-serif mb-4">الرابط غير صالح</h2>
                <p className="text-gray-500">يرجى التأكد من رابط الدعوة المرسل إليك عبر الواتساب.</p>
                <div className="mt-8 pt-8 border-t border-[#E5DCC5]">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-black">Lony Security</p>
                </div>
            </div>
        </div>
    );

    // Helper to ensure comparison is done in a consistent timezone (UTC)
    const getActivationDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        // If string contains a space but no 'T' or 'Z', it might be a raw Postgres timestamp
        // We append 'Z' to treat it as UTC if it doesn't have timezone info
        if (dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('+') && !dateStr.includes('Z')) {
            return new Date(dateStr.replace(' ', 'T') + 'Z');
        }
        return new Date(dateStr);
    };

    const activationTime = getActivationDate(guest.events?.qr_active_from);
    const expiryTime = getActivationDate(guest.events?.qr_active_until);

    // Staff (Inspectors/Hosts) ALWAYS bypass all locks
    const event = guest.events;
    // Only locked if the database column allows it.
    const activationEnabled = event?.qr_activation_enabled === true;
    const isLocked = !isInspector && !isHostMode && activationEnabled && activationTime && currentTime < activationTime;

    // True once activation time has passed, or if activation is disabled (always active)
    const isEventActive = isInspector || isHostMode || !activationEnabled || (activationTime && (currentTime >= activationTime || countdownExpired));

    // True after qr_active_until has passed (event is fully over)
    // ONLY if activation is enabled. If disabled, we don't expire the entry.
    const isEventExpired = !isInspector && !isHostMode && activationEnabled && expiryTime && currentTime > expiryTime;

    // Entry is open ONLY for guests who confirmed (confirmed/attended).
    // Pending/declined guests => they didn't confirm, don't show them the entry screen.
    // We only send QR cards to confirmed guests anyway, but this is a safety guard.
    const guestConfirmed = rsvpStatus === 'confirmed' || rsvpStatus === 'attended';
    const isEntryOpen = isEventActive && !isEventExpired && !autoCheckDone && guestConfirmed;

    // ------------------------------------------------------------------
    // HOST MODE VIEW
    // ------------------------------------------------------------------
    if (isHostMode && autoCheckDone) {
        const isSuccess = scanResult?.success;
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
                <div className="absolute top-0 right-0 p-4 z-50">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            localStorage.removeItem('lony_host_mode');
                            window.location.reload();
                        }}
                        className="text-gray-500 hover:text-[#2C3E50] text-xs"
                    >
                        تسجيل خروج (Staff)
                    </Button>
                </div>

                <div className={`w-full max-w-sm rounded-[3rem] p-1 transition-all duration-700 ${isSuccess ? 'bg-gradient-to-tr from-[#8FA08E] to-[#6C7E6B]' : 'bg-gradient-to-tr from-[#B57382] to-[#915664]'} shadow-xl`}>
                    <div className="bg-[#FDFBF7] rounded-[2.9rem] overflow-hidden">
                        <div className={`h-56 flex flex-col items-center justify-center relative ${isSuccess ? 'bg-[#8FA08E]/10' : 'bg-[#B57382]/10'}`}>
                            {isSuccess ? <Check className="w-28 h-28 text-[#8FA08E] mb-4 z-10" /> : <X className="w-28 h-28 text-[#B57382] mb-4 z-10" />}
                            <h2 className={`text-4xl font-black font-serif z-10 ${isSuccess ? 'text-[#8FA08E]' : 'text-[#B57382]'}`}>
                                {isSuccess ? 'تم التحقق' : 'مرفوض'}
                            </h2>
                        </div>

                        <div className="p-10 text-center space-y-8 bg-white border-t border-[#E5DCC5]">
                            <div>
                                <p className="text-gray-500 text-xs mb-2 uppercase font-black tracking-widest">الاسم الكامل</p>
                                <h3 className="text-3xl font-black font-serif text-[#2C3E50] leading-tight">{guest.name}</h3>
                            </div>

                            <div className="bg-[#FDFBF7] rounded-2xl p-6 border border-[#E5DCC5]">
                                <p className={`font-bold transition-all ${isSuccess ? 'text-[#8FA08E]' : 'text-[#B57382]'}`}>
                                    {scanResult?.message}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-[#E5DCC5]">
                                    <p className="text-gray-500 text-[10px] mb-1 font-black uppercase tracking-tighter">المتبقي</p>
                                    <p className="text-3xl font-black text-[#C5A059]">{scanResult?.remaining}</p>
                                </div>
                                <div className="bg-[#FDFBF7] rounded-2xl p-4 border border-[#E5DCC5]">
                                    <p className="text-gray-500 text-[10px] mb-1 font-black uppercase tracking-tighter">الحالة</p>
                                    <p className="text-xl font-black text-[#2C3E50]">{guest.table_no || 'VIP'}</p>
                                </div>
                            </div>

                            {!isSuccess && (
                                <Button
                                    onClick={() => performAutoCheckIn(true)}
                                    className="w-full bg-[#B57382] hover:bg-[#915664] text-white font-black py-4 rounded-2xl h-auto"
                                >
                                    دخول إجباري (Force)
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-10">
                    <p className="text-gray-400 text-xs animate-pulse tracking-widest font-black uppercase">SCANNER READY FOR NEXT GUEST</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // WAIT / COUNTDOWN VIEW (When locked — event hasn't started yet)
    // ------------------------------------------------------------------
    if (isLocked && !isInspector && !isHostMode) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#C5A059]/10 rounded-full blur-[150px] pointer-events-none"></div>

                <div className="max-w-xl w-full z-10 text-center scale-up-center">
                    <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[3rem] shadow-xl p-10 md:p-14 relative group">
                        <div className="absolute top-6 left-6 opacity-40">
                            <LockIcon className="w-8 h-8 text-[#C5A059]" />
                        </div>

                        <div className="mb-12">
                            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-[#C5A059] to-[#D4AF37] rounded-3xl shadow-[0_4px_20px_rgba(197,160,89,0.3)] mb-8 transform -rotate-3 transition-transform hover:rotate-0 duration-500">
                                <Clock className="w-12 h-12 text-white" />
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black font-serif mb-4 text-[#2C3E50] leading-tight">
                                ننتظرك بكل حب
                            </h1>
                            <div className="h-1.5 w-32 bg-gradient-to-r from-[#C5A059] to-transparent mx-auto rounded-full"></div>
                        </div>

                        <div className="bg-[#FDFBF7] rounded-[2.5rem] p-8 mb-12 border border-[#E5DCC5] transition-all">
                            <p className="text-[#8FA08E] text-xs mb-4 uppercase tracking-[0.3em] font-black">سيتم تفعيل الدخول خلال</p>
                            {/* onExpire triggers countdownExpired → isEntryOpen → auto-transitions UI */}
                            <CountdownTimer targetDate={activationTime!} onExpire={handleCountdownExpire} />
                            <p className="text-[#C5A059] text-sm mt-4 font-bold">
                                موعد الفتح المبرمج: {activationTime?.toLocaleDateString('ar-SA')} الساعة {activationTime?.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-gray-500 text-[10px] mt-2 italic">
                                يفتح الباركود تلقائياً عند انتهاء الوقت
                            </p>
                        </div>

                        <div className="space-y-4">
                            <p className="text-gray-500 text-lg">أهلاً بك ضيفنا الكريم</p>
                            <h2 className="text-3xl font-black font-serif text-[#2C3E50]">{guest.name}</h2>
                            <div className="flex items-center justify-center gap-4 text-gray-500 text-sm pt-6 border-t border-[#E5DCC5] mt-8">
                                <div className="flex flex-col items-center gap-1 border-[#E5DCC5] pb-4">
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Calendar className="w-4 h-4 text-[#8FA08E]" />
                                        <span className="text-lg">{guest.events?.date}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[#C5A059] font-bold">
                                        <span>{guest.events?.date ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(getSafeDate(guest.events.date)!) : ''} هـ</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-gray-500">
                                    <MapPin className="w-4 h-4 text-[#B57382]" />
                                    <span>{guest.events?.venue}</span>
                                </div>
                            </div>
                            <div className="mt-8 flex items-center justify-center gap-2 text-[#B57382]/80 text-sm">
                                <LockIcon className="w-4 h-4" />
                                <span>يتم تأمين الدخول حتى الموعد المحدد</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col items-center gap-4 opacity-70">
                        <p className="text-[10px] tracking-[0.5em] text-[#C5A059] uppercase font-black">Lony Invitations - Official Page</p>
                        <button onClick={() => setShowHostLogin(true)} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">Staff Access</button>
                    </div>
                </div>

                {/* Staff Login Modal */}
                {showHostLogin && (
                    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-xl">
                        <div className="bg-[#1A1C23] p-10 rounded-[3rem] w-full max-w-xs border border-white/10 text-center space-y-8 animate-in zoom-in duration-300">
                            <h3 className="text-2xl font-black text-white">تسجيل دخول المشرف</h3>
                            <input
                                autoFocus
                                type="password"
                                placeholder="PIN"
                                className="w-full text-center text-5xl tracking-[10px] bg-black/40 border-2 border-white/5 rounded-[2rem] p-6 text-[#D4AF37] outline-none focus:border-[#D4AF37]/50 transition-all font-mono"
                                maxLength={4}
                                value={hostPinInput}
                                onChange={e => setHostPinInput(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="ghost" onClick={() => setShowHostLogin(false)} className="text-gray-500 py-6 rounded-2xl">إلغاء</Button>
                                <Button
                                    onClick={() => {
                                        if (guest?.events?.host_pin === hostPinInput) {
                                            localStorage.setItem('lony_host_mode', 'true');
                                            setIsHostMode(true);
                                            setShowHostLogin(false);
                                            window.location.reload();
                                        } else {
                                            alert('رمز الدخول غير صحيح');
                                        }
                                    }}
                                    className="bg-[#D4AF37] text-black font-black py-6 rounded-2xl hover:scale-105 transition-transform"
                                >
                                    دخول
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ------------------------------------------------------------------
    // EVENT EXPIRED VIEW — event ended (past qr_active_until)
    // ------------------------------------------------------------------
    if (isEventExpired) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex items-center justify-center p-6" dir="rtl">
                <div className="text-center max-w-sm w-full space-y-8">
                    <div className="w-24 h-24 rounded-full bg-white border border-[#E5DCC5] shadow-sm flex items-center justify-center mx-auto">
                        <Clock className="w-12 h-12 text-[#C5A059]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black font-serif mb-3">انتهت المناسبة</h1>
                        <p className="text-gray-500">شكراً لكم، نتمنى أن تكونوا قضيتم أجمل الأوقات.</p>
                    </div>
                    <div className="bg-white/80 border border-[#E5DCC5] shadow-sm rounded-3xl p-6 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-2">{guest.events?.name}</p>
                        <p className="text-[#C5A059] font-bold text-sm">{guest.events?.date}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Lony Invitations</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // PENDING GUEST DURING EVENT — opened link but never confirmed
    // This is a safety guard; in practice confirmed guests get the card.
    // ------------------------------------------------------------------
    if (isEventActive && !autoCheckDone && !guestConfirmed) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex items-center justify-center p-6" dir="rtl">
                <div className="text-center max-w-sm w-full space-y-8">
                    <div className="w-24 h-24 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-12 h-12 text-[#C5A059]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black font-serif mb-3">لم يتم تأكيد حضورك</h1>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            يرجى التوجه لمكتب الاستقبال أو التواصل مع المنظمين.
                        </p>
                    </div>
                    <div className="bg-white/80 border border-[#E5DCC5] shadow-sm rounded-3xl p-6 text-center space-y-2">
                        <p className="text-gray-500 text-xs">الضيف</p>
                        <p className="text-xl font-black font-serif text-[#2C3E50]">{guest.name}</p>
                    </div>
                    {/* Show RSVP button as last chance */}
                    {rsvpStatus === 'pending' && (
                        <Button
                            onClick={() => handleRsvp('confirmed')}
                            disabled={loading}
                            className="w-full bg-[#C5A059] text-white font-black py-6 rounded-2xl h-auto hover:scale-[1.02] transition-transform"
                        >
                            تأكيد الحضور الآن
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // ENTRY OPEN VIEW — event started, confirmed guest opens link (no scan yet)
    // Shows: glowing QR + "Entry Now Open" — no countdown, no lock
    // ------------------------------------------------------------------
    if (isEntryOpen) {
        return (
            <div
                className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden"
                dir="rtl"
            >
                {/* Gold ambient glow */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(197,160,89,0.08)_0%,_transparent_70%)] pointer-events-none" />
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none" />

                <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-8">

                    {/* Status badge */}
                    <div className="flex items-center gap-3 bg-[#8FA08E]/10 border border-[#8FA08E]/30 rounded-full px-6 py-3 shadow-sm">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FA08E] opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#6C7E6B]" />
                        </span>
                        <p className="text-[#5C6E5B] font-black font-serif tracking-widest uppercase">الدخول مفتوح الآن</p>
                    </div>

                    {/* Guest name */}
                    <div className="text-center">
                        <p className="text-gray-500 text-xs uppercase tracking-[0.4em] font-black mb-2">ضيفنا المميز</p>
                        <h1 className="text-4xl font-black font-serif text-[#2C3E50]">{guest.name}</h1>
                    </div>

                    {/* QR Code */}
                    <div className="relative group">
                        {/* Outer glow ring */}
                        <div className="absolute -inset-4 bg-[#C5A059]/20 rounded-[2.5rem] blur-xl opacity-60 animate-pulse" />
                        <div className="absolute -inset-1 bg-gradient-to-tr from-[#C5A059]/40 to-[#D4AF37]/40 rounded-[2rem]" />
                        <div className="relative bg-white p-5 rounded-[1.8rem] shadow-xl border border-[#E5DCC5]/50">
                            <QRCode
                                value={`${window.location.origin}/verify/${guest.qr_token}`}
                                size={200}
                                bgColor="#ffffff"
                                fgColor="#2C3E50"
                                level="Q"
                            />
                        </div>
                    </div>

                    {/* Instruction */}
                    <div className="text-center space-y-1">
                        <p className="text-[#C5A059] font-black text-xs tracking-[0.3em] uppercase">اعرض هذا الرمز عند المدخل</p>
                        <p className="text-gray-500 text-[10px]">سيتم تسجيل دخولك تلقائياً عند المسح</p>
                    </div>

                    {/* Event info */}
                    <div className="w-full bg-white/80 border border-[#E5DCC5] shadow-sm rounded-3xl p-6 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-gray-500">
                                <Calendar className="w-4 h-4 text-[#8FA08E]" />
                                <span>{guest.events?.date}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                                <MapPin className="w-4 h-4 text-[#B57382]" />
                                <span>{guest.events?.venue}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5DCC5]">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-500 font-black mb-1">رقم الطاولة</p>
                                <p className="text-xl font-black font-serif text-[#C5A059]">{guest.table_no || 'VIP'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-500 font-black mb-1">عدد المقاعد</p>
                                <p className="text-xl font-black font-serif text-[#2C3E50]">{1 + (guest.companions_count || 0)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Staff access */}
                    <button
                        onClick={() => setShowHostLogin(true)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors uppercase font-black tracking-widest"
                    >
                        Staff Access
                    </button>
                </div>

                {/* Staff Login Modal */}
                {showHostLogin && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                        <div className="bg-[#FDFBF7] p-10 rounded-[3rem] w-full max-w-xs border border-[#E5DCC5] text-center space-y-10 animate-in zoom-in duration-300 shadow-2xl">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black font-serif text-[#2C3E50]">Inspector Access</h3>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Enter Staff PIN</p>
                            </div>
                            <input
                                autoFocus
                                type="password"
                                placeholder="PIN"
                                className="w-full text-center text-5xl tracking-[12px] bg-white border-2 border-[#E5DCC5] rounded-[2.5rem] p-8 text-[#C5A059] outline-none focus:border-[#C5A059]/50 transition-all font-mono shadow-sm"
                                maxLength={4}
                                value={hostPinInput}
                                onChange={e => setHostPinInput(e.target.value)}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="ghost" onClick={() => setShowHostLogin(false)} className="text-gray-500 font-bold hover:bg-gray-100">CANCEL</Button>
                                <Button
                                    onClick={() => {
                                        if (guest?.events?.host_pin === hostPinInput) {
                                            localStorage.setItem('lony_host_mode', 'true');
                                            setIsHostMode(true);
                                            setShowHostLogin(false);
                                            window.location.reload();
                                        } else {
                                            alert('Invalid PIN');
                                        }
                                    }}
                                    className="bg-[#C5A059] hover:bg-[#D4AF37] text-white font-black py-4 rounded-2xl"
                                >
                                    VERIFY
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ------------------------------------------------------------------
    // GUEST LUXURY DASHBOARD (Public Landing Page)
    // ------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] font-sans flex flex-col items-center relative overflow-hidden" dir="rtl">
            <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-[#E5DCC5]/30 to-transparent pointer-events-none"></div>
            <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-[#C5A059] opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-md p-6 flex flex-col items-center min-h-screen">
                <div className="mt-10 mb-14 text-center">
                    <Award className="w-10 h-10 text-[#C5A059] mx-auto mb-4 opacity-80" />
                    <h1 className="text-sm tracking-[0.4em] font-black text-gray-400 uppercase">Lony Invitations</h1>
                </div>

                <div className="w-full bg-white/90 backdrop-blur-xl border border-[#E5DCC5] rounded-[3rem] overflow-hidden shadow-2xl relative group animate-in slide-in-from-bottom-8 duration-1000">
                    <div className="p-10 text-center border-b border-[#E5DCC5] bg-gradient-to-b from-[#FDFBF7] to-transparent">
                        <h2 className="text-[#C5A059] text-3xl font-black font-serif mb-6 leading-relaxed">
                            {guest.events?.name}
                        </h2>
                        <div className="flex flex-col items-center gap-3">
                            <div className="flex justify-center gap-8 text-xs text-gray-500 font-black">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-[#8FA08E]" />
                                    <span>{guest.events?.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-[#B57382]" />
                                    <span>{guest.events?.venue}</span>
                                </div>
                            </div>
                            <div className="text-[#C5A059] font-bold text-sm bg-[#FDFBF7] px-4 py-1 rounded-full border border-[#E5DCC5]">
                                {guest.events?.date ? new Intl.DateTimeFormat('ar-SA-u-ca-islamic-uma', { day: 'numeric', month: 'long', year: 'numeric' }).format(getSafeDate(guest.events.date)!) : ''} هـ
                            </div>
                        </div>
                    </div>

                    <div className="p-10 text-center space-y-10 relative">
                        <div className="absolute top-0 left-0 w-6 h-12 bg-[#FDFBF7] rounded-r-full -translate-y-1/2 border-r border-[#E5DCC5]"></div>
                        <div className="absolute top-0 right-0 w-6 h-12 bg-[#FDFBF7] rounded-l-full -translate-y-1/2 border-l border-[#E5DCC5]"></div>

                        <div>
                            <p className="text-[10px] tracking-[0.4em] text-[#C5A059] uppercase font-black mb-3">ضيفنا المميز</p>
                            <h1 className="text-4xl font-black font-serif text-[#2C3E50] leading-tight">
                                {guest.name}
                            </h1>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#FDFBF7] p-6 rounded-3xl border border-[#E5DCC5] text-center transition-all hover:bg-white shadow-sm">
                                <p className="text-[10px] text-gray-500 mb-2 font-black">رقم الطاولة</p>
                                <p className="text-3xl font-black font-serif text-[#C5A059]">{guest.table_no || 'VIP'}</p>
                            </div>
                            <div className="bg-[#FDFBF7] p-6 rounded-3xl border border-[#E5DCC5] text-center transition-all hover:bg-white shadow-sm">
                                <p className="text-[10px] text-gray-500 mb-2 font-black">المرافقين</p>
                                <p className="text-3xl font-black font-serif text-[#2C3E50]">{1 + (guest.companions_count || 0)}</p>
                            </div>
                        </div>

                        {rsvpStatus === 'pending' ? (
                            <div className="space-y-4 pt-6">
                                <p className="text-[#2C3E50] text-sm font-bold font-serif">هل يسعدنا حضورك؟</p>
                                <div className="grid grid-cols-1 gap-3">
                                    <Button
                                        onClick={() => handleRsvp('confirmed')}
                                        className="w-full bg-[#C5A059] hover:bg-[#D4AF37] text-white font-black py-6 rounded-2xl h-auto transition-all hover:scale-[1.02] active:scale-95 shadow-md"
                                    >
                                        تأكيد الحضور
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleRsvp('declined')}
                                        className="w-full text-gray-500 hover:text-[#B57382] font-black"
                                    >
                                        اعتذار عن الحضور
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className={`p-6 rounded-[2.5rem] flex items-center justify-center gap-4 border transition-all duration-500 shadow-sm ${rsvpStatus === 'confirmed' || rsvpStatus === 'attended'
                                ? 'bg-[#8FA08E]/10 border-[#8FA08E]/20 text-[#5C6E5B]'
                                : 'bg-[#B57382]/10 border-[#B57382]/20 text-[#915664]'
                                }`}>
                                <div className={`p-2 rounded-full ${rsvpStatus === 'confirmed' || rsvpStatus === 'attended' ? 'bg-[#8FA08E] text-white' : 'bg-[#B57382] text-white'}`}>
                                    {rsvpStatus === 'confirmed' || rsvpStatus === 'attended' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </div>
                                <span className="font-black font-serif text-lg">
                                    {rsvpStatus === 'confirmed' ? 'تم تأكيد حضورك' : rsvpStatus === 'attended' ? 'أهلاً بك، تم الدخول' : 'تم الاعتذار'}
                                </span>
                            </div>
                        )}

                        {(rsvpStatus === 'confirmed' || rsvpStatus === 'attended' || rsvpStatus === 'pending') && (
                            <div className="pt-10 border-t border-[#E5DCC5] flex flex-col items-center gap-4">
                                <div className="relative group/qr">
                                    <div className="absolute -inset-2 bg-[#C5A059]/10 rounded-[2.5rem] blur-lg opacity-0 group-hover/qr:opacity-100 transition-opacity duration-500" />
                                    <div className="p-4 bg-white rounded-[2rem] shadow-lg border border-[#E5DCC5]/50 transition-transform hover:scale-105 duration-500 relative">
                                        <QRCode
                                            value={`${window.location.origin}/verify/${guest.qr_token}`}
                                            size={160}
                                            bgColor="#ffffff"
                                            fgColor="#2C3E50"
                                            level="Q"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-400 tracking-[0.4em] uppercase font-black">SCAN AT ENTRANCE</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto py-12 text-center space-y-3 opacity-60">
                    <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent mx-auto"></div>
                    <p className="text-[10px] text-gray-500 tracking-[0.4em] font-black uppercase">Designed & Secured by Lony</p>
                    <button onClick={() => setShowHostLogin(true)} className="text-[10px] text-gray-400 hover:text-[#C5A059] transition-colors uppercase font-black tracking-widest">Inspector Login</button>
                </div>
            </main>

            {/* Re-using the same Staff Login Modal */}
            {showHostLogin && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-[#FDFBF7] p-10 rounded-[3rem] w-full max-w-xs border border-[#E5DCC5] text-center space-y-10 animate-in zoom-in duration-300 shadow-2xl">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black font-serif text-[#2C3E50]">Inspector Access</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Enter Staff PIN</p>
                        </div>
                        <input
                            autoFocus
                            type="password"
                            placeholder="PIN"
                            className="w-full text-center text-5xl tracking-[12px] bg-white border-2 border-[#E5DCC5] rounded-[2.5rem] p-8 text-[#C5A059] outline-none focus:border-[#C5A059]/50 transition-all font-mono shadow-sm"
                            maxLength={4}
                            value={hostPinInput}
                            onChange={e => setHostPinInput(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="ghost" onClick={() => setShowHostLogin(false)} className="text-gray-500 font-bold hover:bg-gray-100">CANCEL</Button>
                            <Button
                                onClick={() => {
                                    if (guest?.events?.host_pin === hostPinInput) {
                                        localStorage.setItem('lony_host_mode', 'true');
                                        setIsHostMode(true);
                                        setShowHostLogin(false);
                                        window.location.reload();
                                    } else {
                                        alert('Invalid PIN');
                                    }
                                }}
                                className="bg-[#C5A059] hover:bg-[#D4AF37] text-white font-black py-4 rounded-2xl"
                            >
                                VERIFY
                            </Button>
                        </div>
                        <div>
                            <h4 className="font-black font-serif text-[#B57382] text-lg">وضع الأمان مفعل</h4>
                            <p className="text-sm text-gray-500 leading-snug">صلاحية الدخول تمنح فقط عبر مسح الرمز من خلال تطبيق المنظمين الرسمي.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuestVerification;
