import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Play, Square,
    RefreshCw, Settings,
    Bot, CheckCircle, User, Zap, Clock, Shield,
    Sparkles, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import ConnectionPanel from '../components/WhatsApp/ConnectionPanel';
import GuestTable from '../components/WhatsApp/GuestTable';

const API_URL = config.api.whatsapp;

// --- Sub-Components ---

const StatCard = ({ label, value, sub, color, icon }: any) => {
    const bgMap: any = {
        indigo: 'bg-gradient-to-br from-indigo-50 to-white text-indigo-700 border-indigo-100',
        green: 'bg-gradient-to-br from-emerald-50 to-white text-emerald-700 border-emerald-100',
        purple: 'bg-gradient-to-br from-purple-50 to-white text-purple-700 border-purple-100',
        red: 'bg-gradient-to-br from-rose-50 to-white text-rose-700 border-rose-100',
        gray: 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-100',
        amber: 'bg-gradient-to-br from-amber-50 to-white text-amber-700 border-amber-100',
    };
    return (
        <div className={`p-4 rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md ${bgMap[color] || bgMap.gray} flex flex-col justify-between h-28 group relative overflow-hidden`}>
            <div className="flex justify-between items-start z-10">
                <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{label}</span>
                <div className="p-1.5 rounded-lg bg-white/50 backdrop-blur-sm shadow-sm group-hover:scale-110 transition-transform">
                    {icon}
                </div>
            </div>
            <div className="z-10">
                <div className="text-3xl font-black tracking-tight mt-1">{value}</div>
                {sub && <div className="text-[10px] opacity-80 font-medium mt-1 flex items-center gap-1">{sub}</div>}
            </div>
            {/* Decoration */}
            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12 scale-150 pointer-events-none">
                {icon}
            </div>
        </div>
    );
};

const TemplateVariable = ({ label, value, onClick }: any) => (
    <button
        onClick={() => onClick(value)}
        className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[11px] font-mono border border-indigo-200/50 transition-colors flex items-center gap-1.5 group"
        title="اضغط للإضافة"
    >
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 group-hover:bg-indigo-600 transition-colors"></div>
        <span className="font-bold">{label}</span>
    </button>
);

