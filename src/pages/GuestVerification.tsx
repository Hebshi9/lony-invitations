import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'react-qr-code';
import { Button } from '../components/ui/Button';
import { Check, X, Loader2, AlertTriangle, MapPin, Calendar, Award } from 'lucide-react';

interface EventSettings {
    qr_fields: {
        show_name: boolean;
        show_table: boolean;
        show_companions: boolean;
        show_category: boolean;
        show_custom: string[];
    };
}

const GuestVerification: React.FC = () => {
    const { guestId } = useParams<{ guestId: string }>();
    const [guest, setGuest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
    const [isInspector, setIsInspector] = useState(false);
    const [settings, setSettings] = useState<EventSettings | null>(null);

    // Auto Check-in State
    const [autoCheckDone, setAutoCheckDone] = useState(false);
    const [scanResult, setScanResult] = useState<{
        success: boolean;
        message: string;
        remaining: number;
        canForce?: boolean;
    } | null>(null);
    const checkInAttempted = useRef(false);

    // Host Mode State
    const [isHostMode, setIsHostMode] = useState(false);
    const [showHostLogin, setShowHostLogin] = useState(false);
    const [hostPinInput, setHostPinInput] = useState('');

    useEffect(() => {
        // Check for inspector mode
        const inspectorMode = localStorage.getItem('lony_inspector_mode') === 'true';
        setIsInspector(inspectorMode);

        // Check for host mode
        const hostMode = localStorage.getItem('lony_host_mode') === 'true';
        setIsHostMode(hostMode);

        if (guestId) fetchGuest();
    }, [guestId]);

    // Trigger auto check-in when guest data is loaded and user is inspector or HOST
    useEffect(() => {
        if ((isInspector || isHostMode) && guest && !checkInAttempted.current) {
            checkInAttempted.current = true;
            // For Host Mode: ONLY if Simple Scan is enabled
            if (isHostMode && !guest.events?.enable_simple_scan) {
                return; // Package doesn't support it
            }
            performAutoCheckIn();
        }
    }, [isInspector, isHostMode, guest]);

    const fetchGuest = async () => {
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*, events(name, date, venue, settings, activation_time, enable_simple_scan, host_pin)')
                .eq('qr_token', guestId)
                .single();

            if (error) throw error;
            setGuest(data);
            setRsvpStatus(data.status);
            setSettings(data.events?.settings || {
                qr_fields: { show_name: true, show_table: true, show_companions: true, show_category: false, show_custom: [] }
            });
        } catch (error) {
            console.error('Error fetching guest:', error);
        } finally {
            setLoading(false);
        }
    };

    const performAutoCheckIn = async (force: boolean = false) => {
        if (!guest) return;

        try {
            // 1. Check Activation Time
            const activationTime = guest.events?.activation_time;
            if (activationTime && new Date() < new Date(activationTime) && !force) {
                setScanResult({
                    success: false,
                    message: `يبدأ الدخول في: ${new Date(activationTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`,
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
                    canForce: true // Flag to show button
                });
                setAutoCheckDone(true);
                return;
            }

            // Perform Check-in
            const newCount = alreadyScanned + 1;
            const newRemaining = force ? 0 : totalAllowed - newCount; // If forced, we don't really care about remaining logic as much, but let's keep it consistent.
            // Actually for force, we just increment scan_count. usage might go above total.

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
                .eq('id', guestId);

            if (error) throw error;

            // Refresh guest data to reflect new count
            const { data: updatedGuest } = await supabase
                .from('guests')
                .select('*')
                .eq('id', guestId)
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
                .eq('id', guestId);

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
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="animate-spin w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
                <p className="text-[#D4AF37] font-serif tracking-widest">LONY DESIGN</p>
            </div>
        </div>
    );

    if (!guest) return (
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
            <div className="text-center p-8 border border-[#D4AF37] rounded-xl">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">الرابط غير صالح</h2>
                <p className="text-gray-400">يرجى التأكد من رابط الدعوة</p>
            </div>
        </div>
    );

    const eventDate = new Date(guest.events?.date);
    const isExpired = eventDate < new Date(new Date().setHours(0, 0, 0, 0));

    // ------------------------------------------------------------------
    // HOST MODE VIEW (Simple Scan Feedback)
    // ------------------------------------------------------------------
    if (isHostMode && autoCheckDone) {
        const isSuccess = scanResult?.success;
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden" dir="rtl">

                {/* Logout Button */}
                <button
                    onClick={() => {
                        localStorage.removeItem('lony_host_mode');
                        window.location.reload();
                    }}
                    className="absolute top-4 right-4 text-xs text-gray-600 z-50"
                >
                    تسجيل خروج
                </button>

                <div className={`w-full max-w-sm rounded-[2rem] p-1 ${isSuccess ? 'bg-gradient-to-b from-green-400 to-green-600' : 'bg-gradient-to-b from-red-500 to-red-700'} shadow-2xl relative`}>
                    <div className="bg-[#0F1014] rounded-[1.9rem] overflow-hidden h-full">
                        <div className={`h-48 flex flex-col items-center justify-center ${isSuccess ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {isSuccess ? <Check className="w-24 h-24 text-green-500 mb-4" /> : <X className="w-24 h-24 text-red-500 mb-4" />}
                            <h2 className={`text-3xl font-bold ${isSuccess ? 'text-green-500' : 'text-red-500'}`}>
                                {isSuccess ? 'مسموح بالدخول' : 'مرفوض'}
                            </h2>
                        </div>

                        <div className="p-8 text-center space-y-6">
                            <div className="space-y-1">
                                <p className="text-gray-500 text-sm">اسم الضيف</p>
                                <h3 className="text-3xl font-bold text-white font-serif">{guest.name}</h3>
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-gray-400 text-sm mb-1">{scanResult?.message}</p>
                            </div>

                            {!isSuccess && (
                                <button
                                    onClick={() => {
                                        setAutoCheckDone(false);
                                        performAutoCheckIn();
                                    }}
                                    className="mt-2 text-[#D4AF37] text-sm underline hover:text-white transition-colors"
                                >
                                    محاولة مرة أخرى (Retry)
                                </button>
                            )}

                            {scanResult?.remaining !== undefined && (
                                <div className="flex justify-between items-center text-sm px-4">
                                    <span className="text-gray-500">المتبقي</span>
                                    <span className="text-[#D4AF37] text-xl font-bold">{scanResult.remaining}</span>
                                </div>
                            )}

                            {scanResult?.canForce && (
                                <button
                                    onClick={() => performAutoCheckIn(true)}
                                    className="mt-4 bg-red-500/10 text-red-500 border border-red-500/50 text-sm font-bold py-3 px-4 rounded-lg hover:bg-red-500/20 w-full flex items-center justify-center gap-2"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    دخول إجباري
                                </button>
                            )}

                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <p className="text-gray-500 text-sm animate-pulse">جاهز للمسح التالي...</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // INSPECTOR VIEW (Staff Mode)
    // ------------------------------------------------------------------
    if (isInspector) {
        if (!autoCheckDone) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-[#D4AF37] w-12 h-12" /></div>;

        const isSuccess = scanResult?.success;
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
                <div className={`w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative ${isSuccess ? 'bg-white' : 'bg-red-50'}`}>

                    {/* Header Status */}
                    <div className={`h-40 flex items-center justify-center ${isSuccess ? 'bg-gradient-to-br from-green-500 to-green-700' : 'bg-gradient-to-br from-red-500 to-red-700'}`}>
                        <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                            {isSuccess ? <Check className="w-12 h-12 text-white" strokeWidth={4} /> : <X className="w-12 h-12 text-white" strokeWidth={4} />}
                        </div>
                    </div>

                    <div className="p-8 text-center -mt-10 relative z-10">
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                            <h2 className={`text-2xl font-bold mb-1 ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
                                {isSuccess ? 'مرحباً، تفضل بالدخول' : 'تنبيه: دخول مرفوض'}
                            </h2>
                            <p className="text-gray-500 text-sm">{scanResult?.message}</p>

                            {scanResult?.canForce && (
                                <button
                                    onClick={() => performAutoCheckIn(true)}
                                    className="mt-4 bg-red-100 text-red-700 text-sm font-bold py-2 px-4 rounded-lg hover:bg-red-200 transition-colors w-full flex items-center justify-center gap-2"
                                >
                                    <AlertTriangle className="w-4 h-4" />
                                    تسجيل دخول إجباري (Force Entry)
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase">اسم الضيف</p>
                                <h3 className="text-2xl font-bold text-gray-800 font-serif leading-relaxed mt-1">{guest.name}</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-b py-4">
                                <div>
                                    <p className="text-xs text-gray-400">رقم الطاولة</p>
                                    <p className="text-xl font-bold text-[#D4AF37]">{guest.table_no || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">المرافقين</p>
                                    <p className="text-xl font-bold text-gray-700">{guest.companions_count || 0}</p>
                                </div>
                            </div>
                        </div>

                        {isSuccess && (
                            <div className="mt-8 bg-black text-[#D4AF37] py-3 rounded-xl font-bold flex justify-between px-6 items-center">
                                <span>المتبقي في الرصيد</span>
                                <span className="text-2xl">{scanResult?.remaining}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-8 text-center opacity-30 text-white text-xs">
                    <p>SYSTEM INSPECTOR MODE</p>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // GUEST LUXURY VIEW (Public Landing Page)
    // ------------------------------------------------------------------
    return (
        <div className="min-h-screen bg-[#0F1014] text-white font-sans flex flex-col items-center relative overflow-hidden" dir="rtl">

            {/* Background Luxury Effects */}
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-[#1a1c23] to-[#0F1014]"></div>
            <div className="absolute top-[-100px] left-[-100px] w-64 h-64 bg-[#D4AF37] opacity-10 blur-[100px] rounded-full"></div>
            <div className="absolute bottom-[-100px] right-[-100px] w-80 h-80 bg-[#D4AF37] opacity-5 blur-[120px] rounded-full"></div>

            <main className="relative z-10 w-full max-w-md p-6 flex flex-col items-center min-h-screen">

                {/* Brand Header */}
                <div className="mt-8 mb-12 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                    <Award className="w-8 h-8 text-[#D4AF37] mx-auto mb-2 opacity-80" />
                    <h1 className="text-xl tracking-[0.3em] font-serif text-white/50 uppercase">Lony Invitations</h1>
                </div>

                {/* Main Ticket Card */}
                <div className="w-full bg-[#1A1C23] border border-[#D4AF37]/30 rounded-[2rem] overflow-hidden shadow-2xl relative group">

                    {/* Golden Border Glow */}
                    <div className="absolute inset-0 border border-[#D4AF37]/20 rounded-[2rem] pointer-events-none"></div>

                    {/* Event Info Header */}
                    <div className="p-8 text-center border-b border-white/5 bg-[#15161A]">
                        <h2 className="text-[#D4AF37] text-2xl font-bold font-serif mb-6 leading-relaxed">
                            {guest.events?.name}
                        </h2>
                        <div className="flex justify-center gap-6 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                                <span>{guest.events?.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#D4AF37]" />
                                <span>{guest.events?.venue}</span>
                            </div>
                        </div>
                    </div>

                    {/* Guest Details */}
                    <div className="p-8 text-center space-y-8 relative">
                        {/* Decorative Side Notches */}
                        <div className="absolute top-0 left-0 w-4 h-8 bg-[#0F1014] rounded-r-full -translate-y-1/2"></div>
                        <div className="absolute top-0 right-0 w-4 h-8 bg-[#0F1014] rounded-l-full -translate-y-1/2"></div>

                        <div className="space-y-2">
                            <p className="text-xs tracking-widest text-[#D4AF37] uppercase">Special Guest</p>
                            <h1 className="text-3xl font-bold text-white font-serif leading-normal py-2">
                                {guest.name}
                            </h1>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#0F1014] p-4 rounded-xl border border-white/5">
                                <p className="text-xs text-gray-500 mb-1">TABLE NO</p>
                                <p className="text-2xl font-mono text-[#D4AF37]">{guest.table_no || 'VIP'}</p>
                            </div>
                            <div className="bg-[#0F1014] p-4 rounded-xl border border-white/5">
                                <p className="text-xs text-gray-500 mb-1">GUESTS</p>
                                <p className="text-2xl font-mono text-white">{1 + (guest.companions_count || 0)}</p>
                            </div>
                        </div>

                        {/* Confirmation Status */}
                        {rsvpStatus === 'pending' ? (
                            <div className="space-y-3 pt-4">
                                <p className="text-sm text-gray-400 mb-2">هل تود تأكيد الحضور؟</p>
                                <Button onClick={() => handleRsvp('confirmed')} className="w-full bg-[#D4AF37] hover:bg-[#B5952F] text-black font-bold py-6">
                                    تأكيد الحضور
                                </Button>
                                <Button onClick={() => handleRsvp('declined')} variant="ghost" className="w-full text-gray-500 hover:text-white hover:bg-white/5">
                                    اعتذار
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 p-4 rounded-xl flex items-center justify-center gap-3">
                                <div className="bg-[#D4AF37] p-1 rounded-full">
                                    <Check className="w-4 h-4 text-black" />
                                </div>
                                <span className="text-[#D4AF37] font-bold">
                                    {rsvpStatus === 'confirmed' ? 'تم تأكيد حضورك' : rsvpStatus === 'attended' ? 'تم تسجيل الدخول' : 'تم الاعتذار'}
                                </span>
                            </div>
                        )}

                        {(rsvpStatus === 'confirmed' || rsvpStatus === 'attended' || rsvpStatus === 'pending') && (
                            <div className="pt-6 border-t border-white/5">
                                <div className="bg-white p-2 rounded-xl inline-block shadow-lg shadow-[#D4AF37]/10">
                                    <QRCode value={`${window.location.origin}/v/${guest.qr_token}`} size={120} />
                                </div>
                                <p className="text-[10px] text-gray-600 mt-2 tracking-widest uppercase">Scan at Entrance</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-auto py-8 text-center space-y-2 opacity-40">
                    <div className="w-12 h-px bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent mx-auto"></div>
                    <p className="text-[10px] text-[#D4AF37] tracking-[0.2em] font-serif uppercase">Designed by Lony</p>

                    {/* Host Login Trigger */}
                    {!isHostMode && !isInspector && (
                        <div className="pt-4">
                            <button
                                onClick={() => setShowHostLogin(true)}
                                className="text-[10px] text-gray-700 hover:text-white transition-colors"
                            >
                                Staff Login
                            </button>
                        </div>
                    )}
                </div>

                {/* Host Login Modal */}
                {showHostLogin && (
                    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                        <div className="bg-[#1A1C23] p-6 rounded-2xl w-full max-w-xs border border-[#D4AF37]/30 text-center space-y-4">
                            <h3 className="text-white font-bold">تسجيل دخول المضيف</h3>
                            <input
                                type="password"
                                placeholder="PIN"
                                className="w-full text-center text-2xl tracking-widest bg-black/50 border border-gray-700 rounded-lg p-2 text-[#D4AF37]"
                                maxLength={4}
                                value={hostPinInput}
                                onChange={e => setHostPinInput(e.target.value)}
                            />
                            {guest?.events?.host_pin === hostPinInput && hostPinInput.length === 4 && (
                                <p className="text-green-500 text-xs">PIN Correct</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowHostLogin(false)}
                                    className="border-gray-600 text-gray-400"
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (guest?.events?.host_pin === hostPinInput) {
                                            localStorage.setItem('lony_host_mode', 'true');
                                            setIsHostMode(true);
                                            setShowHostLogin(false);
                                            window.location.reload(); // Reload to trigger auto-check
                                        } else {
                                            alert('رمز خطأ');
                                        }
                                    }}
                                    className="bg-[#D4AF37] text-black font-bold"
                                >
                                    دخول
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default GuestVerification;
