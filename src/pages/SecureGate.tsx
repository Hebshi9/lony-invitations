import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { KeyRound, ShieldCheck, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { hasFeature } from '../lib/features';
import { normalizePin } from '../lib/utils';

const SecureGate: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [guest, setGuest] = useState<any>(null);
    const [event, setEvent] = useState<any>(null);
    const [enteredPin, setEnteredPin] = useState('');
    const [pinError, setPinError] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (token) {
            fetchInitialData();
        }
    }, [token]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const { data: guestData, error: guestError } = await supabase
                .from('guests')
                .select('*, events(*)')
                .eq('qr_token', token)
                .single();

            if (guestError || !guestData) {
                setError('لم يتم العثور على هذه الدعوة');
                return;
            }

            setGuest(guestData);
            setEvent(guestData.events);

            // If PIN is NOT enabled, redirect to normal view immediately
            if (!hasFeature(guestData.events, 'enable_host_pin') || !guestData.events.host_pin) {
                navigate(`/v/${token}`, { replace: true });
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handlePinSubmit = async () => {
        if (!event || !guest || verifying) return;
        
        setVerifying(true);
        setPinError(false);

        try {
            if (normalizePin(enteredPin) === normalizePin(event.host_pin)) {
                // Correct PIN - Perform Check-in and redirect
                await performCheckIn();
                navigate(`/v/${token}`, { replace: true });
            } else {
                setPinError(true);
                setEnteredPin('');
            }
        } catch (err) {
            console.error('Verification error:', err);
            setPinError(true);
        } finally {
            setVerifying(false);
        }
    };

    const performCheckIn = async () => {
        const now = new Date().toISOString();
        
        // 1. Record the scan
        await supabase.from('scans').insert({
            guest_id: guest.id,
            event_id: event.id,
            scanned_at: now,
            scan_type: 'entry'
        });

        // 2. Update guest status
        const companionsAttended = (guest.companions_attended || 0) + 1;
        await supabase.from('guests').update({
            attended: true,
            attended_at: guest.attended_at || now,
            companions_attended: companionsAttended,
            status: 'attended'
        }).eq('id', guest.id);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
                <Loader2 className="w-12 h-12 animate-spin text-[#C5A059]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="bg-white border border-[#E5DCC5] rounded-3xl p-10 text-center shadow-xl max-w-md w-full">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">{error}</h1>
                    <p className="text-gray-500">يرجى التأكد من الرابط والمحاولة مرة أخرى.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2C3E50] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans" dir="rtl">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C5A059]/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#B57382]/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-md w-full z-10 animate-in fade-in zoom-in duration-500">
                <div className="bg-white/80 backdrop-blur-md border border-[#E5DCC5] rounded-[2.5rem] shadow-2xl p-8 md:p-12 text-center">
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-[#C5A059] to-[#D4AF37] rounded-2xl shadow-[0_4px_20px_rgba(197,160,89,0.3)] mb-6">
                            <KeyRound className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-[#2C3E50] mb-3 font-serif">
                            أدخل الرقم السري
                        </h1>
                        <p className="text-gray-500 leading-relaxed">
                            هذه الدعوة محمية برقم سري. أدخل الرقم للمتابعة.
                        </p>
                    </div>

                    <div className="mb-6">
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={enteredPin}
                            onChange={(e) => { setEnteredPin(e.target.value); setPinError(false); }}
                            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                            className={`w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-6 bg-white border-2 rounded-2xl outline-none transition-all ${pinError
                                ? 'border-red-400 bg-red-50 animate-shake'
                                : 'border-[#E5DCC5] focus:border-[#C5A059] focus:ring-4 focus:ring-[#C5A059]/10'
                                }`}
                            placeholder="• • • •"
                            autoFocus
                        />
                        {pinError && (
                            <p className="text-red-500 text-sm mt-3 font-bold flex items-center justify-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                الرقم السري غير صحيح
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handlePinSubmit}
                        disabled={enteredPin.length < 4 || verifying}
                        className="w-full py-4 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white font-bold text-lg rounded-2xl shadow-lg shadow-[#C5A059]/20 hover:shadow-[#C5A059]/40 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <span className="flex items-center justify-center gap-2">
                            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                            تحقق ودخول
                        </span>
                    </button>

                    <div className="mt-8 border-t border-[#E5DCC5] pt-6">
                        <h3 className="text-lg font-bold text-[#2C3E50] font-serif">{guest?.name}</h3>
                        <p className="text-sm text-[#C5A059] font-bold mt-1">{event?.name}</p>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-xs tracking-widest uppercase">
                        بواسطة <span className="text-[#C5A059] font-bold italic">LONY INVITATIONS</span>
                    </p>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                }
                .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
            ` }} />
        </div>
    );
};

export default SecureGate;
