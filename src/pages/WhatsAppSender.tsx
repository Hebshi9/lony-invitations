import React, { useState, useEffect, useRef } from 'react';
import {
    CheckCircle, User, RefreshCw, Send, Loader2, RotateCcw,
    AlertTriangle, Mail, MailCheck, Eye, Bot, Sparkles,
    Variable, Palette, Layout, Settings, Share2, Copy,
    Zap, Clock, Shield, Upload, Trash2, Image as ImageIcon,
    Play, Square
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
    const [globalImageUrl, setGlobalImageUrl] = useState(''); // New: Global Invite Image
    const [autoFollowup, setAutoFollowup] = useState(true); // New: Toggle for automated card delivery
    const [clientPhone, setClientPhone] = useState(''); // Owner's WhatsApp for RSVP notifications
    const [isDirectSend, setIsDirectSend] = useState(false); // New: Direct Send status
    const [campaignType, setCampaignType] = useState<'invite' | 'qr_code' | 'reminder'>('invite');
    const [sendingSpeed, setSendingSpeed] = useState<'safe' | 'balanced' | 'fast'>('balanced');
    const [useButtons, setUseButtons] = useState(true);
    const [aiGenerating, setAiGenerating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false); // Locking logic

    // Campaign Configuration
    const [chunkSize, setChunkSize] = useState<number>(20);
    const [restDelayMinutes, setRestDelayMinutes] = useState<number>(5);
    const [targetAudience, setTargetAudience] = useState<'all' | 'unsent' | 'replacements' | 'specific'>('all');
    const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);

    // Queue Status
    const [queueStatus, setQueueStatus] = useState<any>({
        isRunning: false, isPaused: false, isResting: false, nextBatchAt: null, progress: 0, total: 0
    });
    const [logs, setLogs] = useState<string[]>([]);

    // Delivery tracking
    const [deliveryStats, setDeliveryStats] = useState({ sent: 0, delivered: 0, read: 0, failed: 0, total: 0 });
    const [retrying, setRetrying] = useState(false);

    // Demo State
    const [activeTab, setActiveTab] = useState<'campaign' | 'demo'>('campaign');
    const [demoPhones, setDemoPhones] = useState('');
    const [demoImageUrl, setDemoImageUrl] = useState('');
    const [demoSending, setDemoSending] = useState(false);

    // Guest Filters
    const [guestFilter, setGuestFilter] = useState<'all' | 'failed' | 'pending' | 'delivered'>('all');

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
                    status, delivery_status, message_phase, created_at
                )
            `)
            .eq('event_id', eventId)
            .order('name');

        if (error) {
            addLog(`Error: ${error.message}`);
            setLoadingGuests(false);
            return;
        }

        const processed = guestsData
            .filter(g => {
                const name = (g.name || '').toLowerCase();
                const phone = (g.phone || '');
                const isSample = name.includes('عينة') || name.includes('sample') || phone.includes('000000');
                return !isSample;
            })
            .map(g => {
                const msgs = g.whatsapp_messages || [];
                msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const latest = msgs[0];
                return {
                    ...g,
                    last_message_status: latest?.status || 'pending',
                    delivery_status: latest?.delivery_status || null,
                    last_message_phase: latest?.message_phase,
                    last_interaction: latest?.created_at
                };
            });

        setGuests(processed);

        // Fetch delivery stats
        try {
            const dsRes = await fetch(`${API_URL}/delivery-stats/${eventId}`);
            const dsData = await dsRes.json();
            if (dsData.success) setDeliveryStats(dsData.stats);
        } catch (e) { /* ignore */ }

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

    const handleEditPhone = async (guest: any, newPhone: string) => {
        try {
            const { error } = await supabase
                .from('guests')
                .update({ phone: newPhone || null })
                .eq('id', guest.id);

            if (error) throw error;
            setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, phone: newPhone || null } : g));
            addLog(`✅ تم تعديل رقم الضيف ${guest.name} بنجاح`);
        } catch (e: any) {
            alert('فشل في تعديل الرقم: ' + e.message);
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
                    tone: 'formal',
                    imageUrl: globalImageUrl // Pass image for Vision analysis
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
        if (isPreparing) return alert('جاري تحضير الرسائل... الرجاء الانتظار');

        setIsPreparing(true);
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
                    targetAudience: targetAudience, // New smart targeting
                    guestIds: selectedGuestIds, // For precise targeting
                    filters: { rsvp_status: campaignType === 'qr_code' ? 'confirmed' : 'all' },
                    globalImageUrl: globalImageUrl || null // Pass global image override
                })
            });
            const prep = await prepRes.json();
            if (!prep.success) throw new Error(prep.error || 'Unknown error');

            if (prep.count === 0) {
                setIsPreparing(false);
                return alert('لا يوجد ضيوف مستهدفين بهذه الحملة ضمن الفلتر المختار.');
            }

            if (!confirm(`سيتم إرسال ${prep.count} رسالة (${campaignType === 'qr_code' ? 'كروت باركود' : 'دعوات عامة'}).\nسرعة الإرسال المختارة: وتيرة معتمدة.`)) {
                setIsPreparing(false);
                return;
            }

            // 2. Start
            const startRes = await fetch(`${API_URL}/send-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    mode: sendingSpeed, // 'fast', 'balanced', 'safe'
                    useButtons: useButtons,
                    accountId: selectedAccountId,
                    autoFollowup: autoFollowup, // Control whether webhook auto-responds
                    chunkSize: chunkSize,
                    restDelayMinutes: restDelayMinutes,
                    target: targetAudience,
                    guestIds: selectedGuestIds
                })
            });

            if (startRes.ok) {
                setQueueStatus((p: any) => ({ ...p, isRunning: true }));
                startPolling(selectedEventId);
            }

        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsPreparing(false);
        }
    };

    const handleSendDemo = async () => {
        if (!selectedAccountId) return alert("الرجاء اختيار حساب للإرسال");
        if (!demoPhones.trim()) return alert("الرجاء إدخال رقم هاتف");
        if (!messageTemplate.trim()) return alert("الرجاء إدخال نص الدعوة");

        setDemoSending(true);
        const phones = demoPhones.split(',').map(p => p.trim()).filter(Boolean);

        try {
            for (const p of phones) {
                await fetch(`${API_URL}/send-demo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: selectedAccountId,
                        phone: p,
                        message: messageTemplate,
                        imageUrl: demoImageUrl || null
                    })
                });
                addLog(`[Demo] 🚀 Sent demo to ${p}`);
            }
            alert("تم إرسال التجربة بنجاح! سيصلك الرد التلقائي عند الضغط على أزرار التأكيد.");
        } catch (e: any) {
            alert('فشل الإرسال: ' + e.message);
        } finally {
            setDemoSending(false);
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
                        isRunning: data.status.isRunning || data.status.isResting,
                        isPaused: data.status.isPaused,
                        isResting: data.status.isResting,
                        nextBatchAt: data.status.nextBatchAt,
                        processed: (data.status.sent || 0) + (data.status.failed || 0),
                        total: (data.status.sent || 0) + (data.status.failed || 0) + (data.status.queued || 0)
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
    const handleEventSelect = async (e: any) => {
        const eventId = e.target.value;
        setSelectedEventId(eventId);
        if (eventId) {
            fetchGuests(eventId);
            startPolling(eventId);

            // Load Global Image + Client Phone from Event
            const { data: eventData } = await supabase
                .from('events')
                .select('settings, client_phone')
                .eq('id', eventId)
                .single();

            if (eventData?.settings?.global_invite_image_url) {
                setGlobalImageUrl(eventData.settings.global_invite_image_url);
            } else {
                setGlobalImageUrl('');
            }
            setIsDirectSend(eventData?.settings?.whatsapp_settings?.enable_direct_send === true);
            setClientPhone(eventData?.client_phone || '');
        }
        else { setGuests([]); stopPolling(); setGlobalImageUrl(''); setClientPhone(''); }
    };

    const saveClientPhone = async (phone: string) => {
        if (!selectedEventId) return;
        await supabase.from('events').update({ client_phone: phone }).eq('id', selectedEventId);
        addLog(`📱 رقم العميل محفوظ: ${phone}`);
    };
    const addLog = (m: string) => setLogs(p => [...p.slice(-99), `[${new Date().toLocaleTimeString()}] ${m}`]);

    const handleRetryFailed = async () => {
        if (!selectedEventId) return;
        setRetrying(true);
        try {
            const res = await fetch(`${API_URL}/retry-failed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId })
            });
            const data = await res.json();
            if (data.success) {
                addLog(`🔄 ${data.count} رسالة جاهزة لإعادة الإرسال`);
                await fetchGuests(selectedEventId);
            } else {
                addLog(`❌ ${data.error}`);
            }
        } catch (e: any) {
            addLog(`❌ خطأ: ${e.message}`);
        }
        setRetrying(false);
    };

    const handleDirectSend = async (guest: any) => {
        if (!selectedAccountId) return alert("الرجاء اختيار حساب للإرسال");
        if (!messageTemplate.trim()) return alert("الرسالة فارغة");
        if (!confirm(`هل أنت متأكد من إرسال الدعوة لـ ${guest.name} الآن؟`)) return;

        addLog(`⏳ إرسال مباشر لـ ${guest.name}...`);
        try {
            const res = await fetch(`${API_URL}/send-individual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: selectedAccountId,
                    guestId: guest.id,
                    template: messageTemplate,
                    imageUrl: globalImageUrl || null
                })
            });

            const data = await res.json();
            if (data.success) {
                addLog(`✅ تم الإرسال لـ ${guest.name} بنجاح`);
                fetchGuests(selectedEventId);
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            addLog(`❌ فشل الإرسال لـ ${guest.name}: ${e.message}`);
            alert('فشل الإرسال: ' + e.message);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedEventId) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${selectedEventId}/global_invite_${Date.now()}.${fileExt}`;
            const filePath = `global-invitations/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError, data } = await supabase.storage
                .from('global-invitations')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('global-invitations')
                .getPublicUrl(fileName);

            // 3. Update Event Settings in DB
            const { data: eventData } = await supabase
                .from('events')
                .select('settings')
                .eq('id', selectedEventId)
                .single();

            const updatedSettings = {
                ...(eventData?.settings || {}),
                global_invite_image_url: publicUrl
            };

            await supabase
                .from('events')
                .update({ settings: updatedSettings })
                .eq('id', selectedEventId);

            setGlobalImageUrl(publicUrl);
            addLog("تم رفع صورة الدعوة بنجاح ✅");
        } catch (error: any) {
            console.error("Upload Error:", error);
            alert("فشل الرفع: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveImage = async () => {
        if (!selectedEventId) return;

        try {
            const { data: eventData } = await supabase
                .from('events')
                .select('settings')
                .eq('id', selectedEventId)
                .single();

            const updatedSettings = {
                ...(eventData?.settings || {}),
                global_invite_image_url: null
            };

            await supabase
                .from('events')
                .update({ settings: updatedSettings })
                .eq('id', selectedEventId);

            setGlobalImageUrl('');
            addLog("تم حذف صورة الدعوة 🗑️");
        } catch (error: any) {
            alert("فشل حذف الصورة");
        }
    };


    // === RESPONSIVE LAYOUT HELPERS ===
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <aside className={`
                fixed lg:static inset-y-0 right-0 z-40
                w-72 bg-white border-l border-gray-200 shadow-2xl lg:shadow-none
                transform transition-transform duration-300 ease-in-out flex flex-col
                ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className="p-4 border-b border-gray-100 bg-gradient-to-b from-white to-gray-50 flex justify-between items-center shrink-0">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                        <Play className="w-5 h-5 text-indigo-600" />
                        إعدادات الحملة
                    </h2>
                    <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Square className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Campaign Type */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">نوع الحملة</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setCampaignType('invite')}
                                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${campaignType === 'invite' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-lg ${campaignType === 'invite' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-gray-100 text-gray-500'}`}>
                                    <Send className="w-3 h-3" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-xs text-slate-800">دعوة عامة</div>
                                    <div className="text-[9px] text-slate-500">نص + صورة للكل</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setCampaignType('qr_code')}
                                className={`p-3 rounded-xl border text-right transition-all flex items-center gap-3 ${campaignType === 'qr_code' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className={`p-2 rounded-lg ${campaignType === 'qr_code' ? 'bg-purple-600 text-white shadow-md shadow-purple-100' : 'bg-gray-100 text-gray-500'}`}>
                                    <Zap className="w-3 h-3" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-xs text-slate-800">كروت الباركود</div>
                                    <div className="text-[9px] text-slate-500">للمؤكدين فقط</div>
                                </div>
                            </button>
                        </div>

                        {/* Direct Send Status Indicator */}
                        {isDirectSend && (
                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-pulse">
                                <Zap className="w-3 h-3 text-amber-600" />
                                <span className="text-[10px] font-bold text-amber-700">نمط الإرسال المباشر نشط</span>
                            </div>
                        )}
                    </div>

                    <div className="w-full h-px bg-slate-100" />

                    {/* 1. Global Image Section (UPLOADER) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">صورة الدعوة العامة</label>

                        {!globalImageUrl ? (
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    disabled={isUploading || !selectedEventId}
                                />
                                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${isUploading ? 'bg-gray-50 border-gray-200' : 'bg-white border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'}`}>
                                    {isUploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                            <span className="text-[10px] font-bold text-slate-400">جاري الرفع...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <Upload className="w-6 h-6 text-slate-400" />
                                            <span className="text-[10px] font-bold text-slate-500">رفع صورة الدعوة</span>
                                            <span className="text-[8px] text-slate-400">JPG, PNG (Max 5MB)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-white group shadow-sm">
                                <img src={globalImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <button
                                        onClick={handleRemoveImage}
                                        className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-lg"
                                        title="حذف الصورة"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <span className="text-white text-[9px] font-bold">حذف وصورة جديدة</span>
                                </div>
                            </div>
                        )}

                        {!selectedEventId && (
                            <p className="text-[8px] text-rose-500 mt-2 font-bold flex items-center gap-1">
                                <Shield className="w-2.5 h-2.5" />
                                اختر المناسبة أولاً للتمكن من رفع الصورة
                            </p>
                        )}
                    </div>

                    {/* Client Phone Section */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">📱 رقم العميل (للإشعارات)</label>
                        <input
                            type="tel"
                            dir="ltr"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            onBlur={() => clientPhone && saveClientPhone(clientPhone)}
                            placeholder="05XXXXXXXX"
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 text-left focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {clientPhone && (
                            <p className="text-[8px] text-emerald-600 mt-1 font-bold flex items-center gap-1">
                                <CheckCircle className="w-2.5 h-2.5" />
                                البوت يبلّغ العميل تلقائياً عند كل تأكيد/اعتذار
                            </p>
                        )}
                        {!clientPhone && selectedEventId && (
                            <p className="text-[8px] text-amber-500 mt-1 font-bold">
                                ⚠️ أدخل رقم العميل ليصله إشعارات RSVP
                            </p>
                        )}
                    </div>

                    {/* Chunking Config Section */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">⚙️ إعدادات الإرسال الآمن (Chunks)</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[9px] font-bold text-slate-400 mb-1 block">دعوة لكل دفعة</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={chunkSize}
                                    onChange={(e) => setChunkSize(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[9px] font-bold text-slate-400 mb-1 block">استراحة (دقائق)</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    value={restDelayMinutes}
                                    onChange={(e) => setRestDelayMinutes(Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <p className="text-[8px] text-emerald-600 mt-2 font-bold flex flex-wrap gap-1">
                            <CheckCircle className="w-2.5 h-2.5" />
                            يتم إيقاف الإرسال العام لراحتك، ولا يتضرر كرت الدخول للمؤكدين.
                        </p>
                    </div>

                    {/* Automation Section */}
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">أتمتة الاستجابة</label>
                        <div className="flex justify-between items-center p-3 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-100 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold">إرسال البطاقات آلياً</span>
                                <span className="text-[8px] opacity-70 italic leading-tight">إرسال الكرت فور تأكيد الحضور من الضيف</span>
                            </div>
                            <button
                                onClick={() => setAutoFollowup(!autoFollowup)}
                                className={`w-10 h-5 rounded-full transition-all relative ${autoFollowup ? 'bg-emerald-600' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${autoFollowup ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="w-full h-px bg-slate-100" />

                    {/* Devices */}
                    <div className="pb-6">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">الأجهزة المتصلة</label>
                        <div className="transform scale-90 origin-right -mr-2">
                            <ConnectionPanel accounts={accounts} onAccountsChange={fetchAccounts} addLog={addLog} />
                        </div>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                {/* --- TOP FIXED HEADER (Global Selection Area) --- */}
                <header className="h-20 bg-white border-b border-gray-200 z-20 px-6 flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-8">
                        {/* Event Selection */}
                        <div className="flex flex-col gap-1 min-w-[240px]">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">اختيار المناسبة</label>
                            <select
                                value={selectedEventId}
                                onChange={handleEventSelect}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-extrabold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer"
                                style={{
                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'left 0.75rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="">-- اختر المناسبة --</option>
                                {events.map(e => <option key={e.id} value={e.id}>🎉 {e.name}</option>)}
                            </select>
                        </div>

                        {/* Account Selection Area */}
                        <div className="hidden md:flex flex-col gap-1 min-w-[200px]">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">حساب الإرسال</label>
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-extrabold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all outline-none appearance-none cursor-pointer"
                                style={{
                                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'left 0.75rem center',
                                    backgroundSize: '1rem'
                                }}
                            >
                                <option value="">-- الجوال الافتراضي --</option>
                                {accounts.filter(a => a.connected).map(a => (
                                    <option key={a.id} value={a.id}>📱 {a.name || a.phone}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-slate-800">نشط الآن</span>
                            <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                النظام متصل بالسيرفر
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors lg:hidden"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
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

                        {/* Tabs Navigation */}
                        <div className="flex border-b border-gray-200">
                            <button
                                onClick={() => setActiveTab('campaign')}
                                className={`px-6 py-3 font-bold text-sm transition-colors ${activeTab === 'campaign' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                إدارة الحملة الأساسية
                            </button>
                            <button
                                onClick={() => setActiveTab('demo')}
                                className={`px-6 py-3 font-bold text-sm transition-colors flex items-center gap-2 ${activeTab === 'demo' ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Sparkles className="w-4 h-4" />
                                تجربة الخدمة (Demo)
                            </button>
                        </div>

                        {/* Main Container Content based on Tab */}
                        {activeTab === 'campaign' ? (
                            <div className="space-y-4 pb-20">
                                {/* Delivery Tracking Stats Bar */}
                                {selectedEventId && deliveryStats.total > 0 && (
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-gray-600 flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-indigo-500" />
                                                حالة التوصيل
                                            </h4>
                                            {deliveryStats.failed > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleRetryFailed}
                                                    disabled={retrying}
                                                    className="h-7 text-[10px] border-orange-200 text-orange-600 hover:bg-orange-50 gap-1"
                                                >
                                                    {retrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                    إعادة إرسال الفاشلة ({deliveryStats.failed})
                                                </Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                                                <Mail className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                                                <div className="text-lg font-black text-blue-700">{deliveryStats.sent}</div>
                                                <div className="text-[9px] text-blue-500 font-bold">أُرسلت ✅</div>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                                                <MailCheck className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                                                <div className="text-lg font-black text-emerald-700">{deliveryStats.delivered}</div>
                                                <div className="text-[9px] text-emerald-500 font-bold">وصلت ✅✅</div>
                                            </div>
                                            <div className="bg-indigo-50 rounded-xl p-3 text-center border border-indigo-100">
                                                <Eye className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                                                <div className="text-lg font-black text-indigo-700">{deliveryStats.read}</div>
                                                <div className="text-[9px] text-indigo-500 font-bold">قُرأت 👁️</div>
                                            </div>
                                            <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                                                <AlertTriangle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                                                <div className="text-lg font-black text-red-700">{deliveryStats.failed}</div>
                                                <div className="text-[9px] text-red-500 font-bold">فشلت ❌</div>
                                            </div>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                            {deliveryStats.read > 0 && <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(deliveryStats.read / deliveryStats.total) * 100}%` }} />}
                                            {deliveryStats.delivered > 0 && <div className="h-full bg-emerald-400 transition-all" style={{ width: `${(deliveryStats.delivered / deliveryStats.total) * 100}%` }} />}
                                            {deliveryStats.sent > 0 && <div className="h-full bg-blue-300 transition-all" style={{ width: `${(deliveryStats.sent / deliveryStats.total) * 100}%` }} />}
                                            {deliveryStats.failed > 0 && <div className="h-full bg-red-400 transition-all" style={{ width: `${(deliveryStats.failed / deliveryStats.total) * 100}%` }} />}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-6">
                                    {/* Smart Editor (Moved to top for full width view) */}
                                    {/* Bottom: Table (Full Width) */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col min-h-[800px] order-2">
                                        <div className="p-4 border-b bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
                                            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                قائمة بيانات الضيوف الشاملة
                                            </h3>
                                            
                                            {/* Filters */}
                                            <div className="flex bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                                                <button 
                                                    onClick={() => setGuestFilter('all')} 
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${guestFilter === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    الكل ({guests.length})
                                                </button>
                                                <button 
                                                    onClick={() => setGuestFilter('delivered')} 
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${guestFilter === 'delivered' ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    وصلت {(deliveryStats?.delivered || 0) + (deliveryStats?.read || 0)}
                                                </button>
                                                <button 
                                                    onClick={() => setGuestFilter('failed')} 
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${guestFilter === 'failed' ? 'bg-red-50 text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    فشلت {deliveryStats?.failed || 0}
                                                </button>
                                                <button 
                                                    onClick={() => setGuestFilter('pending')} 
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${guestFilter === 'pending' ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    بانتظار الإرسال
                                                </button>
                                            </div>

                                            <div className="hidden lg:flex gap-2 text-[10px] text-gray-500 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                                                <span className="text-green-600 font-bold">المؤكدين: {rsvpStats.confirmed}</span>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-1 overflow-auto rounded-b-2xl">
                                            <GuestTable
                                                guests={guests.filter(g => {
                                                    const s = g.last_message_status;
                                                    if (guestFilter === 'failed') return s === 'failed';
                                                    if (guestFilter === 'delivered') return s === 'delivered' || s === 'read';
                                                    if (guestFilter === 'pending') return !s || s === 'pending' || s === 'queued';
                                                    return true; // all
                                                })}
                                                onRetry={handleDirectSend}
                                                onDirectSend={handleDirectSend}
                                                onOverrideStatus={handleOverrideStatus}
                                                onEditPhone={handleEditPhone}
                                            />
                                        </div>
                                    </div>

                                    {/* Right: Smart Editor */}
                                    <div className="w-full flex flex-col gap-4 order-1">
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
                                                                <TemplateVariable label="العدد المسموح" value="{{companions_count}}" onClick={(v: string) => setMessageTemplate(p => p + v)} />
                                                                <TemplateVariable label="اسم القاعة" value="{{venue}}" onClick={(v: string) => setMessageTemplate(p => p + v)} />
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
                                                            <label className="text-xs font-bold text-gray-600">استهداف الضيوف</label>
                                                            <select
                                                                value={targetAudience}
                                                                onChange={e => setTargetAudience(e.target.value as any)}
                                                                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-indigo-700 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            >
                                                                <option value="all">كل الضيوف</option>
                                                                <option value="unsent">جدد (لم يرسل لهم)</option>
                                                                <option value="replacements">البدلاء فقط</option>
                                                                <option value="confirmed">المؤكدين</option>
                                                                <option value="declined">المعتذرين</option>
                                                            </select>
                                                        </div>

                                                        <div className="flex justify-between items-center py-2 border-t border-gray-100/50">
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
                                                                disabled={isPreparing}
                                                                className={`w-full h-12 text-white shadow-lg transition-all active:scale-95 text-sm font-bold flex justify-center items-center gap-2 rounded-xl ${isPreparing ? 'bg-indigo-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-300 shadow-indigo-200'}`}
                                                            >
                                                                {isPreparing ? (
                                                                    <>
                                                                       <Loader2 className="w-5 h-5 animate-spin" />
                                                                       جاري تحضير الرسائل...
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                       <Send className="w-5 h-5" />
                                                                       إرسال الحملة الآن
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm">
                                                                    <div className="flex justify-between text-xs font-bold text-indigo-900 mb-2">
                                                                        <span className="flex items-center gap-1">
                                                                            {queueStatus.isResting ? (
                                                                                <span className="flex items-center gap-2 text-amber-600">
                                                                                    <Clock className="w-3 h-3 animate-pulse" />
                                                                                    استراحة للراحة (☕) ... يبدأ خلال: {Math.round((new Date(queueStatus.nextBatchAt).getTime() - Date.now()) / 1000)} ثانية
                                                                                </span>
                                                                            ) : (
                                                                                <span className="flex items-center gap-2">
                                                                                    <Loader2 className="w-3 h-3 animate-spin" /> جاري الإرسال (محاكاة بشرية)...
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span>{queueStatus.processed} / {queueStatus.total}</span>
                                                                    </div>
                                                                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                                        <div className={`h-full transition-all duration-300 rounded-full ${queueStatus.isResting ? 'bg-amber-400' : 'bg-indigo-500'}`} style={{ width: `${(queueStatus.processed / (queueStatus.total || 1)) * 100}%` }}></div>
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
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-20 max-w-4xl mx-auto flex flex-col gap-6">
                                {/* DEMO TAB VIEW */}
                                <div className="text-center mb-4">
                                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Sparkles className="w-8 h-8" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800">تجربة الخدمة (Demo)</h2>
                                    <p className="text-gray-500 mt-2">أرسل دعوة تجريبية لعملائك قبل إطلاق الحملة لمعاينة تجربة الاستلام والرد الآلي.</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">أرقام هواتف التجربة (مفصولة بفاصلة)</label>
                                        <input
                                            type="text"
                                            value={demoPhones}
                                            onChange={e => setDemoPhones(e.target.value)}
                                            placeholder="مثال: 966500000000, 966511111111"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 focus:bg-white transition-all text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">رابط صورة عينة الكرت (اختياري)</label>
                                        <input
                                            type="text"
                                            value={demoImageUrl}
                                            onChange={e => setDemoImageUrl(e.target.value)}
                                            placeholder="https://example.com/image.jpg"
                                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 focus:bg-white transition-all text-left"
                                            dir="ltr"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">نص الدعوة</label>
                                        <textarea
                                            value={messageTemplate}
                                            onChange={e => setMessageTemplate(e.target.value)}
                                            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 focus:bg-white resize-none transition-all text-sm leading-relaxed outline-none min-h-[220px]"
                                            placeholder="اكتب رسالتك التجريبية هنا..."
                                        />
                                    </div>

                                    <Button
                                        onClick={handleSendDemo}
                                        disabled={demoSending}
                                        className="w-full h-14 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 text-base font-bold flex justify-center items-center gap-2 rounded-xl"
                                    >
                                        {demoSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                        {demoSending ? 'جاري إرسال التجربة ...' : 'إرسال الرسالة التجريبية الآن'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
