import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle, User, RefreshCw, Send, Loader2, RotateCcw,
    AlertTriangle, Mail, MailCheck, Eye, Bot, Sparkles,
    Variable, Palette, Layout, Settings, Share2, Copy,
    Zap, Clock, Shield, Upload, Trash2, Image as ImageIcon,
    Play, Square, LayoutPanelTop, Scan, Download
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import ConnectionPanel from '../components/WhatsApp/ConnectionPanel';
import GuestTable from '../components/WhatsApp/GuestTable';
import * as XLSX from 'xlsx';

const API_URL = config.api.whatsapp;

// --- Sub-Components ---
const StatCard = ({ label, value, color, icon }: any) => {
    const bgMap: any = {
        indigo: 'bg-gradient-to-br from-indigo-50 to-white text-indigo-700 border-indigo-100',
        green: 'bg-gradient-to-br from-emerald-50 to-white text-emerald-700 border-emerald-100',
        purple: 'bg-gradient-to-br from-purple-50 to-white text-purple-700 border-purple-100',
        red: 'bg-gradient-to-br from-rose-50 to-white text-rose-700 border-rose-100',
        gray: 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-100',
        amber: 'bg-gradient-to-br from-amber-50 to-white text-amber-700 border-amber-100',
    };
    return (
        <div className={`p-5 rounded-[1.5rem] border shadow-sm transition-all duration-300 hover:shadow-md ${bgMap[color] || bgMap.gray} flex flex-col justify-between h-32 group relative overflow-hidden`}>
            <div className="flex justify-between items-start z-10">
                <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{label}</span>
                <div className="p-2 rounded-xl bg-white/60 backdrop-blur-md shadow-sm group-hover:scale-110 transition-transform">
                    {icon}
                </div>
            </div>
            <div className="z-10 mt-auto">
                <div className="text-3xl font-black tracking-tight">{value}</div>
            </div>
            <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12 scale-[2] pointer-events-none group-hover:rotate-0 transition-transform duration-700">
                {icon}
            </div>
        </div>
    );
};

