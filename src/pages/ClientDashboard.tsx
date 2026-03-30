import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import { Card, CardContent } from '../components/ui/Card';
import { Loader2, Users, CheckCircle, Activity, Lock, XCircle, Calendar, MapPin, Clock, ArrowLeftRight, UserPlus, UploadCloud, Image as ImageIcon } from 'lucide-react';
import * as QRCode from 'qrcode';
const ClientDashboard: React.FC = () => {
    const { magicToken } = useParams<{ magicToken: string }>();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [totalGuests, setTotalGuests] = useState(0);
    const [attendedGuests, setAttendedGuests] = useState(0);
    const [confirmedGuests, setConfirmedGuests] = useState(0);
    const [declinedGuests, setDeclinedGuests] = useState(0);
    const [pendingGuests, setPendingGuests] = useState(0);
    const [totalIndividuals, setTotalIndividuals] = useState(0);
    const [attendedIndividuals, setAttendedIndividuals] = useState(0);
    const [replacements, setReplacements] = useState<any[]>([]);
    const [guestsList, setGuestsList] = useState<any[]>([]);
    const [event, setEvent] = useState<any>(null);
    const [isExpired, setIsExpired] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'guests' | 'replacements' | 'info'>('overview');

    // Replacement Form State
    const [repName, setRepName] = useState('');
    const [repPhone, setRepPhone] = useState('');
    const [repCompanions, setRepCompanions] = useState(0);
    const [isSubmittingRep, setIsSubmittingRep] = useState(false);
    const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);

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
            setPendingGuests(guests?.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length || 0);

            // Calculate Individuals (Guest + Companions)
            const totalIndiv = guests?.reduce((acc, g) => acc + 1 + (g.companions_count || 0), 0) || 0;
            const attendedIndiv = guests?.filter(g => g.status === 'attended').reduce((acc, g) => acc + 1 + (g.companions_attended || 0), 0) || 0;
            setTotalIndividuals(totalIndiv);
            setAttendedIndividuals(attendedIndiv);

            // جلب البدلاء
            const { data: reps } = await supabase
                .from('guest_replacements')
                .select('*')
                .eq('event_id', eventData.id)
                .order('created_at', { ascending: false });
            setReplacements(reps || []);

            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const handleAddReplacement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repName || !repPhone) return alert("الرجاء إدخال الاسم والرقم");
        if (replacements.length >= declinedGuests) return alert("لقد استنفذت عدد البدلاء المتاح لك");

        setIsSubmittingRep(true);
        try {
            const API_BASE = config.api.whatsapp;
            const res = await fetch(`${API_BASE}/add-replacement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: event.id,
                    name: repName,
                    phone: repPhone,
                    companions_count: repCompanions
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Failed to add replacement');

            alert('تم إضافة البديل بنجاح وجاري تجهيز بطاقته!');
            setRepName('');
            setRepPhone('');
            setRepCompanions(0);
            fetchData(); // refresh list
        } catch (err: any) {
            console.error(err);
            alert("خطأ: " + err.message);
        } finally {
            setIsSubmittingRep(false);
        }
    };

    const sendReplacementCard = async (repId: string, guestId: string, imageUrl: string) => {
        setIsGeneratingId(repId);
        try {
            const API_BASE = config.api.whatsapp;
            const res = await fetch(`${API_BASE}/send-replacement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: event.id,
                    guest_id: guestId,
                    image_url: imageUrl
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            alert("تم التوليد والإرسال بنجاح!");
            fetchData();
        } catch (e: any) {
            console.error(e);
            alert("حدث خطأ أثناء الإرسال: " + e.message);
        } finally {
            setIsGeneratingId(null);
        }
    };

    const handleAutoGenerate = async (rep: any) => {
        if (!event.features?.design_config) return alert('هذا الحدث لا يحتوي على قالب محفوظ في الاستوديو للتوليد التلقائي');
        setIsGeneratingId(rep.id);

        try {
            const { elements, backgroundUrl } = event.features.design_config;
            const guest = guestsList.find(g => g.id === rep.replacement_guest_id);
            if (!guest) throw new Error("لم يتم العثور على بيانات الضيف");

            const canvas = document.createElement('canvas');
            canvas.width = 1080; // Standard size, can be adjusted based on event features if needed
            canvas.height = 1920;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas error");

            if (backgroundUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = backgroundUrl;
                await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
                ctx.drawImage(img, 0, 0, 1080, 1920);
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, 1080, 1920);
            }

            for (const el of elements) {
                if (el.type === 'text') {
                    let text = el.text || '';
                    text = text.replace('{name}', guest.name)
                        .replace('{table}', guest.table_no || '')
                        .replace('{category}', guest.category || '')
                        .replace('{companions}', (guest.companions_count_invited || 0).toString())
                        .replace('{companions_count}', (guest.companions_count_invited || 0).toString())
                        .replace('{serial}', (guest.serial || 0).toString());

                    if (el.prefix) text = el.prefix + " " + text;
                    if (el.suffix) text = text + " " + el.suffix;

                    ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize}px ${el.fontFamily || 'Arial'}`;
                    ctx.fillStyle = el.color || '#000';
                    ctx.textAlign = el.align || 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(text, el.x, el.y);
                } else if (el.type === 'qr') {
                    const size = el.size || 200;
                    const defaultUrl = 'https://lonyinvit.netlify.app/check-in.html?token={token}';
                    const baseUrl = el.qrUrl && el.qrUrl.trim() ? el.qrUrl : defaultUrl;
                    const qrContent = baseUrl.replace('{token}', guest.qr_token || guest.id);

                    const qrData = await QRCode.toDataURL(qrContent, {
                        margin: 1,
                        width: size,
                        errorCorrectionLevel: el.qrCenterImage ? 'H' : 'M',
                        color: { dark: el.colorDark || '#000000', light: el.colorLight || '#00000000' }
                    });

                    const qrImg = new Image();
                    qrImg.crossOrigin = 'anonymous';
                    qrImg.src = qrData;
                    await new Promise(r => qrImg.onload = r);
                    ctx.drawImage(qrImg, el.x - size / 2, el.y - size / 2, size, size);
                }
            }

            await new Promise((resolve, reject) => {
                canvas.toBlob(async (blob) => {
                    if (!blob) return reject(new Error("Failed to create blob"));
                    const fileName = `${event.id}/${guest.qr_token}_rep.png`;

                    const { error } = await supabase.storage.from('invitations').upload(fileName, blob, {
                        upsert: true,
                        contentType: 'image/png'
                    });

                    if (error) return reject(error);

                    const { data: { publicUrl } } = supabase.storage.from('invitations').getPublicUrl(fileName);
                    await supabase.from('guests').update({ card_image_url: publicUrl }).eq('id', guest.id);
                    await sendReplacementCard(rep.id, guest.id, publicUrl);
                    resolve(true);
                }, 'image/png');
            });

        } catch (e: any) {
            console.error(e);
            alert("خطأ في التوليد الآلي: " + e.message);
            setIsGeneratingId(null);
        }
    };

    const handleManualUpload = async (rep: any, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsGeneratingId(rep.id);
        try {
            const guest = guestsList.find(g => g.id === rep.replacement_guest_id);
            if (!guest) throw new Error("لم يتم العثور على بيانات الضيف");

            const fileName = `${event.id}/${guest.qr_token}_manual_rep.png`;
            const { error: uploadError } = await supabase.storage.from('invitations').upload(fileName, file, {
                upsert: true,
                contentType: file.type
            });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('invitations').getPublicUrl(fileName);
            await supabase.from('guests').update({ card_image_url: publicUrl }).eq('id', guest.id);
            await sendReplacementCard(rep.id, guest.id, publicUrl);
        } catch (error: any) {
            console.error("Upload Error:", error);
            alert("فشل في رفع الصورة: " + error.message);
            setIsGeneratingId(null);
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
                <div className="bg-white rounded-xl shadow-sm p-1 flex justify-between overflow-x-auto snap-x hide-scrollbar">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-none w-1/3 min-w-[100px] snap-center py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-lony-gold text-lony-navy shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        الإحصائيات
                    </button>
                    <button
                        onClick={() => setActiveTab('guests')}
                        className={`flex-none w-1/3 min-w-[100px] snap-center py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${activeTab === 'guests' ? 'bg-lony-gold text-lony-navy shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        الضيوف ({totalGuests})
                    </button>
                    <button
                        onClick={() => setActiveTab('replacements')}
                        className={`flex-none w-1/3 min-w-[100px] snap-center py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${activeTab === 'replacements' ? 'bg-lony-gold text-lony-navy shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        الاستبدال {declinedGuests > 0 ? `(${declinedGuests})` : ''}
                    </button>
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`flex-none w-1/3 min-w-[100px] snap-center py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition-colors ${activeTab === 'info' ? 'bg-lony-gold text-lony-navy shadow-inner' : 'text-gray-500 hover:bg-gray-50'}`}
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
                                    <span className="text-sm font-medium text-gray-500 text-center">عائلة/دعوة</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-white border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-28">
                                    <span className="text-2xl font-bold text-gray-800 mb-1">{totalIndividuals}</span>
                                    <span className="text-sm font-medium text-gray-500 text-center">إجمالي الأشخاص المتوقعين</span>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-blue-50/50 border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-28">
                                    <span className="text-2xl font-bold text-blue-700 mb-1">{attendedIndividuals}</span>
                                    <span className="text-sm font-medium text-blue-800 text-center">عدد الداخلين (أفراد)</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50/50 border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-28">
                                    <span className="text-2xl font-bold text-red-600 mb-1">{declinedGuests}</span>
                                    <span className="text-sm font-medium text-red-800 text-center">الاعتذارات (دعوات)</span>
                                </CardContent>
                            </Card>
                        </div>

                        {/* RSVP Progress Bar */}
                        <Card className="border-none shadow-md">
                            <CardContent className="p-4">
                                <p className="text-sm font-bold text-gray-700 mb-2">نسبة الاستجابة</p>
                                <div className="w-full h-5 bg-gray-200 rounded-full overflow-hidden flex">
                                    <div className="bg-green-500 h-full transition-all" style={{ width: `${confirmationPercentage}%` }}></div>
                                    <div className="bg-red-400 h-full transition-all" style={{ width: `${totalGuests > 0 ? Math.round((declinedGuests / totalGuests) * 100) : 0}%` }}></div>
                                    <div className="bg-amber-400 h-full transition-all" style={{ width: `${totalGuests > 0 ? Math.round((pendingGuests / totalGuests) * 100) : 0}%` }}></div>
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                                    <span>🟢 مؤكد {confirmationPercentage}%</span>
                                    <span>🔴 معتذر {totalGuests > 0 ? Math.round((declinedGuests / totalGuests) * 100) : 0}%</span>
                                    <span>🟡 بانتظار {totalGuests > 0 ? Math.round((pendingGuests / totalGuests) * 100) : 0}%</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Replacements */}
                        {replacements.length > 0 && (
                            <Card className="border-none shadow-md bg-purple-50/50">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                                        <p className="text-sm font-bold text-purple-800">البدلاء ({replacements.length})</p>
                                    </div>
                                    <div className="space-y-2">
                                        {replacements.map((r: any) => (
                                            <div key={r.id} className="bg-white rounded-lg p-2 flex items-center justify-between text-sm">
                                                <div>
                                                    <span className="text-red-500 line-through text-xs">{r.original_guest_name}</span>
                                                    <span className="mx-1">→</span>
                                                    <span className="text-green-700 font-medium text-xs">{r.replacement_guest_name}</span>
                                                </div>
                                                {r.card_sent && <span className="text-[10px] text-green-600">✅ أُرسل</span>}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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

                {/* Tab: Replacements */}
                {activeTab === 'replacements' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <p className="text-sm text-purple-800 leading-relaxed font-medium">
                                يمكنك هنا إضافة ضيوف جدد بدلاً من الضيوف الذين اعتذروا. نظام لوني سيقوم بتجهيز الدعوة للبديل وإرسالها لهم تلقائياً.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Card className="bg-white border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-24">
                                    <span className="text-2xl font-bold text-gray-800 mb-1">{declinedGuests}</span>
                                    <span className="text-xs font-medium text-gray-500 text-center">المقاعد المتاحة<br />(المعتذرين)</span>
                                </CardContent>
                            </Card>
                            <Card className="bg-white border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center justify-center h-24">
                                    <span className="text-2xl font-bold text-purple-600 mb-1">{replacements.length}</span>
                                    <span className="text-xs font-medium text-purple-800 text-center">البدلاء<br />المضافين</span>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Add Replacement Form */}
                        {replacements.length < declinedGuests ? (
                            <Card className="border-none shadow-md overflow-hidden">
                                <div className="bg-lony-navy text-white px-4 py-3 flex items-center gap-2">
                                    <UserPlus className="w-4 h-4" />
                                    <h3 className="text-sm font-bold">إضافة بديل جديد</h3>
                                </div>
                                <CardContent className="p-4">
                                    <form onSubmit={handleAddReplacement} className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">الاسم الكريم</label>
                                            <input
                                                type="text"
                                                placeholder="مثال: فهد عبدالعزيز"
                                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-lony-gold focus:ring-1 focus:ring-lony-gold outline-none transition-all"
                                                value={repName}
                                                onChange={e => setRepName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">رقم الواتساب</label>
                                            <input
                                                type="tel"
                                                placeholder="05XXXXXXXX"
                                                className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:border-lony-gold focus:ring-1 focus:ring-lony-gold outline-none transition-all text-left"
                                                dir="ltr"
                                                value={repPhone}
                                                onChange={e => setRepPhone(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">عدد المرافقين</label>
                                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1 w-fit">
                                                <button type="button" onClick={() => setRepCompanions(Math.max(0, repCompanions - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:bg-gray-100">-</button>
                                                <span className="w-8 text-center font-bold">{repCompanions}</span>
                                                <button type="button" onClick={() => setRepCompanions(repCompanions + 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:bg-gray-100">+</button>
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmittingRep || !repName || !repPhone}
                                            className="w-full h-11 bg-lony-gold hover:bg-yellow-500 text-lony-navy font-bold rounded-lg mt-4 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isSubmittingRep ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                            اعتماد وإرسال
                                        </button>
                                    </form>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-center text-sm font-medium">
                                لقد قمت بإضافة الحد الأقصى من البدلاء المتاح ({declinedGuests} بديل). لا يمكنك إضافة المزيد إلا إذا اعتذر ضيوف آخرون.
                            </div>
                        )}

                        {/* Existing Replacements */}
                        <div className="space-y-2 mt-6">
                            <h3 className="text-sm font-bold text-gray-700 px-1">البدلاء ({replacements.length})</h3>
                            {replacements.length === 0 ? (
                                <p className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">لم تقم بإضافة أي بديل بعد</p>
                            ) : (
                                replacements.map((rep: any) => (
                                    <div key={rep.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{rep.replacement_guest_name}</span>
                                                <span className="text-xs text-gray-500 font-mono mt-0.5">{rep.replacement_guest_phone}</span>
                                            </div>
                                            <div className="bg-green-50 text-green-700 px-2 py-1 rounded text-[10px] font-bold">
                                                بديل
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-gray-50 pb-2">
                                            <span className="text-gray-500">بدلاً من: {rep.original_guest_name || 'غير محدد'}</span>
                                            <div className="flex items-center gap-1">
                                                {rep.card_sent ? (
                                                    <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> تم الإرسال</span>
                                                ) : (
                                                    <span className="text-amber-500 font-bold flex items-center gap-1"><Activity className="w-3 h-3" /> جاري التجهيز</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions for pending replacements */}
                                        {!rep.card_sent && (
                                            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                                {isGeneratingId === rep.id ? (
                                                    <div className="w-full text-center py-2 text-xs text-lony-navy font-bold flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> جاري التجهيز والإرسال...
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 w-full">
                                                        {event.features?.design_config && (
                                                            <button
                                                                onClick={() => handleAutoGenerate(rep)}
                                                                className="flex-1 bg-lony-navy text-white text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1 hover:bg-opacity-90 transition-all cursor-pointer"
                                                            >
                                                                <ImageIcon className="w-3 h-3 flex-shrink-0" /> تفعيل النماذج
                                                            </button>
                                                        )}
                                                        <div className="flex-1 relative cursor-pointer">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => handleManualUpload(rep, e)}
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                            />
                                                            <div className="w-full bg-gray-100 text-gray-700 text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1 hover:bg-gray-200 transition-all">
                                                                <UploadCloud className="w-3 h-3 flex-shrink-0" /> رفع بطاقة جاهزة
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
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
