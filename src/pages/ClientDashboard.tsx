import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
    Loader2, Users, CheckCircle, Activity, Lock, XCircle, 
    Calendar, MapPin, Clock, ArrowLeftRight, UserPlus, 
    UploadCloud, Image as ImageIcon, LayoutDashboard, 
    MessageSquare, Eye, CheckCheck, UserCheck, Timer, AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import * as QRCode from 'qrcode';

const LONY_NAVY = '#2F3645';
const LONY_GOLD = '#C5A059';
const LONY_CREAM = '#FFF8E7';

const ClientDashboard: React.FC = () => {
    // Both params could be passed depending on the route
    const { magicToken, orderId } = useParams<{ magicToken: string; orderId: string }>();
    
    const [event, setEvent] = useState<any>(null);
    const [guestsList, setGuestsList] = useState<any[]>([]);
    const [replacements, setReplacements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpired, setIsExpired] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'guests' | 'replacements' | 'info'>('overview');
    
    // UI State
    const [isGeneratingId, setIsGeneratingId] = useState<string | null>(null);
    const [repName, setRepName] = useState('');
    const [repPhone, setRepPhone] = useState('');
    const [repCompanions, setRepCompanions] = useState(0);
    const [isSubmittingRep, setIsSubmittingRep] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Live sync every 30s
        return () => clearInterval(interval);
    }, [magicToken, orderId]);

    const fetchData = async () => {
        try {
            let query = supabase.from('events').select('*');
            
            // Fetch by either magicToken or orderId (standard event ID)
            if (magicToken) {
                query = query.eq('magic_link_token', magicToken);
            } else if (orderId) {
                query = query.eq('id', orderId);
            } else {
                setLoading(false);
                return;
            }

            const { data: eventData, error: eventError } = await query.single();

            if (eventError || !eventData) {
                setLoading(false);
                return;
            }

            setEvent(eventData);

            // Check Expiration (Privacy: 48 hours after event)
            if (eventData.date) {
                const eventDate = new Date(eventData.date);
                const now = new Date();
                const diffHours = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60);
                if (diffHours > 48) {
                    setIsExpired(true);
                    setLoading(false);
                    return;
                }
            }

            // Fetch Guests & Replacements in parallel for performance
            const [guestsRes, repsRes] = await Promise.all([
                supabase
                    .from('guests')
                    .select('*, whatsapp_messages(status, created_at)')
                    .eq('event_id', eventData.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('guest_replacements')
                    .select('*')
                    .eq('event_id', eventData.id)
                    .order('created_at', { ascending: false })
            ]);

            if (guestsRes.data) {
                const processed = guestsRes.data.map(g => {
                    const sortedMsgs = (g.whatsapp_messages || []).sort(
                        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                    return { ...g, last_wa_status: sortedMsgs[0]?.status || 'pending' };
                });
                setGuestsList(processed);
            }
            
            if (repsRes.data) setReplacements(repsRes.data);
            
            setLastUpdated(new Date());
            setLoading(false);
        } catch (e) {
            console.error('Data sync failed:', e);
            setLoading(false);
        }
    };

    // Computed Stats
    const stats = useMemo(() => {
        if (!guestsList.length) return null;
        
        const total = guestsList.length;
        const attended = guestsList.filter(g => g.status === 'attended').length;
        const confirmed = guestsList.filter(g => (g.rsvp_status || g.override_status) === 'confirmed').length;
        const declined = guestsList.filter(g => (g.rsvp_status || g.override_status) === 'declined').length;
        const pending = total - confirmed - declined;
        
        const totalPeople = guestsList.reduce((acc, g) => acc + 1 + (g.companions_count || 0), 0);
        const attendedPeople = guestsList.filter(g => g.status === 'attended').reduce((acc, g) => acc + 1 + (g.companions_attended || 0), 0);
        
        const wa = {
            sent: guestsList.filter(g => ['sent', 'delivered', 'read'].includes(g.last_wa_status)).length,
            delivered: guestsList.filter(g => ['delivered', 'read'].includes(g.last_wa_status)).length,
            read: guestsList.filter(g => g.last_wa_status === 'read').length
        };

        return { total, attended, confirmed, declined, pending, totalPeople, attendedPeople, wa };
    }, [guestsList]);

    // UI Content
    const pieData = stats ? [
        { name: 'مؤكد', value: stats.confirmed, color: '#10B981' },
        { name: 'معتذر', value: stats.declined, color: '#EF4444' },
        { name: 'بانتظار رد', value: stats.pending, color: LONY_GOLD },
    ] : [];

    if (loading) return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6">
            <Loader2 className="animate-spin text-[#C5A059] w-12 h-12 mb-4" />
            <p className="text-[#2F3645] font-bold animate-pulse">جاري تحديث بيانات مناسبتكم...</p>
        </div>
    );

    if (!event) return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4" dir="rtl">
            <Card className="max-w-md border-red-100 shadow-2xl">
                <CardContent className="p-8 text-center font-kufi">
                    <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-gray-800 mb-2">رابط غير صالح</h2>
                    <p className="text-gray-500 mb-6">عذراً، الرابط الذي تحاول الوصول إليه غير متاح أو منتهي الصلاحية.</p>
                </CardContent>
            </Card>
        </div>
    );

    if (isExpired) return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4" dir="rtl">
            <Card className="max-w-md shadow-2xl border-t-8 border-[#2F3645] rounded-3xl overflow-hidden font-kufi">
                <CardContent className="p-10 text-center">
                    <Lock className="w-20 h-20 text-[#C5A059] mx-auto mb-6" />
                    <h2 className="text-3xl font-black text-[#2F3645] mb-4">انتهت المناسبة السعيدة</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        تم أرشفة البيانات بنجاح بحمد الله.<br />
                        لتحقيق أعلى معايير الخصوصية لضيوفكم، تم إغلاق بوابة المتابعة بعد انتهاء الحدث بـ 48 ساعة.
                    </p>
                    <div className="bg-[#FFF8E7] rounded-2xl p-6 border border-[#C5A059]/20">
                        <p className="text-[#C5A059] font-black italic">نأمل أننا ساهمنا في تجميل مناسبتكم.</p>
                        <p className="text-xs text-[#2F3645]/60 mt-2">فريق لوني للدعوات</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col font-kufi text-[#2F3645]" dir="rtl">
            {/* Header: Luxury Premium Look */}
            <div className="bg-[#2F3645] text-white pt-12 pb-20 px-6 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#C5A059]/5 rounded-full -ml-24 -mb-24 blur-2xl"></div>
                
                <div className="relative z-10 max-w-lg mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <img src="/logo-white.png" className="h-8 opacity-90" alt="Lony" />
                        <div className="flex items-center gap-1.5 bg-[#C5A059] px-3 py-1 rounded-full text-[10px] font-black text-[#2F3645] uppercase tracking-tighter">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            Live Portal
                        </div>
                    </div>
                    <h1 className="text-3xl font-black font-amiri tracking-tight mb-2 drop-shadow-lg">{event.name}</h1>
                    <div className="flex items-center gap-4 text-white/60 text-xs">
                        <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {event.date}</div>
                        <div className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> تحديث: {lastUpdated.toLocaleTimeString('ar-SA')}</div>
                    </div>
                </div>
            </div>

            {/* Navigation Drawer Style */}
            <div className="px-4 -mt-10 max-w-lg mx-auto w-full mb-6">
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-xl p-1.5 flex justify-between">
                    {[
                        { id: 'overview', label: 'النبض الحي', icon: LayoutDashboard },
                        { id: 'guests', label: 'الضيوف', icon: Users },
                        { id: 'replacements', label: 'البدلاء', icon: ArrowLeftRight },
                        { id: 'info', label: 'التفاصيل', icon: MapPin }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-[1.25rem] transition-all duration-500 relative flex-1 ${
                                activeTab === tab.id 
                                ? 'bg-[#2F3645] text-[#C5A059] shadow-lg scale-[1.05]' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            <tab.icon className={`w-5 h-5 mb-1 ${activeTab === tab.id ? 'animate-bounce' : ''}`} />
                            <span className="text-[10px] font-black">{tab.label}</span>
                            {tab.id === 'guests' && guestsList.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-[#C5A059] text-[#2F3645] text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                    {guestsList.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 max-w-lg mx-auto w-full px-6 space-y-6 pb-24">
                
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && stats && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {/* Hero Stats Card */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <div className="text-3xl font-black text-[#2F3645] mb-1">{stats.attendedPeople}</div>
                                <div className="text-[10px] font-bold text-gray-400 mb-2">دخلوا القاعة</div>
                                <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-1000" 
                                        style={{ width: `${(stats.attendedPeople / (stats.totalPeople || 1)) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="text-[9px] text-[#2F3645]/60 mt-2 font-black">إجمالي: {stats.totalPeople} فرد</div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <div className="text-3xl font-black text-[#10B981] mb-1">{stats.confirmed}</div>
                                <div className="text-[10px] font-bold text-gray-400 mb-2">تأكيد RSVP</div>
                                <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-[#10B981] transition-all duration-1000" 
                                        style={{ width: `${(stats.confirmed / (stats.total || 1)) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="text-[9px] text-[#2F3645]/60 mt-2 font-black">من أصل: {stats.total} عائلة</div>
                            </div>
                        </div>

                        {/* Interactive Chart Section */}
                        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                            <CardHeader className="pb-0 pt-8 text-center">
                                <CardTitle className="text-sm font-black text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Activity className="w-4 h-4 text-[#C5A059]" /> تحليل استجابة الضيوف
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 flex flex-col items-center">
                                <div className="h-60 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                innerRadius={65}
                                                outerRadius={85}
                                                paddingAngle={8}
                                                dataKey="value"
                                                animationDuration={1500}
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontFamily: 'Noto Kufi Arabic' }} 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="grid grid-cols-3 gap-3 w-full mt-2">
                                    {pieData.map(item => (
                                        <div key={item.name} className="flex flex-col items-center bg-gray-50/50 p-2 rounded-2xl">
                                            <div className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-[10px] font-black text-gray-800">{item.name}</span>
                                            <span className="text-xs font-black text-gray-400">{Math.round((item.value / stats.total) * 100)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* WhatsApp Forensic Data */}
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-[#2F3645] text-white overflow-hidden p-0 relative">
                            <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/20 rounded-full -ml-12 -mt-12 blur-2xl"></div>
                            <CardContent className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/20 rounded-xl"><Eye className="w-5 h-5 text-blue-300" /></div>
                                        <h3 className="font-black text-sm tracking-wide">رصد تفاعل الواتساب</h3>
                                    </div>
                                    <div className="bg-[#10B981]/20 px-3 py-1 rounded-full border border-[#10B981]/30">
                                        <span className="text-[9px] font-black text-[#10B981]">موثق من ميتا</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'أُرسلت', value: stats.wa.sent, color: 'text-white' },
                                        { label: 'استُلمت', value: stats.wa.delivered, color: 'text-emerald-400' },
                                        { label: 'قُرأت', value: stats.wa.read, color: 'text-blue-400' }
                                    ].map(item => (
                                        <div key={item.label} className="flex flex-col items-center border-l last:border-l-0 border-white/5 py-2">
                                            <span className={`text-2xl font-black ${item.color}`}>{item.value}</span>
                                            <span className="text-[9px] font-medium opacity-50 uppercase mt-1 tracking-tighter">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[10px] font-bold opacity-80">كفاءة وصول الدعوات</span>
                                    </div>
                                    <span className="text-lg font-black text-emerald-400">{Math.round((stats.wa.delivered / (stats.wa.sent || 1)) * 100)}%</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 2. Guests List Tab */}
                {activeTab === 'guests' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-5 duration-700">
                        <div className="bg-[#FFF8E7] p-5 rounded-3xl border border-[#C5A059]/20 flex items-start gap-4">
                            <div className="p-2 bg-white rounded-xl shadow-sm"><AlertCircle className="w-5 h-5 text-[#C5A059]" /></div>
                            <p className="text-xs text-[#2F3645]/80 leading-relaxed font-bold">هذه القائمة مرئية لك فقط للمتابعة، يُمكنك معرفة من استلم بطاقته ومن قرأ الدعوة لحظياً.</p>
                        </div>

                        <div className="space-y-2">
                            {guestsList.length === 0 ? (
                                <div className="py-20 text-center">
                                    <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 font-bold">لا يوجد ضيوف مسجلين بعد</p>
                                </div>
                            ) : (
                                guestsList.map(guest => (
                                    <div key={guest.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex items-center justify-between hover:border-[#C5A059]/30 transition-all duration-300">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-black text-[#2F3645]">{guest.name}</p>
                                                {guest.status === 'attended' && (
                                                    <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">وصل</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <p className="text-[10px] font-bold text-gray-400" dir="ltr">{guest.phone?.replace(/(\d{3})(\d{3})(\d{4})/, '$1-***-****') || '05XXXXXXXX'}</p>
                                                {guest.category && <span className="text-[9px] bg-gray-100 px-2 py-0.5 rounded-full font-black text-gray-500">{guest.category}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 min-w-[100px]">
                                            {/* WhatsApp Status Indicators */}
                                            {guest.last_wa_status === 'read' ? (
                                                <div className="flex items-center gap-1 text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                                                    <Eye className="w-3 h-3" /> قُرأت
                                                </div>
                                            ) : guest.last_wa_status === 'delivered' ? (
                                                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                                    <CheckCheck className="w-3 h-3" /> استُلمت
                                                </div>
                                            ) : (
                                                <div className="text-[8px] text-gray-300 font-bold">بانتظار الإرسال</div>
                                            )}
                                            
                                            {/* RSVP Status */}
                                            {guest.rsvp_status === 'confirmed' ? (
                                                <span className="text-emerald-500 text-[9px] font-black flex items-center gap-1"><CheckCircle className="w-3 h-3" /> أكد الحضور</span>
                                            ) : guest.rsvp_status === 'declined' ? (
                                                <span className="text-red-400 text-[9px] font-black flex items-center gap-1"><AlertCircle className="w-3 h-3" /> اعتذر</span>
                                            ) : null}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Replacements Tab */}
                {activeTab === 'replacements' && stats && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-5 duration-700">
                        <div className="bg-[#2F3645] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                            <ArrowLeftRight className="absolute top-6 left-6 text-white/5 w-24 h-24 rotate-12" />
                            <h3 className="text-xl font-black mb-2 flex items-center gap-2">
                                <UserCheck className="w-6 h-6 text-[#C5A059]" /> نظام الاستبدال الذكي
                            </h3>
                            <p className="text-white/70 text-xs leading-relaxed font-bold">
                                نوفر لك مرونة عالية؛ استغل المقاعد الشاغرة (المعتذرين) وأضف بدلاء بضغطة زر. النظام سيتولى توليد وإرسال الدعوة آلياً.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="bg-white/5 rounded-3xl p-5 border border-white/10 text-center">
                                    <span className="block text-3xl font-black text-[#EF4444] mb-1">{stats.declined}</span>
                                    <span className="text-[9px] font-black opacity-50">مقعد متاح</span>
                                </div>
                                <div className="bg-[#C5A059] rounded-3xl p-5 text-[#2F3645] text-center">
                                    <span className="block text-3xl font-black mb-1">{replacements.length}</span>
                                    <span className="text-[9px] font-black opacity-80">تم استغلالها</span>
                                </div>
                            </div>
                        </div>

                        {/* Replacement Form */}
                        {replacements.length < stats.declined ? (
                            <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-gray-50">
                                <h3 className="text-lg font-black text-[#2F3645] mb-6 flex items-center gap-3">
                                    <UserPlus className="w-6 h-6 text-[#C5A059]" /> إضافة ضيف بديل
                                </h3>
                                <form  className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">الاسم الثلاثي</label>
                                        <input
                                            type="text"
                                            placeholder="اكتب اسم الضيف هنا..."
                                            className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#C5A059] outline-none transition-all"
                                            value={repName}
                                            onChange={e => setRepName(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">جوال الواتساب</label>
                                        <input
                                            type="tel"
                                            placeholder="05XXXXXXXX"
                                            className="w-full h-14 px-6 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-[#C5A059] outline-none transition-all text-left"
                                            dir="ltr"
                                            value={repPhone}
                                            onChange={e => setRepPhone(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!repName || !repPhone) return alert('أدخل البيانات');
                                            setIsSubmittingRep(true);
                                            // Handle Replacement API Call
                                            try {
                                                const res = await fetch(`${config.api.whatsapp}/add-replacement`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ event_id: event.id, name: repName, phone: repPhone, companions_count: repCompanions })
                                                });
                                                if (res.ok) {
                                                    alert('تمت إضافة البديل بنجاح!');
                                                    setRepName(''); setRepPhone(''); fetchData();
                                                }
                                            } finally { setIsSubmittingRep(false); }
                                        }}
                                        disabled={isSubmittingRep || !repName || !repPhone}
                                        className="w-full h-14 bg-[#C5A059] text-[#2F3645] font-black rounded-2xl shadow-lg shadow-[#C5A059]/30 hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
                                    >
                                        {isSubmittingRep ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                        تفعيل الدعوة فوراً
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-8 rounded-[2.5rem] text-center">
                                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                                <p className="text-sm font-black text-amber-900 mb-1">اكتمل النصاب المسموح</p>
                                <p className="text-[10px] text-amber-600 font-bold leading-relaxed">يمكنك إضافة بدلاء الجدد فقط في حال وجود اعتذارات إضافية من الضيوف الأساسيين.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Event Info Tab */}
                {activeTab === 'info' && (
                    <div className="space-y-4 animate-in fade-in zoom-in duration-700">
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden p-0">
                            <div className="h-40 bg-gray-100 relative group cursor-pointer overflow-hidden">
                                {event.features?.map_preview_url ? (
                                    <img src={event.features.map_preview_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="Venue" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                        <MapPin className="w-12 h-12 text-gray-300" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="bg-white text-[#2F3645] px-6 py-2 rounded-full font-black text-xs shadow-2xl">فتح الموقع في قوقل ماب</div>
                                </div>
                            </div>
                            <CardContent className="p-8 space-y-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[#FFF8E7] flex items-center justify-center flex-shrink-0">
                                        <Calendar className="w-6 h-6 text-[#C5A059]" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">تاريخ اليوم السعيد</h4>
                                        <p className="text-lg font-black text-[#2F3645]">{event.date || 'سيُحدد قريباً'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">موقع القاعة</h4>
                                        <p className="text-lg font-black text-[#2F3645]">{event.venue || 'الرياض، المملكة العربية السعودية'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                                        <Clock className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">وقت استقبال الضيوف</h4>
                                        <p className="text-lg font-black text-[#2F3645]">{event.opening_time ? new Date(event.opening_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'حسب وقت الدعوة'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <div className="text-center py-10 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
                             <img src="/logo.png" className="h-8 mx-auto" alt="Lony" />
                             <p className="text-[9px] font-black mt-4 uppercase tracking-[0.2em]">{config.app.name} System • Pro Edition</p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Sticky Bottom Badge */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-[#2F3645]/90 backdrop-blur-md text-[#C5A059] px-6 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-2 text-[10px] font-black">
                    <CheckCheck className="w-3.5 h-3.5" /> مؤمن بواسطة نظام لوني الموحد
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