export default function WhatsAppSender() {
    // === STATE ===
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [groomName, setGroomName] = useState('مشاري');
    const [brideName, setBrideName] = useState('رهف');
    const [gateway, setGateway] = useState<'meta' | 'evolution'>('meta');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateName, setSelectedTemplateName] = useState('lony');
    const [dayUsage, setDayUsage] = useState(0);

    const [guests, setGuests] = useState<any[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [rsvpStats, setRsvpStats] = useState({
        total: 0, sent: 0, delivered: 0, read: 0, failed: 0,
        confirmed: 0, declined: 0, maybe: 0, entered: 0
    });

    const [isSending, setIsSending] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [shouldStop, setShouldStop] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    const [totalBatches, setTotalBatches] = useState(0);

    const [messageTemplate, setMessageTemplate] = useState('');
    const [globalImageUrl, setGlobalImageUrl] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [campaignType, setCampaignType] = useState<'invite' | 'qr_code'>('invite');
    const [targetAudience, setTargetAudience] = useState<'all' | 'unsent' | 'replacements'>('all');
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [guestFilter, setGuestFilter] = useState<'all' | 'failed' | 'delivered' | 'read' | 'confirmed' | 'declined' | 'entered'>('all');
    
    const isPausedRef = useRef(false);
    const shouldStopRef = useRef(false);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Synchronize refs with state for loop access
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { shouldStopRef.current = shouldStop; }, [shouldStop]);

    // === INITIALIZATION ===
    useEffect(() => {
        fetchEvents();
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (events.length > 0 && selectedEventId) {
            const ev = events.find(x => x.id === selectedEventId);
            if (ev) {
                setGlobalImageUrl(ev.settings?.global_invite_image_url || '');
                setGroomName(ev.settings?.groom_name || 'مشاري');
                setBrideName(ev.settings?.bride_name || 'رهف');
                setOwnerPhone(ev.owner_phone || '');
            }
        }
    }, [events, selectedEventId]);

    // ... (keep fetchEvents, fetchAccounts, fetchTemplates, fetchGuests, addLog as they were or slightly improved)

    const handleUpdateSettings = async () => {
        if (!selectedEventId) return;
        const ev = events.find(x => x.id === selectedEventId);
        const settings = { ...(ev?.settings || {}), groom_name: groomName, bride_name: brideName };
        const { error } = await supabase.from('events').update({ 
            settings,
            owner_phone: ownerPhone 
        }).eq('id', selectedEventId);
        
        if (error) addLog(`❌ فشل التحديث: ${error.message}`);
        else {
            addLog("✅ تم تحديث بيانات المنصة والمناسبة");
            fetchEvents();
        }
    };

    const handleStartQueue = async () => {
        if (!selectedEventId) return alert('الرجاء اختيار المناسبة');
        
        let targetGuests = [];
        if (targetAudience === 'replacements') {
            targetGuests = guests.filter(g => !g.whatsapp_messages?.some((m:any) => m.message_phase === 'invitation'));
        } else if (campaignType === 'qr_code') {
            targetGuests = guests.filter(g => g.rsvp_status === 'confirmed' && !g.card_sent);
        } else {
            targetGuests = guests;
        }

        if (targetGuests.length === 0) return alert('لا يوجد ضيوف مستهدفين حالياً');
        if (!window.confirm(`بدء إرسال ${targetGuests.length} رسالة؟`)) return;

        setIsSending(true);
        setIsPaused(false);
        setShouldStop(false);
        setProgress(0);
        addLog(`🚀 إطلاق الحملة... الإجمالي: ${targetGuests.length}`);

        const CHUNK_SIZE = 10;
        const batches = [];
        for (let i = 0; i < targetGuests.length; i += CHUNK_SIZE) {
            batches.push(targetGuests.slice(i, i + CHUNK_SIZE));
        }
        setTotalBatches(batches.length);

        for (let i = 0; i < batches.length; i++) {
            // Check for Stop signal
            if (shouldStopRef.current) {
                addLog("🛑 تم إيقاف الحملة من قبل المستخدم");
                break;
            }

            // Check for Pause signal
            while (isPausedRef.current) {
                await new Promise(r => setTimeout(r, 1000));
                if (shouldStopRef.current) break;
            }
            if (shouldStopRef.current) break;

            setCurrentBatchIndex(i + 1);
            const chunk = batches[i];
            addLog(`⏳ إرسال الدفعة ${i + 1} من ${batches.length}...`);

            try {
                const res = await fetch('/.netlify/functions/send-final', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guestIds: chunk.map(g => g.id),
                        eventId: selectedEventId,
                        campaignType: campaignType
                    })
                });
                const data = await res.json();
                
                if (res.ok) {
                    addLog(`✅ اكتملت الدفعة ${i+1}`);
                    setProgress(Math.round(((i + 1) / batches.length) * 100));
                }
            } catch (e:any) {
                addLog(`⚠️ خطأ في الدفعة ${i+1}: ${e.message}`);
            }

            await new Promise(r => setTimeout(r, 1000)); // Rate limiting safety
        }

        setIsSending(false);
        addLog("🏁 اكتملت المهمة بالكامل");
        fetchGuests(selectedEventId);
    };

    return (
        <div className="flex bg-slate-50 h-screen w-full overflow-hidden text-right font-sans" dir="rtl">
            {/* Sidebar Controls */}
            <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">
                <div className="p-6 border-b bg-gradient-to-b from-indigo-50/50 to-white">
                    <div className="flex items-center gap-2 mb-6">
                        <Play className="w-6 h-6 text-indigo-600" />
                        <h2 className="font-black text-slate-800 text-lg">بوابة التحكم الاحترافية</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-3">
                            <label className="text-[10px] font-black text-indigo-400 uppercase block tracking-widest">صورة الدعوة العامة</label>
                            {globalImageUrl ? (
                                <div className="relative group rounded-xl overflow-hidden border border-slate-100 aspect-video">
                                    <img src={globalImageUrl} className="w-full h-full object-cover" />
                                    <button onClick={handleRemoveImage} className="absolute inset-0 bg-rose-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 font-black text-xs">
                                        <Trash2 className="w-4 h-4" /> إزالة الصورة
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors">
                                    <Upload className="w-6 h-6 text-slate-300 mb-2" />
                                    <span className="text-[10px] text-slate-400 font-bold">{isUploading ? 'جاري الرفع...' : 'اضغط للرفع'}</span>
                                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                                </label>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase block tracking-widest">إعدادات المناسبة</label>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] text-slate-400 block mb-1">اسم العريس</label>
                                    <input value={groomName} onChange={e=>setGroomName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-400 block mb-1">اسم العروس</label>
                                    <input value={brideName} onChange={e=>setBrideName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                                </div>
                                <div>
                                    <label className="text-[9px] text-indigo-400 block mb-1 font-black">رقم صاحب المناسبة (للتقارير)</label>
                                    <input value={ownerPhone} onChange={e=>setOwnerPhone(e.target.value)} placeholder="966..." className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 ring-indigo-500/20" />
                                </div>
                                <Button onClick={handleUpdateSettings} className="w-full bg-indigo-600 text-white h-9 rounded-xl font-black text-[10px]">حفظ التعديلات</Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">الفئة المستهدفة</label>
                        <select value={targetAudience} onChange={(e:any)=>setTargetAudience(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 ring-indigo-500/20">
                            <option value="all">كل الضيوف</option>
                            <option value="replacements">المستبدلين فقط 🆕</option>
                            <option value="unsent">الذين لم يستلموا بعد</option>
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">مرحلة الرسالة</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={()=>setCampaignType('invite')} className={`py-3 rounded-xl border text-[10px] font-black transition-all ${campaignType==='invite'?'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100':'bg-white text-slate-500'}`}>الدعوات</button>
                            <button onClick={()=>setCampaignType('qr_code')} className={`py-3 rounded-xl border text-[10px] font-black transition-all ${campaignType==='qr_code'?'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100':'bg-white text-slate-500'}`}>الكروت</button>
                        </div>
                    </div>

                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                        <label className="text-[10px] font-black text-emerald-600 uppercase block tracking-widest flex items-center gap-2"><Bot className="w-3 h-3"/> أتمتة الردود الذكية</label>
                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                            <span>إرسال الباركود آلياً عند التأكيد</span>
                            <div className="w-8 h-4 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المناسبة الحالية</label>
                            <select value={selectedEventId} onChange={handleEventSelect} className="bg-transparent border-none p-0 text-lg font-black text-slate-800 outline-none focus:ring-0 cursor-pointer">
                                <option value="">اختر مناسبة لبدء العمل..</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {isSending && (
                        <div className="flex items-center gap-6 px-6 py-2 bg-slate-900 rounded-2xl text-white shadow-2xl">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest text-left">CAMPAIGN_PROGRESS</span>
                                <span className="text-xs font-black">{progress}% - دفعة {currentBatchIndex} من {totalBatches}</span>
                            </div>
                            <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsPaused(!isPaused)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                                    {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
                                </button>
                                <button onClick={() => setShouldStop(true)} className="p-1.5 bg-rose-900/40 hover:bg-rose-600 rounded-lg transition-colors">
                                    <Square className="w-4 h-4 text-rose-500" />
                                </button>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleExportExcel} className="bg-emerald-600 text-white rounded-xl text-[10px] font-black px-6 h-10 hover:shadow-lg shadow-emerald-100 flex items-center gap-2">
                        <Download className="w-4 h-4" /> تقرير EXCEL
                    </Button>
                </header>

                <main className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10">
                    {/* Progress Monitor (Top) */}
                    {isSending && (
                        <div className="bg-white p-8 rounded-[2rem] border-2 border-indigo-600/10 shadow-xl shadow-indigo-100/20 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 h-1 bg-indigo-600 transition-all duration-1000" style={{ width: `${progress}%` }} />
                           <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center relative overflow-hidden">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin z-10" />
                                        <div className="absolute inset-x-0 bottom-0 bg-indigo-100 transition-all duration-500" style={{ height: `${progress}%` }} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">جاري معالجة الحملة...</h3>
                                        <p className="text-xs text-slate-400 font-bold">يرجى عدم إغلاق الصفحة لضمان استمرارية الإرسال</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="text-center bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-black block mb-1 uppercase uppercase tracking-tighter">SENT_COUNT</span>
                                        <span className="text-xl font-black text-slate-800">{currentBatchIndex * 10}</span>
                                    </div>
                                    <div className="text-center bg-indigo-600 px-8 py-3 rounded-2xl text-white shadow-xl shadow-indigo-100">
                                        <span className="text-[10px] opacity-60 font-black block mb-1 uppercase tracking-tighter">OVERALL_PROGRESS</span>
                                        <span className="text-xl font-black">{progress}%</span>
                                    </div>
                                </div>
                           </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        <StatCard label="الضيوف" value={rsvpStats.total} color="gray" icon={<User className="w-5 h-5" />} />
                        <StatCard label="تأكيد RSVP" value={rsvpStats.confirmed} color="purple" icon={<CheckCircle className="w-5 h-5" />} />
                        <StatCard label="تم الإرسال" value={rsvpStats.sent} color="indigo" icon={<Send className="w-5 h-5" />} />
                        <StatCard label="وصلت (Delivered)" value={rsvpStats.delivered} color="green" icon={<MailCheck className="w-5 h-5" />} />
                        <StatCard label="تمت القراءة" value={rsvpStats.read} color="amber" icon={<Eye className="w-5 h-5" />} />
                        <StatCard label="فشل الإرسال" value={rsvpStats.failed} color="red" icon={<AlertTriangle className="w-5 h-5" />} />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-[800px] pb-20">
                        {/* Control & Logs (4 cols) */}
                        <div className="xl:col-span-4 flex flex-col gap-6">
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                                <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Zap className="w-5 h-5 text-indigo-600" />
                                        <span className="font-black text-slate-800">إطلاق الحملة</span>
                                    </div>
                                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">{campaignType==='invite'?'INVITATION_PHASE':'QR_CARDS_PHASE'}</span>
                                </div>
                                <div className="p-8 space-y-8 flex-1">
                                    <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">مخطط المتغيرات (Template Map)</label>
                                        <div className="space-y-2">
                                            {[
                                                ['{{1}}', 'اسم الضيف'],
                                                ['{{2}}', 'اسم العريس'],
                                                ['{{3}}', 'اسم العروس'],
                                                ['{{4}}', 'تاريخ المناسبة'],
                                                ['{{5}}', 'موقع القاعة']
                                            ].map(([k,v], i) => (
                                                <div key={i} className="flex justify-between items-center text-[11px] font-bold text-slate-600 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                                                    <span>{v}</span>
                                                    <span className="font-mono text-indigo-600">{k}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {!isSending ? (
                                        <Button 
                                            onClick={handleStartQueue} 
                                            disabled={loadingGuests || !selectedEventId}
                                            className="w-full h-24 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
                                        >
                                            <Send className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                            <span className="text-xl font-black">إطلاق الدعوات الآن</span>
                                            <span className="text-[9px] font-bold opacity-60 italic">سيتم الإرسال لعدد {guests.length} ضيف</span>
                                        </Button>
                                    ) : (
                                        <div className="flex gap-4">
                                            <Button onClick={() => setIsPaused(!isPaused)} className={`flex-1 h-16 rounded-2xl font-black transition-all ${isPaused ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                {isPaused ? 'استئناف ▶️' : 'إيقاف مؤقت ⏸️'}
                                            </Button>
                                            <Button onClick={() => setShouldStop(true)} className="flex-1 h-16 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black">إيقاف كلي 🛑</Button>
                                        </div>
                                    )}
                                </div>

                                {/* Live Terminal */}
                                <div className="h-64 bg-slate-950 font-mono text-[10px] p-6 text-emerald-400 overflow-y-auto border-t border-slate-900 border-r-[8px] border-r-indigo-900/40">
                                    <div className="sticky top-0 bg-slate-950/90 pb-2 mb-3 border-b border-indigo-900/40 flex justify-between uppercase font-black tracking-widest text-[#555]">
                                        <span>SYSTEM_LOG</span>
                                        <span className="text-emerald-500 animate-pulse">● LIVE</span>
                                    </div>
                                    <div className="space-y-1.5 opacity-80">
                                        {logs.map((l, i) => <div key={i} className="flex gap-2"><span className="text-slate-700">{i+1}.</span><span>{l}</span></div>)}
                                        {logs.length === 0 && <div className="text-slate-800 text-center py-10">بانتظار بدء العمليات...</div>}
                                    </div>
                                    <div ref={logContainerRef} />
                                </div>
                            </div>
                        </div>

                        {/* Guest Table (8 cols) */}
                        <div className="xl:col-span-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-indigo-100 rounded-xl"><User className="w-5 h-5 text-indigo-600" /></div>
                                    <h3 className="text-xl font-black text-slate-800">تتبع الضيوف لحظياً</h3>
                                </div>
                                <div className="flex bg-white rounded-xl border p-1 shadow-sm gap-1">
                                    {['all', 'confirmed', 'declined', 'failed'].map(f => (
                                        <button key={f} onClick={() => setGuestFilter(f as any)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${guestFilter===f?'bg-slate-900 text-white shadow-xl':'text-slate-400'}`}>
                                            {f === 'all' ? 'الكل' : f === 'confirmed' ? 'تأكيد' : f === 'declined' ? 'اعتذار' : 'فشل'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                <GuestTable 
                                    guests={guests.filter(g => {
                                        if (guestFilter === 'failed') return g.last_message_status === 'failed';
                                        if (guestFilter === 'confirmed') return g.rsvp_status === 'confirmed';
                                        if (guestFilter === 'declined') return g.rsvp_status === 'declined';
                                        return true;
                                    })} 
                                    onRetry={handleDirectSend}
                                    onDirectSend={handleDirectSend}
                                    onOverrideStatus={handleOverrideStatus}
                                    onEditPhone={handleEditPhone}
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
