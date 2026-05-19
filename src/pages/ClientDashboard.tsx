import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
    Loader2, Users, CheckCircle, Activity, Lock, XCircle, 
    Calendar, MapPin, Clock, ArrowLeftRight, UserPlus, 
    Eye, CheckCheck, UserCheck, Timer, AlertCircle, 
    Download, FileText, Share2, Sparkles, TrendingUp
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { exportGuestListToCSV } from '../services/ExcelExportService';
import { pdfService } from '../services/pdf-service';

const LONY_NAVY = '#1A2B48';
const LONY_GOLD = '#D4AF37';
const LONY_CREAM = '#FDFBF7';
const LONY_ACCENT = '#9A7B4F';

const ClientDashboard: React.FC = () => {
    const { magicToken } = useParams<{ magicToken: string }>();
    
    const [event, setEvent] = useState<any>(null);
    const [guestsList, setGuestsList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExpired, setIsExpired] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'guests' | 'replacements'>('overview');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [isLedgerOnly, setIsLedgerOnly] = useState(false);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000); // More frequent updates for "Wow" factor
        return () => clearInterval(interval);
    }, [magicToken]);

    const fetchData = async () => {
        try {
            if (!magicToken) return;

            let { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('magic_link_token', magicToken)
                .maybeSingle();

            // FALLBACK: If not found in events, check business_ledger
            if (!eventData) {
                const { data: ledgerData } = await supabase
                    .from('business_ledger')
                    .select('*')
                    .eq('magic_token', magicToken)
                    .maybeSingle();
                
                if (ledgerData) {
                    eventData = {
                        id: ledgerData.id,
                        name: ledgerData.client_name,
                        date: ledgerData.event_date || ledgerData.order_date,
                        status: ledgerData.order_status,
                        is_ledger_only: true,
                        remaining_balance: ledgerData.remaining_balance
                    };
                    setIsLedgerOnly(true);
                }
            }

            if (!eventData) {
                setLoading(false);
                return;
            }

            setEvent(eventData);

            // Check Expiration (5 days after event)
            if (eventData.date) {
                const eventDate = new Date(eventData.date);
                const now = new Date();
                const diffDays = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays > 5) {
                    setIsExpired(true);
                    setLoading(false);
                    return;
                }
            }

            const { data: guestsRes } = await supabase
                .from('guests')
                .select('*, whatsapp_messages(status, updated_at, message_phase)')
                .eq('event_id', eventData.id)
                .order('name', { ascending: true });

            if (guestsRes) {
                // FILTER: Only show active guests (exclude standby/template cards)
                // We define a "Standby" guest as one whose name contains "مستودع" or "احتياط" or "Standard"
                const activeGuests = guestsRes.filter(g => {
                    const name = (g.name || '').toLowerCase();
                    // Don't filter out numbered cards, only filter out pure technical templates if needed
                    return !name.includes('technical_template');
                });

                const processed = activeGuests.map(g => {
                    const sortedMsgs = (g.whatsapp_messages || []).sort(
                        (a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                    );
                    return { ...g, last_wa_status: sortedMsgs[0]?.status || 'pending' };
                });
                setGuestsList(processed);

                // Generate Activity Feed
                const activity = guestsRes
                    .flatMap(g => (g.whatsapp_messages || []).map(m => ({ ...m, guestName: g.name })))
                    .filter(m => m.status === 'read' || m.status === 'delivered')
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .slice(0, 5);
                setRecentActivity(activity);
            }
            
            setLastUpdated(new Date());
            setLoading(false);
        } catch (e) {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        if (!guestsList.length) return null;
        const total = guestsList.length;
        const confirmed = guestsList.filter(g => g.rsvp_status === 'confirmed').length;
        const declined = guestsList.filter(g => g.rsvp_status === 'declined').length;
        const entered = guestsList.filter(g => g.has_entered).length;
        const totalCompanions = guestsList.reduce((acc, g) => acc + (g.companions || 0), 0);
        
        const wa = {
            sent: guestsList.filter(g => ['sent', 'delivered', 'read', 'failed'].includes(g.last_wa_status)).length,
            delivered: guestsList.filter(g => ['delivered', 'read'].includes(g.last_wa_status)).length,
            read: guestsList.filter(g => g.last_wa_status === 'read').length
        };
        return { total, confirmed, declined, entered, totalCompanions, wa };
    }, [guestsList]);

    const handleExportExcel = () => {
        if (!event || !guestsList.length) return;
        exportGuestListToCSV(guestsList, event.name);
    };

    const handleExportPDF = async () => {
        if (!event || !guestsList.length) return;
        await pdfService.generateAttendanceReport({
            eventName: event.name,
            eventDate: event.date || '',
            venue: event.venue || 'القاعة المخصصة',
            totalGuests: guestsList.length,
            attendedCount: guestsList.filter(g => g.has_entered).length,
            remainingCount: guestsList.filter(g => !g.has_entered).length,
            guests: guestsList
        });
    };

    if (loading) return (
        <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-6">
            <div className="relative">
                <div className="w-24 h-24 border-4 border-t-[#D4AF37] border-black/5 rounded-full animate-spin"></div>
                <img src="/logo-black.png" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 opacity-20" alt="" />
            </div>
            <p className="mt-8 text-[#1A2B48]/40 font-bold tracking-[0.3em] uppercase text-[10px]">Lony Luxury Dashboard</p>
        </div>
    );

    if (isExpired) return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6 text-right" dir="rtl">
            <div className="max-w-md w-full bg-white p-10 rounded-[3rem] border border-[#D4AF37]/20 text-center shadow-2xl">
                <Lock className="w-20 h-20 text-[#D4AF37] mx-auto mb-6" />
                <h2 className="text-3xl font-black text-[#1A2B48] mb-4">تمت أرشفة المناسبة</h2>
                <p className="text-[#1A2B48]/60 mb-8 leading-relaxed">
                    لحماية خصوصية ضيوفكم، يتم أرشفة البيانات بعد 5 أيام من تاريخ الحفل. نرجو أن نكون قد وفقنا في خدمتكم.
                </p>
                <button className="w-full bg-[#D4AF37] text-white font-black py-4 rounded-2xl shadow-xl shadow-yellow-900/20">طلب استعادة (للإدارة)</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#1A2B48] overflow-x-hidden font-kufi pb-20" dir="rtl">
            
            {/* Elegant Header */}
            <div className="relative pt-12 pb-32 px-6 overflow-hidden bg-gradient-to-b from-[#FFF9F0] to-[#FDFBF7]">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[120px] -mr-64 -mt-64"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/30 rounded-full blur-[100px] -ml-48 -mb-48"></div>
                
                <div className="max-w-xl mx-auto relative z-10 text-center">
                    <div className="flex flex-col items-center gap-6 mb-8">
                        <div className="bg-white px-5 py-2 rounded-2xl border border-[#D4AF37]/20 flex items-center gap-2 shadow-sm">
                            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                            <span className="text-[10px] font-black tracking-widest uppercase text-[#9A7B4F]">Lony Premium Dashboard</span>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tight text-[#1A2B48]">
                        {event.name}
                    </h1>
                    
                    <div className="flex flex-wrap items-center justify-center gap-4 text-[#1A2B48]/40 text-xs font-bold">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#D4AF37]/10 shadow-sm">
                            <Calendar className="w-4 h-4 text-[#D4AF37]" /> {event.date}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#D4AF37]/10 shadow-sm">
                            <Users className="w-4 h-4 text-[#D4AF37]" /> {stats?.total || 0} ضيف
                        </div>
                    </div>
                </div>
            </div>

            {/* Persistent Bottom Tab Navigation (Mobile First) */}
            <div className="fixed bottom-8 left-6 right-6 z-[100] max-w-xl mx-auto">
                <div className="bg-white/90 backdrop-blur-2xl p-2 rounded-[2rem] border border-[#D4AF37]/20 flex gap-2 shadow-2xl shadow-yellow-900/10">
                    {[
                        { id: 'overview', label: 'الخلاصة', icon: LayoutDashboard },
                        { id: 'whatsapp', label: 'التتبع الحي', icon: Activity },
                        { id: 'guests', label: 'كشف الحضور', icon: Users }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl transition-all duration-500 font-black text-[10px] ${
                                activeTab === tab.id ? 'bg-[#D4AF37] text-white shadow-lg shadow-yellow-900/20' : 'text-[#1A2B48]/30 hover:text-[#1A2B48]/60 hover:bg-[#FDFBF7]'
                            }`}
                        >
                            <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'animate-in zoom-in' : ''}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-xl mx-auto px-6 -mt-20 relative z-20 space-y-6 pb-32">
                
                {/* 0. Ledger Only State (Under Preparation) */}
                {isLedgerOnly && (
                    <div className="bg-white border border-[#D4AF37]/20 rounded-[3rem] p-10 text-center animate-in zoom-in duration-1000 shadow-xl shadow-yellow-900/5">
                        <div className="w-20 h-20 bg-[#D4AF37]/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#D4AF37]/10">
                            <Sparkles className="w-10 h-10 text-[#D4AF37] animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-black mb-3 text-[#1A2B48]">مناسبتكم قيد التجهيز</h3>
                        <p className="text-[#1A2B48]/40 text-sm leading-relaxed mb-8">
                            فريق لوني يعمل الآن على تجهيز الدعوات والباركودات الخاصة بكم. سيتم تفعيل لوحة التحكم الكاملة خلال ساعات قليلة.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#FDFBF7] p-4 rounded-3xl border border-[#D4AF37]/10">
                                <p className="text-[10px] opacity-40 uppercase mb-1 font-bold">حالة الطلب</p>
                                <p className="text-xs font-black text-[#D4AF37]">{event.status || 'جاري المراجعة'}</p>
                            </div>
                            <div className="bg-[#FDFBF7] p-4 rounded-3xl border border-[#D4AF37]/10">
                                <p className="text-[10px] opacity-40 uppercase mb-1 font-bold">المبلغ المتبقي</p>
                                <p className="text-xs font-black text-red-500">{event.remaining_balance || 0} SAR</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* TAB 1: OVERVIEW (Insights) */}
                {activeTab === 'overview' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white shadow-xl shadow-yellow-900/5 p-6 rounded-[2.5rem] border border-[#D4AF37]/20 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-500">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-[#9A7B4F] uppercase tracking-widest">تأكيد الحضور</span>
                                    <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/10">
                                        <UserCheck className="w-5 h-5 text-[#D4AF37]" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-4xl font-black mb-1 text-[#1A2B48]">{stats?.confirmed || 0}</div>
                                    <div className="text-[10px] text-[#9A7B4F] font-bold">إجمالي المرافقين: {stats?.totalCompanions || 0}</div>
                                </div>
                            </div>
                            <div className="bg-white shadow-xl shadow-emerald-900/5 p-6 rounded-[2.5rem] border border-emerald-500/10 flex flex-col justify-between h-44 group hover:scale-[1.02] transition-all duration-500">
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">حضور الباب</span>
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                        <Users className="w-5 h-5 text-emerald-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-4xl font-black mb-1 text-emerald-600">
                                        {stats?.entered || 0}
                                    </div>
                                    <div className="text-[10px] text-emerald-600/40 font-bold">من أصل {stats?.confirmed || 0} مؤكد</div>
                                </div>
                            </div>
                        </div>

                        {/* Attendance Gap Warning */}
                        {stats && stats.confirmed > stats.entered && (
                            <div className="bg-orange-50 border border-orange-200 p-5 rounded-3xl flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-orange-800">تنبيه الغياب</p>
                                    <p className="text-[10px] text-orange-600 font-bold">هناك {stats.confirmed - stats.entered} شخص أكدوا حضورهم ولم يصلوا للقاعة بعد.</p>
                                </div>
                            </div>
                        )}

                        {/* Export Center */}
                        <div className="bg-gradient-to-br from-[#1A2B48] to-[#2D4569] p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-[#D4AF37]/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                            <h3 className="text-2xl font-black mb-4">مركز التقارير</h3>
                            <p className="text-xs font-bold opacity-70 mb-10 leading-relaxed max-w-[280px]">
                                يمكنك تحميل التقارير النهائية للمناسبة بصيغ مختلفة للطباعة أو الأرشفة.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={handleExportExcel} className="bg-white text-[#1A2B48] py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3">
                                    <Download className="w-5 h-5 text-emerald-600" /> إكسل
                                </button>
                                <button onClick={handleExportPDF} className="bg-[#D4AF37] text-white py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3">
                                    <FileText className="w-5 h-5 text-white" /> PDF
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: LIVE TRACKING (WhatsApp) */}
                {activeTab === 'whatsapp' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {/* Live Funnel */}
                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-[#D4AF37]/20 p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-lg font-black flex items-center gap-3 text-[#1A2B48]">
                                    <Activity className="w-6 h-6 text-blue-500" /> مسار الإرسال
                                </h3>
                                <button onClick={fetchData} className="p-3 bg-[#FDFBF7] rounded-xl border border-[#D4AF37]/20">
                                    <Loader2 className={`w-4 h-4 text-[#D4AF37] ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'أُرسلت', value: stats?.wa.sent || 0, color: 'text-[#1A2B48]', bg: 'bg-[#FDFBF7]' },
                                    { label: 'استُلمت', value: stats?.wa.delivered || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                    { label: 'قُرأت', value: stats?.wa.read || 0, color: 'text-blue-600', bg: 'bg-blue-50' }
                                ].map((item, i) => (
                                    <div key={i} className={`flex flex-col items-center ${item.bg} p-4 rounded-3xl border border-black/5`}>
                                        <span className={`text-2xl font-black ${item.color}`}>{item.value}</span>
                                        <span className="text-[9px] font-black opacity-60 uppercase mt-1 tracking-widest">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A2B48]/20" />
                            <input 
                                type="text"
                                placeholder="ابحث عن حالة إرسال ضيف..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-16 bg-white border border-[#D4AF37]/20 rounded-2xl pr-14 pl-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                            />
                        </div>

                        {/* WhatsApp List */}
                        <div className="space-y-3">
                            {filteredGuests.map((guest, i) => (
                                <div key={guest.id} className="bg-white p-5 rounded-3xl border border-[#D4AF37]/10 flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-[#FDFBF7] flex items-center justify-center text-[10px] font-black text-[#D4AF37] border border-[#D4AF37]/10">
                                            {String(i + 1).padStart(2, '0')}
                                        </div>
                                        <div>
                                            <p className="font-black text-[#1A2B48] text-sm mb-0.5">{guest.name || 'بطاقة مرقزة'}</p>
                                            <p className="text-[10px] font-bold text-[#1A2B48]/30" dir="ltr">{guest.phone || 'بدون رقم'}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        {guest.last_wa_status === 'read' ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black border border-blue-100">
                                                <Eye className="w-3.5 h-3.5" /> قُرأت 🔵
                                            </div>
                                        ) : guest.last_wa_status === 'delivered' ? (
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                                                <CheckCheck className="w-3.5 h-3.5" /> استُلمت ✅
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1 bg-[#FDFBF7] text-[#D4AF37]/40 rounded-full text-[10px] font-black border border-[#D4AF37]/5">قيد الإرسال</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 3: GUESTS (Attendance Ledger) */}
                {activeTab === 'guests' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1A2B48]/20" />
                            <input 
                                type="text"
                                placeholder="ابحث في كشف الأسماء..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-16 bg-white border border-[#D4AF37]/20 rounded-2xl pr-14 pl-6 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 transition-all shadow-sm"
                            />
                        </div>

                        {/* Attendance List */}
                        <div className="space-y-4">
                            {filteredGuests.length === 0 ? (
                                <div className="py-24 text-center bg-white rounded-[3rem] border border-[#D4AF37]/20">
                                    <Users className="w-16 h-16 text-[#D4AF37]/10 mx-auto mb-4" />
                                    <p className="text-[#1A2B48]/40 font-black px-16 text-sm">لم يتم العثور على نتائج للبحث</p>
                                </div>
                            ) : (
                                filteredGuests.map((guest, i) => (
                                    <div key={guest.id} className="bg-white p-6 rounded-[2.5rem] border border-[#D4AF37]/10 flex items-center justify-between group shadow-sm hover:border-[#D4AF37]/30 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xs font-black border transition-all ${guest.has_entered ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-[#FDFBF7] border-[#D4AF37]/10 text-[#D4AF37]'}`}>
                                                {guest.has_entered ? <CheckCircle className="w-6 h-6" /> : String(i + 1).padStart(2, '0')}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <p className="font-black text-[#1A2B48] text-base">{guest.name || 'بطاقة مرقزة'}</p>
                                                    {guest.companions > 0 && <span className="text-[10px] font-black bg-[#D4AF37]/10 text-[#9A7B4F] px-2 py-0.5 rounded-full">+{guest.companions}</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {guest.rsvp_status === 'confirmed' && <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> أكد الحضور</span>}
                                                    {guest.rsvp_status === 'declined' && <span className="text-[10px] font-black text-red-500 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> اعتذر</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            {guest.has_entered ? (
                                                <div className="px-4 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-black shadow-md shadow-emerald-900/10">تم الدخول 🚪</div>
                                            ) : (
                                                <div className="px-4 py-1.5 bg-[#FDFBF7] text-[#1A2B48]/30 rounded-full text-[10px] font-black border border-[#D4AF37]/10">لم يحضر بعد</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Bottom Brand Bar */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#FDFBF7] to-transparent z-[100]">
                <div className="max-w-xl mx-auto flex items-center justify-center gap-4 py-3 px-8 bg-white/80 backdrop-blur-xl border border-[#D4AF37]/20 rounded-full shadow-xl">
                    <img src="/logo-black.png" className="h-4 opacity-30" alt="Lony" />
                    <div className="w-[1px] h-3 bg-[#D4AF37]/20"></div>
                    <p className="text-[10px] font-black text-[#1A2B48]/30 uppercase tracking-[0.4em]">Secured by Lony Luxury</p>
                </div>
            </div>

        </div>
    );
};

const LayoutDashboard = (props: any) => <Activity {...props} />;

export default ClientDashboard;
