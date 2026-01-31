
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

    // Generate the Image URL based on convention (storage/cards/{guest_id}.png)
    // NOTE: This assumes images are uploaded to a public bucket named 'cards' or similar. 
    // We might need to generate a signed URL if it's private.
    const cardImageUrl = supabase.storage.from('cards').getPublicUrl(`${guest.id}.png`).data.publicUrl;

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
