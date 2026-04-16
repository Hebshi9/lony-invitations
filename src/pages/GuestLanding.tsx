
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Download, MapPin, Calendar, Clock, Lock, AlertCircle } from 'lucide-react';
import { hasFeature, EventFeatures } from '../lib/features';

interface GuestData {
    id: string;
    name: string;
    category?: string;
    companions_count: number;
    event_id: string;
}

interface EventData {
    id: string;
    name: string;
    event_date: string;
    location_name?: string;
    location_maps_url?: string;
    background_url?: string;
    features?: Partial<EventFeatures>;
}

export default function GuestLanding() {
    const { uuid } = useParams();
    const [guest, setGuest] = useState<GuestData | null>(null);
    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function fetchDetails() {
            if (!uuid) return;

            try {
                // 1. Get Guest Details
                const { data: guestData, error: guestError } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('id', uuid) // Assuming 'id' is the uuid, or we might need a separate public_id
                    .single();

                if (guestError) throw guestError;
                setGuest(guestData);

                // 2. Get Event Details
                if (guestData && guestData.event_id) {
                    const { data: eventData, error: eventError } = await supabase
                        .from('events')
                        .select('*')
                        .eq('id', guestData.event_id)
                        .single();

                    if (eventError) throw eventError;
                    setEvent(eventData);
                }

            } catch (err: any) {
                console.error("Error fetching invitation:", err);
                setError('عذراً، لم نتمكن من العثور على الدعوة. قد يكون الرابط خاطئاً أو منتهي الصلاحية.');
            } finally {
                setLoading(false);
            }
        }

        fetchDetails();
    }, [uuid]);

    if (loading) {
        return (
            <div className="min-h-screen bg-studio-ivory flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-studio-gold"></div>
            </div>
        );
    }

    if (error || !guest || !event) {
        return (
            <div className="min-h-screen bg-studio-ivory flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-2">تنبيه</h1>
                <p className="text-gray-600">{error || 'بيانات الدعوة غير متوفرة'}</p>
            </div>
        );
    }

    // Check if simple scan (guest preview) is enabled
    if (event && !hasFeature(event, 'enable_simple_scan')) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="max-w-md bg-white rounded-xl p-8 text-center">
                    <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">معاينة الدعوة غير متاحة</h2>
                    <p className="text-gray-600 mb-6">
                        معاينة الدعوة للضيوف غير مفعلة لهذا الحدث.
                    </p>
                    <div className="bg-blue-50 rounded-lg p-4 text-right">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <p className="font-bold mb-1">للدخول:</p>
                                <p>قم بإظهار الرمز للمشرفين عند الوصول</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Check if registration is required
    const isGenericGuest = guest.name.includes('بطاقة رقم') || guest.name.includes('Guest #') || (guest as any).is_generic;
    const registrationRequired = hasFeature(event, 'enable_registration') && isGenericGuest;
    const [regName, setRegName] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regCompanions, setRegCompanions] = useState(0);
    const [submittingReg, setSubmittingReg] = useState(false);
    const [isRegistered, setIsRegistered] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regName.trim() || regName.length < 3) {
            alert('يرجى إدخال الاسم الثلاثي بشكل صحيح');
            return;
        }
        setSubmittingReg(true);
        try {
            const { error: updateError } = await supabase
                .from('guests')
                .update({
                    name: regName,
                    phone: regPhone,
                    companions_count: regCompanions,
                    status: 'confirmed',
                    // Mark it as no longer generic if we had a flag
                })
                .eq('id', guest.id);

            if (updateError) throw updateError;

            // Success - refresh local states
            setGuest({ ...guest, name: regName, companions_count: regCompanions });
            setIsRegistered(true);

            // Trigger WhatsApp QR card delivery automatically
            try {
                fetch('/api/send-campaign-background', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guestIds: [guest.id],
                        eventId: event.id,
                        campaignType: 'qr_code'
                    })
                }).catch(e => console.error("Auto WhatsApp Error:", e));
            } catch (e) {}

        } catch (err: any) {
            alert('حدث خطأ أثناء التسجيل: ' + err.message);
        } finally {
            setSubmittingReg(false);
        }
    };

    // Generate the Image URL based on convention (storage/cards/{guest_id}.png)
    const cardImageUrl = supabase.storage.from('cards').getPublicUrl(`${guest.id}.png`).data.publicUrl;

    if (registrationRequired && !isRegistered) {
        return (
            <div className="min-h-screen bg-indigo-950 text-white flex flex-col items-center relative overflow-hidden font-cairo" dir="rtl">
                <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-black/50 to-transparent z-0"></div>
                <div className="z-10 w-full max-w-md bg-white rounded-t-3xl shadow-2xl mt-12 min-h-screen flex flex-col px-8 py-10 animate-slide-up">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 rounded-full mb-4 border border-amber-100">
                            <Lock className="w-10 h-10 text-amber-600" />
                        </div>
                        <h1 className="text-2xl font-black text-indigo-950 mb-2">{event.name}</h1>
                        <p className="text-gray-500 font-medium">يرجى تسجيل بياناتك لتفعيل بطاقة الدعوة الخاصة بك</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">الاسم الكامل</label>
                            <input
                                required
                                type="text"
                                placeholder="ادخل اسمك الثلاثي"
                                className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">رقم الجوال (اختياري)</label>
                            <input
                                type="tel"
                                placeholder="05xxxxxxxx"
                                className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                value={regPhone}
                                onChange={(e) => setRegPhone(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">عدد المرافقين معك</label>
                            <select
                                className="w-full px-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                value={regCompanions}
                                onChange={(e) => setRegCompanions(parseInt(e.target.value))}
                            >
                                {[0, 1, 2, 3, 4, 5].map(n => (
                                    <option key={n} value={n}>{n === 0 ? 'بدون مرافقين' : `${n} مرافقين`}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            type="submit"
                            disabled={submittingReg}
                            className="w-full h-16 bg-indigo-950 hover:bg-black text-white rounded-2xl text-lg font-bold shadow-xl shadow-indigo-900/20 transform active:scale-95 transition-all"
                        >
                            {submittingReg ? 'جاري التفعيل...' : 'تفعيل بطاقة الدعوة'}
                        </Button>
                    </form>

                    <div className="mt-auto py-10 text-center opacity-40">
                        <p className="text-[10px] tracking-widest uppercase">Secured by Lony Invitations Platform</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-indigo-950 text-white flex flex-col items-center relative overflow-hidden font-cairo">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-black/50 to-transparent z-0"></div>

            {/* Main Content Card */}
            <div className="z-10 w-full max-w-md bg-white rounded-t-3xl shadow-2xl mt-10 min-h-screen flex flex-col items-center animate-slide-up">

                {/* Header / Event Name */}
                <div className="w-full p-6 text-center border-b border-gray-100">
                    <h2 className="text-gray-500 text-sm tracking-widest mb-1">دعوة خاصة</h2>
                    <h1 className="text-2xl font-bold text-indigo-900">{event.name || 'حفل زفاف'}</h1>
                </div>

                {/* Personalized Greeting */}
                <div className="p-6 text-center w-full">
                    <p className="text-gray-500 text-sm mb-2">مرحباً</p>
                    <h3 className="text-3xl font-bold text-gold-600 mb-4">{guest.name}</h3>
                    <p className="text-gray-600 text-sm px-6">
                        نتشرف بدعوتكم لحضور المناسبة. الرجاء إبراز رمز QR عند الدخول.
                    </p>
                </div>

                {/* Invitation Card Image */}
                <div className="w-full px-4 mb-6">
                    <div className="relative rounded-xl overflow-hidden shadow-lg border-4 border-gold-100">
                        {/* Fallback image if real validation needed, but browser handles broken image icons usually */}
                        <img
                            src={cardImageUrl}
                            alt="Invitation Card"
                            className="w-full h-auto object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e1e2e/FFF?text=Generating+Card...';
                            }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full px-6 flex flex-col gap-3 mb-8">
                    <a
                        href={cardImageUrl}
                        download={`invitation_${guest.name}.png`}
                        className="w-full py-3 bg-indigo-900 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-800 transition-colors shadow-md"
                    >
                        <Download size={20} />
                        <span>تحميل بطاقة الدعوة</span>
                    </a>

                    {event.location_maps_url && (
                        <a
                            href={event.location_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-white border border-gray-200 text-indigo-900 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                        >
                            <MapPin size={20} />
                            <span>موقع القاعة (Google Maps)</span>
                        </a>
                    )}
                </div>

                {/* Event Details Footer */}
                <div className="w-full bg-gray-50 p-6 rounded-t-3xl mt-auto">
                    <div className="flex justify-between items-center text-gray-600 text-sm">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gold-500" />
                            <span>{event.event_date ? new Date(event.event_date).toLocaleDateString('ar-SA') : 'قريباً'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-gold-500" />
                            <span>7:00 مساءً</span> {/* Todo: Add time column to event or parse from date */}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
