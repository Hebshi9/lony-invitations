import { useParams } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { XCircle, Clock, Calendar, Loader2, MapPin, Lock as LockIcon, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { normalizePin } from '../lib/utils';
import { hasFeature, EventFeatures } from '../lib/features';

// --- STYLED COMPONENTS ---

const CountdownTimer = ({ targetDate, onComplete }: { targetDate: Date; onComplete?: () => void }) => {
    const [timeLeft, setTimeLeft] = useState({
        days: 0, hours: 0, minutes: 0, seconds: 0
    });

    useEffect(() => {
        const calculateTime = () => {
            const now = new Date().getTime();
            const distance = targetDate.getTime() - now;

            if (distance <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return true; // Finished
            }

            setTimeLeft({
                days: Math.floor(distance / (1000 * 60 * 60 * 24)),
                hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((distance % (1000 * 60)) / 1000)
            });
            return false;
        };

        calculateTime();
        const timer = setInterval(() => {
            if (calculateTime()) {
                clearInterval(timer);
                if (onComplete) onComplete();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate, onComplete]);

    const TimeUnit = ({ value, label }: { value: number, label: string }) => (
        <div className="flex flex-col items-center">
            <div className="bg-white border-2 border-[#E5DCC5] text-[#C5A059] w-16 h-20 md:w-24 md:h-28 rounded-3xl shadow-xl flex items-center justify-center mb-3 transform transition-all hover:scale-105 group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#C5A059]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="text-3xl md:text-5xl font-black font-mono tracking-tighter z-10">
                    {value.toString().padStart(2, '0')}
                </span>
            </div>
            <span className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{label}</span>
        </div>
    );

    return (
        <div className="flex justify-center items-center gap-3 md:gap-6" dir="ltr">
            <TimeUnit value={timeLeft.days} label="أيام" />
            <TimeUnit value={timeLeft.hours} label="ساعة" />
            <TimeUnit value={timeLeft.minutes} label="دقيقة" />
            <TimeUnit value={timeLeft.seconds} label="ثانية" />
        </div>
    );
};

// Helper to parse date strings safely
const getSafeDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    if (dateStr.length === 10) return new Date(`${dateStr}T12:00:00`);
    return new Date(dateStr);
};

interface Guest {
    id: string;
    event_id: string;
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
    qr_activation_enabled?: boolean;
    qr_active_from?: string;
    qr_active_until?: string;
    host_pin?: string;
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
    const [processing, setProcessing] = useState(false);
    const [scans, setScans] = useState<Scan[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const hasAutoCheckedIn = useRef(false);
    const pinVerificationLock = useRef(false);
    const initialStatus = useRef<'active' | 'not_started' | 'expired' | null>(null);

    // PIN state
    const [enteredPin, setEnteredPin] = useState('');
    const [pinError, setPinError] = useState(false);
    const [pinVerified, setPinVerified] = useState(false);
    
    useEffect(() => {
        if (!qr_token) return;
        try {
            const sessionSaved = sessionStorage.getItem(`pin_verified_${qr_token}`);
            const localSaved = localStorage.getItem(`pin_verified_${qr_token}`);
            if (sessionSaved === '1' || localSaved === '1') {
                setPinVerified(true);
                pinVerificationLock.current = true;
            }
        } catch (e) { console.warn('Storage sync failed:', e); }
    }, [qr_token]);

    const isPinEntryRequired = !!(
        event?.features?.enable_host_pin && 
        event?.host_pin && 
        !pinVerified && 
        !pinVerificationLock.current && 
        !guest?.attended
    );

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (qr_token) {
            fetchGuestData();
            const poll = setInterval(() => {
                if (document.visibilityState === 'visible') fetchGuestData();
            }, 10000);
            return () => clearInterval(poll);
        } else {
            setLoading(false);
        }
    }, [qr_token]);

    const fetchGuestData = async () => {
        try {
            setLoading(true);
            let guestData: Guest | null = null;
            let scansData: Scan[] | null = null;

            // Enhanced Simulation Matrix Logic (28+ Cases)
            if (qr_token?.startsWith('sim-')) {
                const now = new Date();
                const parts = qr_token.split('-');
                
                // sim-[time]-[pin]-[size]-[used]
                const timeMod = parts[1] || 'during'; 
                const pinMod = parts[2] === 'pin';
                const sizeMod = parseInt(parts[3]?.replace('g', '') || '1');
                const usedMod = parseInt(parts[4] || '0');

                
                const mockEvent: Event = {
                    id: '00000000-0000-0000-0000-000000000000',
                    name: 'حفل زفاف لوني الملكي',
                    date: now.toISOString().split('T')[0],
                    qr_activation_enabled: true,
                    qr_active_from: timeMod === 'before' ? new Date(now.getTime() + 30000).toISOString() : new Date(now.getTime() - 3600000).toISOString(),
                    qr_active_until: timeMod === 'expired' ? new Date(now.getTime() - 60000).toISOString() : new Date(now.getTime() + 3600000).toISOString(),
                    host_pin: '1234',
                    features: { enable_host_pin: pinMod, qr_time_restricted: true }
                };

                const isCheckInSim = sessionStorage.getItem(`sim_attended_${qr_token}`) === 'true';
                const effectiveUsedMod = isCheckInSim ? Math.max(1, Math.min(usedMod, sizeMod)) : Math.min(usedMod, sizeMod);

                guestData = {
                    id: '00000000-0000-0000-0000-000000000001',
                    event_id: mockEvent.id,
                    name: sizeMod > 1 ? `عائلة لوني (${sizeMod} أفراد)` : 'ضيف لوني المميز',
                    qr_token: qr_token,
                    attended: effectiveUsedMod > 0,
                    companions_count: sizeMod - 1,
                    companions_attended: effectiveUsedMod > 0 ? effectiveUsedMod - 1 : 0,
                    events: mockEvent
                };

                scansData = [];
                for (let i = 0; i < effectiveUsedMod; i++) {
                    scansData.push({ id: `s-${i}`, guest_id: guestData.id, scanned_at: now.toISOString(), scan_type: i === 0 ? 'entry' : 'companion' });
                }
            } else {
                const { data, error: guestError } = await supabase
                    .from('guests')
                    .select('*, events(*)')
                    .eq('qr_token', qr_token)
                    .single();

                if (guestError) throw guestError;
                guestData = data;

                if (guestData) {
                    const { data: sData } = await supabase
                        .from('scans')
                        .select('*')
                        .eq('guest_id', guestData.id)
                        .order('scanned_at', { ascending: false });
                    scansData = sData;
                }
            }

            if (guestData) {
                setGuest(guestData);
                const eventData = guestData.events;
                setEvent(eventData || null);

                // Status calculation for initialStatus ref
                if (!initialStatus.current && eventData) {
                    const activationEnabled = eventData.qr_activation_enabled === true;
                    if (activationEnabled) {
                        const nowTime = new Date();
                        const from = getSafeDate(eventData.qr_active_from);
                        const until = getSafeDate(eventData.qr_active_until);
                        if (from && nowTime.getTime() < from.getTime()) initialStatus.current = 'not_started';
                        else if (until && nowTime.getTime() > until.getTime()) initialStatus.current = 'expired';
                        else initialStatus.current = 'active';
                    } else {
                        initialStatus.current = 'active';
                    }
                }

                if (scansData) setScans(scansData);

                // Auto Check-in logic
                if (!hasAutoCheckedIn.current) {
                    const pinRequired = eventData?.features?.enable_host_pin && eventData?.host_pin && !pinVerified;
                    if (!pinRequired) {
                        const totalAllowed = 1 + (guestData.companions_count || 0);
                        const totalScannedCount = scansData?.length || 0;
                        
                        if (totalAllowed > totalScannedCount) {
                            if (initialStatus.current === 'active' && !eventData?.features?.require_inspector_app) {
                                hasAutoCheckedIn.current = true;
                                await performCheckIn(guestData.id, eventData);
                            } else if (initialStatus.current === 'not_started') {
                                hasAutoCheckedIn.current = true;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const performCheckIn = async (guestId: string, eventData: any) => {
        const now = new Date().toISOString();
        
        // Simulation Mode Bypass
        if (qr_token?.startsWith('sim-')) {
            const nowTime = new Date().toISOString();
            const newScan = { id: `sim-${Date.now()}`, guest_id: guestId, scanned_at: nowTime, scan_type: 'entry' };
            sessionStorage.setItem(`sim_attended_${qr_token}`, 'true');
            setScans(prev => [newScan, ...prev]);
            setGuest(prev => prev ? { ...prev, attended: true, attended_at: nowTime } : prev);
            return;
        }

        try {
            await supabase.from('scans').insert({ guest_id: guestId, event_id: eventData?.id, scanned_at: now });
            
            const { data: currentGuest } = await supabase.from('guests').select('attended, companions_attended, attended_at').eq('id', guestId).single();
            const newCompanionsAttended = currentGuest?.attended ? (currentGuest.companions_attended || 0) + 1 : (currentGuest?.companions_attended || 0);

            await supabase.from('guests').update({ attended: true, attended_at: currentGuest?.attended_at || now, companions_attended: newCompanionsAttended }).eq('id', guestId);

            const { data: newScans } = await supabase.from('scans').select('*').eq('guest_id', guestId).order('scanned_at', { ascending: false });
            if (newScans) setScans(newScans);
            setGuest(prev => prev ? { ...prev, attended: true, attended_at: now, companions_attended: newCompanionsAttended } : prev);
        } catch (e) { console.error('Check-in error:', e); }
    };

    const handleCheckInAll = async () => {
        if (!guest || !event || processing) return;
        setProcessing(true);
        try {
            const now = new Date().toISOString();
            const totalCompanions = guest.companions_count || 0;
            await supabase.from('guests').update({ attended: true, attended_at: guest.attended_at || now, companions_attended: totalCompanions }).eq('id', guest.id);
            setGuest(prev => prev ? { ...prev, attended: true, attended_at: prev.attended_at || now, companions_attended: totalCompanions } : prev);
            const { data: newScans } = await supabase.from('scans').select('*').eq('guest_id', guest.id).order('scanned_at', { ascending: false });
            if (newScans) setScans(newScans);
        } catch (e) { console.error(e); } finally { setProcessing(false); }
    };

    const handlePinSubmit = async () => {
        if (!event || !guest) return;
        if (normalizePin(enteredPin) === normalizePin(event.host_pin)) {
            pinVerificationLock.current = true;
            setPinVerified(true);
            setPinError(false);
            if (qr_token) {
                sessionStorage.setItem(`pin_verified_${qr_token}`, '1');
                localStorage.setItem(`pin_verified_${qr_token}`, '1');
            }
            const totalAllowed = 1 + (guest.companions_count || 0);
            if (totalAllowed > scans.length && !hasAutoCheckedIn.current) {
                hasAutoCheckedIn.current = true;
                if (!event.features?.require_inspector_app) performCheckIn(guest.id, event);
            }
        } else {
            setPinError(true);
            setEnteredPin('');
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-[#C5A059] animate-spin mb-4" />
            <p className="text-[#C5A059] font-bold">جاري تحميل الدعوة...</p>
        </div>
    );

    if (!guest || !event) return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6 text-center">
            <XCircle className="w-16 h-16 text-red-400 mb-4" />
            <h1 className="text-2xl font-bold text-[#2C3E50]">عذراً، الدعوة غير موجودة</h1>
            <p className="text-gray-500 mt-2">يرجى التأكد من الرابط والمحاولة مرة أخرى.</p>
        </div>
    );

    if (isPinEntryRequired) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="max-w-md w-full z-10">
                    <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] shadow-xl p-8 md:p-12 text-center">
                        <div className="mb-8">
                            <div className="flex justify-center mb-6">
                                <img src="/logo.jpg" alt="Lony Invitations" className="h-16 w-auto object-contain rounded-xl shadow-sm" />
                            </div>
                            <h1 className="text-2xl font-black font-serif text-[#2C3E50] mb-3">أدخل الرقم السري</h1>
                            <p className="text-gray-500 leading-relaxed">هذه الدعوة محمية برقم سري. أدخل الرقم للمتابعة.</p>
                        </div>
                        <div className="mb-6">
                            <input
                                type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
                                value={enteredPin} onChange={(e) => { setEnteredPin(e.target.value); setPinError(false); }}
                                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                                className={`w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-6 bg-white border-2 rounded-2xl outline-none transition-all ${pinError ? 'border-red-400 animate-shake' : 'border-[#E5DCC5] focus:border-[#C5A059]'}`}
                                placeholder="• • • •" autoFocus
                            />
                            {pinError && <p className="text-red-500 text-sm mt-3 font-bold animate-pulse">❌ الرقم السري غير صحيح</p>}
                        </div>
                        <button
                            onClick={handlePinSubmit} disabled={enteredPin.length === 0}
                            className="w-full py-4 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white font-bold text-lg rounded-2xl shadow-lg active:scale-95 disabled:opacity-40"
                        >
                            <span className="flex items-center justify-center gap-2"><ShieldCheck className="w-5 h-5" /> تحقق ودخول</span>
                        </button>
                        <div className="mt-8 border-t border-[#E5DCC5] pt-6">
                            <h3 className="text-lg font-bold text-[#2C3E50] font-serif">{guest.name}</h3>
                            <p className="text-sm text-[#C5A059] font-bold mt-1">{event.name}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Timing Logic
    const now = currentTime;
    const qrActivationEnabled = event.qr_activation_enabled === true;
    let qrStatus: 'active' | 'not_started' | 'expired' = 'active';

    const getActivationDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        try {
            if (dateStr.includes(' ') && !dateStr.includes('T')) return new Date(dateStr.replace(' ', 'T') + (dateStr.includes('+') ? '' : 'Z'));
            return new Date(dateStr);
        } catch (e) { return null; }
    };

    if (qrActivationEnabled) {
        let activeFrom = getActivationDate(event.qr_active_from);
        let activeUntil = getActivationDate(event.qr_active_until);
        if (!activeFrom && event.date) {
            const eventDate = new Date(event.date.length === 10 ? `${event.date}T13:00:00Z` : event.date);
            activeFrom = eventDate;
            activeUntil = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000);
        }
        if (activeFrom && now.getTime() < (activeFrom.getTime() - 500)) qrStatus = 'not_started';
        else if (activeUntil && now.getTime() > activeUntil.getTime()) qrStatus = 'expired';
    }

    const formatLocalizedDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '';
        const d = getSafeDate(dateStr);
        if (!d) return dateStr.split('T')[0];
        return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    };

    // Layout Priority
    // If we started as a countdown, we STAY as a countdown view until refresh.
    // This is the "No Auto Transition" rule requested by USER.
    const effectiveStatus = initialStatus.current || qrStatus;

    if (effectiveStatus === 'not_started') {
        const targetDate = getSafeDate(event.qr_active_from) || new Date(event.date);
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C5A059]/15 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="max-w-xl w-full z-10">
                    <div className="bg-white/90 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] shadow-2xl p-8 md:p-12 text-center relative">
                        <div className="mb-10 text-center">
                            <div className="flex justify-center mb-6">
                                <img src="/logo.jpg" alt="Lony" className="h-20 w-auto object-contain rounded-xl" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black font-serif mb-4 text-[#2C3E50]">نتشرف بدعوتك</h1>
                            <div className="h-1.5 w-24 bg-[#C5A059] mx-auto rounded-full"></div>
                        </div>
                        <div className="bg-white/60 rounded-[3rem] p-8 mb-10 border border-[#E5DCC5]/50 space-y-4 shadow-inner">
                            <h2 className="text-2xl font-bold font-serif text-[#C5A059]">{event.name}</h2>
                            <div className="flex flex-col items-center gap-3 text-[#2C3E50]">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-6 h-6 text-[#C5A059]" /> 
                                    <span className="text-xl font-medium">{formatLocalizedDate(event.date)}</span>
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-6 h-6 text-[#C5A059]" /> 
                                        <span className="text-lg opacity-80">{event.location}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mb-10 space-y-8">
                            <p className="text-gray-400 uppercase tracking-[0.3em] text-xs font-black">يفتح مسح الباركود خلال</p>
                            <CountdownTimer targetDate={targetDate} />
                        </div>
                        <div className="border-t border-[#E5DCC5]/60 pt-8 mt-4">
                            <p className="text-gray-400 text-sm mb-2">ضيفنا الكريم</p> 
                            <h3 className="text-3xl font-black text-[#2C3E50] font-serif">{guest.name}</h3>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (qrStatus === 'expired') {
        return (
            <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="max-w-md w-full text-center bg-white/90 border border-[#E5DCC5] rounded-[3rem] p-12 shadow-2xl">
                    <div className="flex justify-center mb-10"><img src="/logo.jpg" alt="Lony" className="h-12 w-auto opacity-30" /></div>
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-[2rem] mb-8"><Clock className="w-12 h-12 text-gray-300" /></div>
                    <h1 className="text-3xl font-black font-serif text-[#2C3E50] mb-4">انتهت الصلاحية</h1>
                    <p className="text-gray-400 text-lg mb-10">عذراً، لقد انتهت فترة صلاحية هذه الدعوة رسمياً.</p>
                </div>
            </div>
        );
    }

    const totalAllowed = 1 + (guest.companions_count || 0);
    // Optimistic scan count: at least 1 if the guest record says attended
    const totalScanned = Math.max(scans.length, (guest.attended || (qr_token?.startsWith('sim-') && sessionStorage.getItem(`sim_attended_${qr_token}`) === 'true')) ? 1 : 0);
    const remaining = Math.max(0, totalAllowed - totalScanned);
    const canCheckIn = remaining > 0;

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] py-8 px-6 relative overflow-hidden" dir="rtl">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-xl mx-auto space-y-6 z-10 relative">
                <div className="bg-white/90 border border-[#E5DCC5] rounded-[2rem] p-6 text-center shadow-xl">
                    <div className="flex justify-center mb-4"><img src="/logo.jpg" alt="Lony" className="h-10 w-auto opacity-90" /></div>
                    <h2 className="text-2xl font-black font-serif text-[#C5A059]">{event.name}</h2>
                    <div className="flex items-center justify-center gap-3 text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">
                        <Calendar className="w-4 h-4 text-[#C5A059]" /> <span>{formatLocalizedDate(event.date)}</span>
                    </div>
                </div>

                <div className="bg-white/90 border border-[#E5DCC5] rounded-[3rem] p-8 shadow-2xl relative overflow-hidden text-center">
                    <div className="flex justify-center mb-6">
                        <div className={`p-6 rounded-[2rem] shadow-xl ${remaining === 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-[#C5A059]'}`}>
                            {remaining === 0 ? <XCircle className="w-16 h-16" /> : <ShieldCheck className="w-16 h-16" />}
                        </div>
                    </div>
                    <h1 className={`text-2xl font-black font-serif mb-1 ${remaining === 0 ? 'text-red-700' : 'text-[#2C3E50]'}`}>
                        {remaining === 0 ? "تم استخدام الباركود مسبقاً" : "تم تأكيد الحضور"}
                    </h1>
                    <p className="text-[#C5A059] font-bold mb-6">{guest.name}</p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {guest.table_no && (
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">طاولة رقم</p>
                                <p className="text-xl font-black text-[#2C3E50]">{guest.table_no}</p>
                            </div>
                        )}
                        <div className={`bg-gray-50 rounded-2xl p-4 border border-gray-100 ${!guest.table_no ? 'col-span-2' : ''}`}>
                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">عدد المرافقين</p>
                            <p className="text-xl font-black text-[#2C3E50]">{guest.companions_count || 0}</p>
                        </div>
                    </div>

                    {remaining > 0 && (guest.companions_count || 0) > 0 && (
                        <button
                            onClick={handleCheckInAll} disabled={processing}
                            className="w-full py-4 bg-[#2C3E50] text-white font-bold rounded-2xl shadow-lg active:scale-95 flex items-center justify-center gap-2 mb-4"
                        >
                            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />} تسجيل دخول جميع المرافقين
                        </button>
                    )}

                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-gray-500 font-bold">الحاضرين حالياً</p>
                            <p className="text-xs text-[#2C3E50] font-black">{totalScanned} من {totalAllowed}</p>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-[#C5A059] transition-all duration-700" style={{ width: `${(totalScanned / totalAllowed) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                {scans.length > 0 && (
                    <div className="bg-white/80 border border-[#E5DCC5] rounded-[2rem] p-6 shadow-lg">
                        <div className="flex items-center gap-2 mb-4 text-[#C5A059]"><Clock className="w-5 h-5" /> <h3 className="font-bold">سجل الحضور</h3></div>
                        <div className="space-y-3">
                            {scans.slice(0, 3).map((scan, idx) => (
                                <div key={scan.id} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-xs font-bold text-[#2C3E50]">{scans.length - idx}</div> <span className="text-sm font-medium">دخول مفسوح</span></div>
                                    <span className="text-xs text-gray-400">{new Date(scan.scanned_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