const SpeedControl = ({ speed, setSpeed }: any) => (
    <div className="flex bg-gray-100 p-1 rounded-lg">
        {['safe', 'balanced', 'fast'].map((s) => (
            <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1.5 text-xs rounded-md font-bold transition-all capitalize flex items-center gap-1 ${speed === s
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
            >
                {s === 'safe' && <Shield className="w-3 h-3" />}
                {s === 'balanced' && <Clock className="w-3 h-3" />}
                {s === 'fast' && <Zap className="w-3 h-3" />}
                <span className="hidden sm:inline">{s}</span>
            </button>
        ))}
    </div>
);

export default function WhatsAppSender() {
    // === STATE ===
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');

    // Guest Data
    const [guests, setGuests] = useState<any[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [rsvpStats, setRsvpStats] = useState({
        total: 0, sent: 0, delivered: 0, read: 0, failed: 0,
        confirmed: 0, declined: 0, maybe: 0
    });

    // Editor & Campaign
    const [messageTemplate, setMessageTemplate] = useState('');
    const [campaignType, setCampaignType] = useState<'invite' | 'qr_code' | 'reminder'>('invite');
    const [sendingSpeed, setSendingSpeed] = useState<'safe' | 'balanced' | 'fast'>('balanced');
    const [useButtons, setUseButtons] = useState(true);
    const [aiGenerating, setAiGenerating] = useState(false);

    // Queue Status
    const [queueStatus, setQueueStatus] = useState<any>({
        isRunning: false, isPaused: false, progress: 0, total: 0
    });
    const [logs, setLogs] = useState<string[]>([]);

    // Refs
    const logContainerRef = useRef<HTMLDivElement>(null);
    const pollingInterval = useRef<any>(null);

    // === INITIALIZATION ===
    useEffect(() => {
        fetchEvents();
        fetchAccounts();
        return () => stopPolling();
    }, []);

    // Scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Update Stats
    useEffect(() => {
        if (guests.length > 0) {
            setRsvpStats({
                total: guests.length,
                sent: guests.filter(g => ['sent', 'delivered', 'read'].includes(g.last_message_status)).length,
                delivered: guests.filter(g => ['delivered', 'read'].includes(g.last_message_status)).length,
                read: guests.filter(g => g.last_message_status === 'read').length,
                failed: guests.filter(g => g.last_message_status === 'failed').length,
                confirmed: guests.filter(g => g.rsvp_status === 'confirmed').length,
                declined: guests.filter(g => g.rsvp_status === 'declined').length,
                maybe: guests.filter(g => g.rsvp_status === 'maybe').length,
            });
        }
    }, [guests]);

    // === DATA FETCHING ===
    const fetchEvents = async () => {
        const { data } = await supabase
            .from('events')
            .select('*')
            //.in('status', ['active', 'upcoming']) // Fetch all for debugging
            .order('created_at', { ascending: false });
        if (data) setEvents(data);
    };

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`${API_URL}/accounts`);
            const data = await res.json();
            if (data.success) {
                setAccounts(data.accounts);
                const connected = data.accounts.filter((a: any) => a.connected);
                if (connected.length > 0) {
                    setSelectedAccountId(prev => prev || connected[0].id);
                }
            }
        } catch (e) { addLog('❌ Failed to fetch accounts'); }
    };

    const fetchGuests = async (eventId: string) => {
        setLoadingGuests(true);
        const { data: guestsData, error } = await supabase
            .from('guests')
            .select(`
                id, name, phone, rsvp_status, rsvp_at,
                whatsapp_messages (
                    status, message_phase, created_at
                )
            `)
            .eq('event_id', eventId)
            .order('name');

        if (error) {
            addLog(`Error: ${error.message}`);
            setLoadingGuests(false);
            return;
        }

        const processed = guestsData.map(g => {
            const msgs = g.whatsapp_messages || [];
            msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const latest = msgs[0];
            return {
                ...g,
                last_message_status: latest?.status || 'pending',
                last_message_phase: latest?.message_phase,
                last_interaction: latest?.created_at
            };
        });

        setGuests(processed);
        setLoadingGuests(false);
    };

    const handleOverrideStatus = async (guest: any, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('guests')
                .update({ rsvp_status: newStatus })
                .eq('id', guest.id);

            if (error) throw error;

            // Update local state immediately
            setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, rsvp_status: newStatus } : g));
            addLog(`✅ تم تخطي وتحديث حالة ${guest.name} يدوياً إلى: ${newStatus}`);
        } catch (e: any) {
            alert('فشل في تحديث الحالة: ' + e.message);
        }
    };

    // === ACTIONS ===
    const handleGenerateAI = async () => {
        if (!selectedEventId) return alert("اختر مناسبة أولاً");
        setAiGenerating(true);

        try {
            const event = events.find(e => e.id === selectedEventId);

            const res = await fetch(`${API_URL}/generate-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    context: messageTemplate, // Send current text as context for polishing
                    tone: 'formal'
                })
            });

            const data = await res.json();
            if (data.success) {
                setMessageTemplate(data.message);
                addLog("✨ AI generated a new template!");
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            addLog(`❌ AI Generation Failed: ${e.message}`);
            alert("فشل التوليد: " + e.message);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleStartQueue = async () => {
        if (!selectedEventId) return alert('الرجاء اختيار المناسبة');
        if (!messageTemplate.trim()) return alert('الرسالة فارغة');

        addLog('⏳ Preparing campaign...');
        try {
            // 1. Prepare
            const prepRes = await fetch(`${API_URL}/prepare-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    template: messageTemplate,
                    messagePhase: campaignType, // sent as 'invite' or 'qr_code'
                    filters: { rsvp_status: campaignType === 'qr_code' ? 'confirmed' : 'all' }
                })
            });
            const prep = await prepRes.json();
            if (!prep.success) throw new Error(prep.error);

            if (prep.count === 0) return alert('لا يوجد ضيوف مستهدفين بهذه الحملة.');

            if (!confirm(`سيتم إرسال ${prep.count} رسالة (${campaignType === 'qr_code' ? 'كروت باركود' : 'دعوات عامة'}).\nالسرعة: ${sendingSpeed}`)) return;

            // 2. Start
            const startRes = await fetch(`${API_URL}/send-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    mode: sendingSpeed, // 'fast', 'balanced', 'safe'
                    useButtons: useButtons,
                    accountId: selectedAccountId
                })
            });

            if (startRes.ok) {
                setQueueStatus((p: any) => ({ ...p, isRunning: true }));
                startPolling(selectedEventId);
            }

        } catch (e: any) {
            alert(e.message);
        }
    };

    // Polling Logic
    const startPolling = (eventId: string) => {
        stopPolling();
        pollingInterval.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/status/${eventId}`);
                const data = await res.json();
                if (data.success && data.status) {
                    setQueueStatus((prev: any) => ({
                        ...prev,
                        isRunning: data.status.isRunning,
                        isPaused: data.status.isPaused,
                        processed: (data.status.stats?.sent || 0) + (data.status.stats?.failed || 0),
                        total: (data.status.stats?.pending || 0) + (data.status.stats?.queued || 0) + (data.status.stats?.sent || 0) + (data.status.stats?.failed || 0)
                    }));

                    if (data.status.lastLog) {
                        setLogs(prev => {
                            const last = prev[prev.length - 1];
                            // Avoid duplicates but show new
                            if (last !== data.status.lastLog && !last?.includes(data.status.lastLog)) {
                                return [...prev.slice(-99), `[SERVER] ${data.status.lastLog}`];
                            }
                            return prev;
                        });
                    }

                    if (data.status.isRunning) fetchGuests(eventId);
                }
            } catch (e) { }
        }, 2000);
    };

    const stopPolling = () => { if (pollingInterval.current) clearInterval(pollingInterval.current); };

    // Other handlers
    const handleEventSelect = (e: any) => {
        setSelectedEventId(e.target.value);
        if (e.target.value) { fetchGuests(e.target.value); startPolling(e.target.value); }
        else { setGuests([]); stopPolling(); }
    };
    const addLog = (m: string) => setLogs(p => [...p.slice(-99), `[${new Date().toLocaleTimeString()}] ${m}`]);


    // === RESPONSIVE LAYOUT HELPERS ===
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // === RENDER ===
    return (
        <div className="flex bg-slate-50 h-screen w-full overflow-hidden text-right font-sans" dir="rtl">

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* --- SIDEBAR --- */}
            <div className={`
                fixed lg:static inset-y-0 right-0 z-40
                w-72 bg-white border-l border-gray-200 shadow-2xl lg:shadow-none
                transform transition-transform duration-300 ease-in-out flex flex-col
                ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <Settings className="w-5 h-5 text-indigo-600" />
                        إعدادات الحملة
                    </h2>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Square className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Event Selector */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">المناسبة</label>
                        <select
                            value={selectedEventId}
                            onChange={handleEventSelect}
                            className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700 shadow-sm"
                        >
                            <option value="">-- اختر المناسبة --</option>
                            {events.map(e => <option key={e.id} value={e.id}>🎉 {e.name}</option>)}
                        </select>

                        {/* Event Details Summary */}
                        {(() => {
                            const selectedEvent = events.find(e => e.id === selectedEventId);
                            if (!selectedEventId || !selectedEvent) return null;

                            return (
                                <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs space-y-1">
                                    <div className="flex items-center gap-2 text-indigo-900 font-bold">
                                        <span className="text-lg">📅</span>
                                        {selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString('ar-SA') : 'غير محدد'}
                                    </div>
                                    <div className="flex items-center gap-2 text-indigo-800">
                                        <span className="text-lg">📍</span> {selectedEvent.location || 'غير محدد'}
                                    </div>
                                    <div className="text-[10px] text-indigo-400 font-mono mt-1 pt-1 border-t border-indigo-100">
                                        ID: {selectedEvent.id?.slice(0, 8)}...
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="w-full h-px bg-gray-100" />

                    {/* Campaign Type */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">نوع الحملة</label>
                        <div className="space-y-2">
                            <button
                                onClick={() => setCampaignType('invite')}
                                className={`w-full p-3 rounded-lg border text-right transition-all flex items-center gap-3 ${campaignType === 'invite' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-full ${campaignType === 'invite' ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <Send className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-gray-800">دعوة عامة</div>
                                    <div className="text-[10px] text-gray-500">نص + صورة (لكل القائمة)</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setCampaignType('qr_code')}
                                className={`w-full p-3 rounded-lg border text-right transition-all flex items-center gap-3 ${campaignType === 'qr_code' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-full ${campaignType === 'qr_code' ? 'bg-purple-200 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-gray-800">إرسال كروت الباركود</div>
                                    <div className="text-[10px] text-gray-500">فقط للمؤكدين (Confirmed)</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-100" />

                    {/* Sender Account Selection */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">حساب الإرسال</label>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700 shadow-sm"
                        >
                            <option value="">-- الجوال الافتراضي --</option>
                            {accounts.filter(a => a.connected).map(a => (
                                <option key={a.id} value={a.id}>📱 {a.name || a.phone}</option>
                            ))}
                        </select>
                        <div className="mt-2 text-[10px] text-gray-500">
                            اختر الرقم الذي سيتم إرسال الحملة منه.
                        </div>
                    </div>

                    <div className="w-full h-px bg-gray-100" />

                    {/* Devices */}
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">الأجهزة المتصلة</label>
                        <ConnectionPanel accounts={accounts} onAccountsChange={fetchAccounts} addLog={addLog} />
                    </div>

                </div>
            </div>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                {/* Mobile Header Toggle */}
                <div className="lg:hidden bg-white border-b p-4 flex justify-between items-center shrink-0">
                    <h1 className="font-bold text-gray-800">إدارة الحملات</h1>
                    <button onClick={() => setSidebarOpen(true)} className="p-2 bg-gray-100 rounded-lg text-gray-600">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6 scroll-smooth">
                    <div className="max-w-[1600px] mx-auto space-y-6">

                        {/* Top Header & Stats */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div>
                                    <h1 className="text-2xl font-black text-slate-800 mb-1">لوحة التحكم</h1>
                                    <p className="text-sm text-slate-500 font-medium">إدارة الحملات والردود الذكية</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => selectedEventId && fetchGuests(selectedEventId)}>
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingGuests ? 'animate-spin' : ''}`} /> تحديث البيانات
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                <StatCard label="المجموع" value={rsvpStats.total} color="gray" icon={<User className="w-4 h-4" />} />
                                <StatCard label="تم الإرسال" value={rsvpStats.sent} color="indigo" icon={<Send className="w-4 h-4" />} />
                                <StatCard label="تم الاستلام" value={rsvpStats.delivered} color="green" icon={<CheckCircle className="w-4 h-4" />} />
                                <StatCard label="تأكيد حضور" value={rsvpStats.confirmed} color="purple" icon={<span className="text-sm">✨</span>} />
                                <StatCard label="اعتذارات" value={rsvpStats.declined} color="red" icon={<span className="text-sm">❌</span>} />
                                <StatCard label="ربما" value={rsvpStats.maybe} color="amber" icon={<span className="text-sm">🤔</span>} />
                            </div>
                        </div>

                        {/* Two Column Layout: Table vs Editor */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-20">

                            {/* Left: Guest Table (Takes more space) */}
                            <div className="xl:col-span-7 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px] xl:h-[calc(100vh-350px)] min-h-[500px]">
                                <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        قائمة الضيوف
                                    </h3>
                                    <div className="flex gap-2 text-[10px] text-gray-500 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                                        <span className="font-bold text-gray-700">العدد: {guests.length}</span>
                                        <span className="text-gray-300">|</span>
                                        <span className="text-green-600 font-bold">المؤكدين: {rsvpStats.confirmed}</span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden relative">
                                    <div className="absolute inset-0">
                                        <GuestTable guests={guests} onRetry={() => { }} onOverrideStatus={handleOverrideStatus} />
                                    </div>
                                </div>
                            </div>

                            {/* Right: Smart Editor (Sticky on large screens) */}
                            <div className="xl:col-span-5 flex flex-col gap-4">
                                {!selectedEventId ? (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center h-[400px]">
                                        <Bot className="w-16 h-16 mb-4 opacity-10" />
                                        <h3 className="font-bold text-lg text-gray-600 mb-2">اختر مناسبة للبدء</h3>
                                        <p className="text-sm text-gray-400 max-w-[200px] leading-relaxed">
                                            قم باختيار المناسبة من القائمة الجانبية لتفعيل المحرر الذكي وإطلاق الحملات.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Editor Card */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                                            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Bot className="w-5 h-5 text-indigo-600" />
                                                    <span className="font-bold text-gray-800 text-sm">المحرر الذكي</span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleGenerateAI}
                                                    disabled={aiGenerating}
                                                    className="h-8 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3"
                                                >
                                                    <Sparkles className={`w-3 h-3 mr-1.5 ${aiGenerating ? 'animate-spin' : ''}`} />
                                                    {aiGenerating ? 'جاري الصياغة...' : 'توليد AI'}
                                                </Button>
                                            </div>

                                            <div className="p-4 flex flex-col gap-4">
                                                {/* Variables */}
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block tracking-wider">متغيرات ذكية</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        <TemplateVariable label="اسم الضيف" value="{{name}}" onClick={(v: string) => setMessageTemplate(p => p + v)} />
                                                        <TemplateVariable label="الموقع" value="{{location}}" onClick={(v: string) => setMessageTemplate(p => p + v)} />
                                                        <TemplateVariable label="رابط الباركود" value="{{qr_link}}" onClick={(v: string) => setMessageTemplate(p => p + v)} />
                                                    </div>
                                                </div>

                                                {/* Textarea */}
                                                <div className="relative group min-h-[300px] xl:min-h-[250px]">
                                                    <textarea
                                                        value={messageTemplate}
                                                        onChange={e => setMessageTemplate(e.target.value)}
                                                        className="w-full h-full p-4 bg-gray-50/50 border-2 border-dashed border-gray-200 focus:border-solid focus:border-indigo-500 focus:bg-white rounded-xl resize-none transition-all text-sm leading-relaxed outline-none"
                                                        placeholder="اكتب رسالتك هنا... استخدم المتغيرات أعلاه لتخصيص الرسالة."
                                                        style={{ height: '100%', minHeight: '200px' }}
                                                    />
                                                    <div className="absolute bottom-3 left-3 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded backdrop-blur border border-gray-100">
                                                        {messageTemplate.length} حرف
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sending Settings */}
                                            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-bold text-gray-600">سرعة الإرسال</label>
                                                    <SpeedControl speed={sendingSpeed} setSpeed={setSendingSpeed} />
                                                </div>

                                                <div className="flex justify-between items-center py-2 border-t border-gray-100/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-gray-700">استخدام الأزرار التفاعلية</span>
                                                        <span className="text-[10px] text-gray-400">✅ تأكيد / ❌ اعتذار</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setUseButtons(!useButtons)}
                                                        className={`w-12 h-6 rounded-full transition-colors relative ${useButtons ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${useButtons ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>

                                                {/* Action Buttons */}
                                                {!queueStatus.isRunning ? (
                                                    <Button
                                                        onClick={handleStartQueue}
                                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 text-sm font-bold flex justify-center items-center gap-2 rounded-xl"
                                                    >
                                                        <Send className="w-5 h-5" />
                                                        إرسال الحملة الآن
                                                    </Button>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm">
                                                            <div className="flex justify-between text-xs font-bold text-indigo-900 mb-2">
                                                                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> جاري الإرسال...</span>
                                                                <span>{queueStatus.processed} / {queueStatus.total}</span>
                                                            </div>
                                                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${(queueStatus.processed / (queueStatus.total || 1)) * 100}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300" onClick={async () => {
                                                                await fetch(`${API_URL}/stop`, { method: 'POST' });
                                                                setQueueStatus((p: any) => ({ ...p, isRunning: false }));
                                                            }}>إيقاف كلي</Button>
                                                            <Button size="sm" variant="outline" className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-100" onClick={async () => {
                                                                const ep = queueStatus.isPaused ? 'resume' : 'pause';
                                                                await fetch(`${API_URL}/${ep}`, { method: 'POST' });
                                                                setQueueStatus((p: any) => ({ ...p, isPaused: !p.isPaused }));
                                                            }}>{queueStatus.isPaused ? 'استئناف' : 'إيقاف مؤقت'}</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Logs */}
                                        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl flex flex-col border border-slate-800">
                                            <div className="px-4 py-2 bg-slate-950 text-[10px] text-slate-400 font-mono flex justify-between items-center border-b border-slate-800">
                                                <span className="font-bold flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                    Console Output
                                                </span>
                                            </div>
                                            <div ref={logContainerRef} className="h-40 xl:h-48 overflow-y-auto p-4 text-[10px] font-mono space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                                {logs.length === 0 && <span className="text-slate-600 italic opacity-50 block text-center mt-10">System ready... No activity yet.</span>}
                                                {logs.map((l, i) => (
                                                    <div key={i} className="text-emerald-400 border-l-2 border-slate-700 pl-3 leading-relaxed opacity-90 hover:opacity-100 transition-opacity break-words">
                                                        <span className="text-slate-600 mr-2">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                                                        {l}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
