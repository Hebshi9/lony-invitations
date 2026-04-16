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
import geminiService from '../services/gemini-service';

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
    const [eventDate, setEventDate] = useState('اليوم');
    const [eventLocation, setEventLocation] = useState('الموقع');
    const [eventTime, setEventTime] = useState('');
    const [isExtractingAI, setIsExtractingAI] = useState(false);
    
    const [gateway, setGateway] = useState<'meta' | 'evolution'>('meta');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplateName, setSelectedTemplateName] = useState('lony');
    const [dayUsage, setDayUsage] = useState(0);
    const [metaLimit, setMetaLimit] = useState(250);
    const [priority, setPriority] = useState(3);
    const [dailyBudget, setDailyBudget] = useState(250);

    const [guests, setGuests] = useState<any[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [rsvpStats, setRsvpStats] = useState({
        total: 0, sent: 0, delivered: 0, read: 0, failed: 0,
        confirmed: 0, declined: 0, maybe: 0, entered: 0
    });

    const [isSending, setIsSending] = useState(false);
    const [isSendingReport, setIsSendingReport] = useState(false);
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
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuestForLifecycle, setSelectedGuestForLifecycle] = useState<any>(null);
    const [testPhone, setTestPhone] = useState('');
    
    const [isStabilizing, setIsStabilizing] = useState(false);
    const [metaMediaId, setMetaMediaId] = useState('');
    
    const isPausedRef = useRef(false);
    const shouldStopRef = useRef(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const activeCampaignRef = useRef<{ targetIds: string[], phase: string, startTime: number } | null>(null);

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
                setEventDate(ev.date || 'اليوم');
                setEventLocation(ev.location || 'قاعة الاحتفالات');
                setEventTime(ev.time || '');
                setOwnerPhone(ev.owner_phone || '');
                setPriority(ev.priority_level || 3);
                setDailyBudget(ev.daily_budget || 250);
                setMetaMediaId(ev.meta_media_id || '');
                
                // Set initial progress from DB
                if (ev.campaign_progress) {
                    setProgress(Math.round((ev.campaign_progress.count / ev.campaign_progress.total) * 100) || 0);
                    setCurrentBatchIndex(ev.campaign_progress.count || 0);
                    setTotalBatches(ev.campaign_progress.total || 0);
                }
            }
            fetchUsage();
        }
    }, [events, selectedEventId]);

    const fetchUsage = async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
        setDayUsage(count || 0);

        const { data: limit } = await supabase.from('system_settings').select('value').eq('key', 'meta_daily_limit').single();
        if (limit) setMetaLimit(parseInt(limit.value));
    };

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (data) setEvents(data);
    };

    const fetchAccounts = async () => { setAccounts([]); }; // Legacy compatibility

    const fetchGuests = async (eventId: string) => {
        setLoadingGuests(true);
        // Improved query to get latest message status per guest
        const { data } = await supabase
            .from('guests')
            .select(`*, whatsapp_messages(*)`)
            .eq('event_id', eventId)
            .order('name', { ascending: true });
            
        if (data) {
            setGuests(data);
        }
        setLoadingGuests(false);
    };

    // --- REAL-TIME SYNC ---
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    
    useEffect(() => {
        if (!selectedEventId) return;

        console.log(`[Realtime] Subscribing to Event: ${selectedEventId}`);
        const guestSub = supabase
            .channel(`sender_updates_${selectedEventId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${selectedEventId}` }, (payload) => {
                console.log('[Realtime] Guest table changed:', payload.eventType);
                fetchGuests(selectedEventId); 
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `event_id=eq.${selectedEventId}` }, (payload) => {
                console.log('[Realtime] Message table changed:', payload.eventType);
                fetchGuests(selectedEventId); 
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${selectedEventId}` }, (payload) => {
                const updatedEvent = payload.new;
                if (updatedEvent.campaign_progress) {
                    const p = updatedEvent.campaign_progress;
                    const newProgress = p.total > 0 ? Math.round((p.count / p.total) * 100) : 0;
                    setProgress(newProgress);
                    setCurrentBatchIndex(p.count);
                    setTotalBatches(p.total);
                    
                    if (p.current_name && p.current_name !== "Gearing up...") {
                        addLog(`📡 الإرسال الآن لـ: ${p.current_name}`);
                    }
                }
                
                if (updatedEvent.campaign_status === 'idle' && isSending) {
                    setIsSending(false);
                    addLog("🏁 اكتملت الحملة بنجاح! تم تحديث جميع الحالات.");
                }
            })
            .subscribe((status) => {
                setRealtimeConnected(status === 'SUBSCRIBED');
            });

        return () => { guestSub.unsubscribe(); };
    }, [selectedEventId]);

    // --- REACTIVE STATS ---
        // --- LIVE PROGRESS CALCULATION (DISABLED: Moved to Server-Side DB Tracking) ---
        // We now rely on 'events' table subscription above ^
        const stats = {
            total: guests.length,
            sent: guests.filter((g: any) => g.status === 'sent' || g.whatsapp_messages?.length > 0).length,
            delivered: guests.filter((g: any) => g.whatsapp_messages?.some((m: any) => m.delivery_status === 'delivered' || m.delivery_status === 'read')).length,
            read: guests.filter((g: any) => g.whatsapp_messages?.some((m: any) => m.delivery_status === 'read') || (g.rsvp_status && g.rsvp_status !== 'none' && g.rsvp_status !== 'pending')).length,
            failed: guests.filter((g: any) => g.status === 'failed' || g.whatsapp_messages?.some((m: any) => m.status === 'failed')).length,
            confirmed: guests.filter((g: any) => g.rsvp_status === 'confirmed').length,
            declined: guests.filter((g: any) => g.rsvp_status === 'declined').length,
            maybe: guests.filter((g: any) => g.rsvp_status === 'maybe').length,
            entered: guests.filter((g: any) => g.checked_in).length
        };
        setRsvpStats(stats);
    }, [guests]);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString('ar-SA')} - ${msg}`]);
        setTimeout(() => logContainerRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleEventSelect = (e: any) => {
        const id = e.target.value;
        setSelectedEventId(id);
        if (id) fetchGuests(id);
    };

    const handleRemoveImage = () => setGlobalImageUrl('');
    
    const handleImageUpload = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
            const { error } = await supabase.storage.from('global-invitations').upload(fileName, file);
            if (!error) {
                const { data } = supabase.storage.from('global-invitations').getPublicUrl(fileName);
                setGlobalImageUrl(data.publicUrl);
                addLog('✅ تم رفع صورة الدعوة بنجاح.. جرب استخراج بياناتها آلياً!');
            }
        } catch (err) {}
        setIsUploading(false);
    };

    const handleStabilizeImage = async () => {
        if (!globalImageUrl || !selectedEventId) return alert('الرجاء رفع صورة واختيار مناسبة أولاً');
        setIsStabilizing(true);
        addLog('📤 جاري تثبيت الصورة في سيرفرات فيسبوك (Meta)...');
        try {
            const res = await fetch('/.netlify/functions/upload-meta-media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageUrl: globalImageUrl, eventId: selectedEventId })
            });
            const data = await res.json();
            if (data.success) {
                setMetaMediaId(data.mediaId);
                addLog('✅ تم تثبيت الصورة بنجاح! الإرسال الآن سيكون أسرع وأكثر استقراراً.');
            } else {
                addLog(`❌ فشل تثبيت الصورة: ${data.error}`);
            }
        } catch (e) {
            addLog('⚠️ خطأ في الاتصال بخدمة Meta Media');
        }
        setIsStabilizing(false);
    };

    const handleAIExtract = async () => {
        if (!globalImageUrl) return alert('الرجاء رفع صورة دعوة أولاً ليقرأها الذكاء الاصطناعي');
        setIsExtractingAI(true);
        addLog('🤖 يتم الآن تحليل صورة الدعوة باستخدام Gemini Flash 1.5...');
        try {
            // Get data via Gemini
            const extract = await geminiService.extractInvitationDetails(globalImageUrl);
            if (extract) {
                if (extract.groom) setGroomName(extract.groom);
                if (extract.bride) setBrideName(extract.bride);
                if (extract.date) setEventDate(extract.date);
                if (extract.location) setEventLocation(extract.location);
                if (extract.time) setEventTime(extract.time);
                
                addLog('✨ تم استخراج البيانات بنجاح! راجع الحقول وقم بتعديل ما تراه غير دقيق.');
            }
        } catch (e:any) {
            console.error(e);
            addLog('❌ فشل الذكاء الاصطناعي في قراءة الصورة، يرجى تعبئتها يدوياً.');
        }
        setIsExtractingAI(false);
    };

    const handleExportExcel = () => {
        // Detailed export with status
        const exportData = guests.map(g => {
            const hasMsg = g.whatsapp_messages && g.whatsapp_messages.length > 0;
            const lastMsg = hasMsg ? g.whatsapp_messages[g.whatsapp_messages.length - 1] : null;
            
            return {
                'الاسم': g.name,
                'الجوال': g.phone,
                'حالة الدعوة': g.rsvp_status === 'confirmed' ? 'مؤكد' : g.rsvp_status === 'declined' ? 'معتذر' : 'بانتظار الرد',
                'حالة الإرسال': g.status === 'sent' ? 'تم الإرسال' : g.status === 'failed' ? 'فشل' : 'لم يتم',
                'حالة الوصول': lastMsg ? (lastMsg.delivery_status === 'read' ? 'تمت القراءة' : lastMsg.delivery_status === 'delivered' ? 'وصلت' : 'مرسلة') : '--',
                'سبب الفشل': lastMsg?.error_message || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "تقرير الضيوف التفصيلي");
        
        // Auto-size columns for better layout
        const wscols = [{wch:20}, {wch:15}, {wch:15}, {wch:15}, {wch:15}, {wch:30}];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `تقرير_حملة_${new Date().toLocaleDateString()}.xlsx`);
    };

    const handleDirectSend = async (guest: any) => {
        if (!selectedEventId) return;
        addLog(`📤 إرسال فوري لـ ${guest.name}...`);
        try {
            const res = await fetch(`/api/send-campaign-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: [guest.id],
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            if (res.ok) addLog(`✅ الطلب نُفذ بنجاح لـ ${guest.name}`);
            else addLog(`❌ فشل الطلب لـ ${guest.name}`);
        } catch (e) {
            addLog(`⚠️ خطأ في الاتصال بالسيرفر`);
        }
    };

    const handleSendTest = async (guest: any) => {
        const phone = prompt('أدخل رقم الجوال الذي تريد استلام التجربة عليه (مثال: 966...):', ownerPhone || '96650...');
        if (!phone) return;
        
        addLog(`🎯 إرسال تجربة لـ ${guest.name} إلى الرقم ${phone}...`);
        try {
            const res = await fetch(`/api/send-campaign-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: [guest.id],
                    eventId: selectedEventId,
                    campaignType: campaignType,
                    testPhone: phone // Internal logic to override recipient phone
                })
            });
            if (res.ok) addLog(`✅ تم إرسال التجربة بنجاح لـ ${phone}`);
        } catch (e) {
            addLog(`⚠️ خطأ في إرسال التجربة`);
        }
    };

    const handleRetryAllFailed = async () => {
        const failedGuests = guests.filter(g => g.status === 'failed' || g.whatsapp_messages?.some((m:any) => m.status === 'failed'));
        if (failedGuests.length === 0) return alert('لا يوجد ضيوف بحالة "فشل" لإعادة الإرسال لهم');
        
        if (!window.confirm(`هل أنت متأكد من إعادة إرسال الدعوة لعدد ${failedGuests.length} ضيف فشل إرسالهم سابقاً؟`)) return;
        
        addLog(`🔄 جاري البدء في إعادة إرسال ${failedGuests.length} دعوة فاشلة...`);
        try {
             const res = await fetch(`/api/send-campaign-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: failedGuests.map(g => g.id),
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            if (res.ok) {
                setIsSending(true);
                addLog(`✅ بدأت حملة الإعادة السحابية بنجاح.`);
            }
        } catch (e) {
            addLog(`⚠️ خطأ في عملية الإعادة الجماعية`);
        }
    };

    const handleOverrideStatus = async (guest: any, newStatus: string) => {
        const { error } = await supabase.from('guests').update({ rsvp_status: newStatus }).eq('id', guest.id);
        if (!error) addLog(`✅ تم تحديث حالة ${guest.name} يدوياً إلى: ${newStatus === 'confirmed' ? 'تأكيد' : 'اعتذار'}`);
    };

    const handleEditPhone = async (guest: any, newPhone: string) => {
        const { error } = await supabase.from('guests').update({ phone: newPhone }).eq('id', guest.id);
        if (!error) addLog(`✅ تم تحديث رقم جوال ${guest.name}.. يمكنك الآن الإرسال له.`);
    };

    const handleSendOwnerReport = async () => {
        if (!selectedEventId) return;
        setIsSendingReport(true);
        addLog('🤖 جاري توليد التقرير الذكي لـ صاحب المناسبة عبر Gemini...');
        try {
            const res = await fetch('/.netlify/functions/owner-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId })
            });
            const data = await res.json();
            if (data.success) {
                addLog('✅ تم إرسال ملخص المناسبة واتساب لصاحب المناسبة بنجاح!');
            } else {
                addLog(`❌ فشل إرسال التقرير: ${data.error || 'خطأ غير معروف'}`);
            }
        } catch (e: any) {
            addLog(`⚠️ خطأ في الاتصال بسيرفر التقارير: ${e.message}`);
        }
        setIsSendingReport(false);
    };

    const handleUpdateSettings = async () => {
        if (!selectedEventId) return;
        const ev = events.find(x => x.id === selectedEventId);
        const settings = { 
            ...(ev?.settings || {}), 
            groom_name: groomName, 
            bride_name: brideName, 
            global_invite_image_url: globalImageUrl 
        };
        const { error } = await supabase.from('events').update({ 
            settings,
            date: eventDate,
            location: eventLocation,
            time: eventTime,
            owner_phone: ownerPhone,
            groom_name: groomName,
            bride_name: brideName,
            priority_level: priority,
            daily_budget: dailyBudget
        }).eq('id', selectedEventId);
        
        if (error) addLog(`❌ فشل التحديث: ${error.message}`);
        else {
            addLog("✅ تم حفظ المتغيرات وإعدادات الأولوية للمناسبة!");
            fetchEvents();
        }
    };

    const handleStartQueue = async () => {
        if (!selectedEventId) {
            addLog('⚠️ الرجاء اختيار المناسبة أولاً من أعلى الشاشة');
            return alert('الرجاء اختيار المناسبة');
        }
        
        let targetGuests = [];
        if (targetAudience === 'all') {
            targetGuests = guests;
        } else if (targetAudience === 'replacements') {
            targetGuests = guests.filter(g => g.category === 'replacement' || !g.whatsapp_messages?.some((m:any) => m.message_phase === 'invitation'));
        } else if (targetAudience === 'unsent') {
            const tempPhase = campaignType === 'qr_code' ? 'qr_code' : 'invitation';
            targetGuests = guests.filter(g => !g.whatsapp_messages?.some((m:any) => m.message_phase === tempPhase));
        }

        if (campaignType === 'qr_code') {
            targetGuests = targetGuests.filter(g => g.rsvp_status === 'confirmed');
        }

        if (targetGuests.length === 0) {
            addLog(`⚠️ لم يتم العثور على ضيوف مستهدفين في فئة (${targetAudience === 'all' ? 'الكل' : targetAudience === 'unsent' ? 'غير المرسل' : 'البدلاء'})`);
            return alert('لا يوجد ضيوف مستهدفين في هذه الفئة');
        }

        setIsSending(true);
        setIsPaused(false);
        setShouldStop(false);
        setProgress(0);
        
        addLog(`🚀 جاري تمرير المهمة إلى المحرك السحابي لـ ${targetGuests.length} ضيف...`);

        try {
            // AUTO-SAVE: Sync current UI state to DB before background engine fetches it
            const ev = events.find(x => x.id === selectedEventId);
            const settings = { ...(ev?.settings || {}), groom_name: groomName, bride_name: brideName, global_invite_image_url: globalImageUrl };
            await supabase.from('events').update({ 
                settings,
                date: eventDate,
                location: eventLocation,
                owner_phone: ownerPhone 
            }).eq('id', selectedEventId);

            const res = await fetch(`/api/send-campaign-background`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: targetGuests.map(g => g.id),
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            
            if (res.status === 202 || res.ok) {
                addLog(`✅ المهمة انتقلت للسحابة بنجاح!`);
                addLog(`🤖 يمكنك إغلاق المتصفح الآن، النظام يرسل آلياً وبدقة عالية.`);
                
                // Set the campaign ref to trigger reactive progress in useEffect
                activeCampaignRef.current = {
                    targetIds: targetGuests.map(g => g.id),
                    phase: campaignType === 'qr_code' ? 'qr_code' : 'invitation',
                    startTime: Date.now()
                };
                
                setTotalBatches(targetGuests.length);
                setCurrentBatchIndex(0);
                setProgress(0);
            } else {
                addLog(`❌ السيرفر مشغول حالياً، يرجى المحاولة بعد قليل.`);
                setIsSending(false);
            }
        } catch (e:any) {
            console.error('Campaign Launch Error:', e);
            addLog(`⚠️ خطأ في محرك الإرسال: ${e.message}`);
            setIsSending(false);
        }
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
                            {globalImageUrl && (
                                <Button 
                                    onClick={handleStabilizeImage}
                                    disabled={isStabilizing || !!metaMediaId}
                                    className={`w-full mt-2 h-8 text-[9px] font-black flex items-center gap-2 ${metaMediaId ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                    variant="outline"
                                >
                                    {isStabilizing ? <Loader2 className="w-3 h-3 animate-spin"/> : metaMediaId ? <Shield className="w-3 h-3"/> : <Zap className="w-3 h-3"/>}
                                    {metaMediaId ? 'تم التثبيت (Meta ID)' : 'تثبيت الصورة (Meta Stability)'}
                                </Button>
                            )}
                        </div>

                        <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إعدادات المناسبة</label>
                                <button 
                                    onClick={handleAIExtract}
                                    disabled={isExtractingAI || !globalImageUrl}
                                    className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded mt-[-5px] hover:bg-indigo-100 transition text-[9px] font-bold flex items-center gap-1 disabled:opacity-50"
                                    title="استخراج ذكي لبيانات الدعوة (OCR)"
                                >
                                    {isExtractingAI ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                    AI قراءة
                                </button>
                            </div>
                            <div className="space-y-3">
                                 <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">الأولوية</label>
                                        <select value={priority} onChange={e=>setPriority(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none">
                                            <option value={1}>عاجل جداً 🔥</option>
                                            <option value={2}>مرتفع ⬆️</option>
                                            <option value={3}>عادي 🟢</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">ميزانية اليوم</label>
                                        <input type="number" value={dailyBudget} onChange={e=>setDailyBudget(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                    </div>
                                </div>
                                <Button onClick={handleUpdateSettings} className="w-full bg-indigo-600 text-white h-9 rounded-xl font-black text-[10px]">حفظ التعديلات</Button>
                            </div>
                        </div>

                        {/* WhatsApp Live Preview Mockup */}
                        <div className="bg-[#E5DDD5] p-4 rounded-[2rem] border border-slate-200 relative overflow-hidden shadow-inner">
                            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-white relative z-10">
                                <div className="flex items-center gap-2 mb-3 border-b pb-2 border-slate-100">
                                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 font-black text-[10px]">L</div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-700">Lony Invitations</span>
                                        <span className="text-[8px] text-slate-400 font-bold">Business Account</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {globalImageUrl && <img src={globalImageUrl} className="rounded-lg w-full aspect-video object-cover border border-slate-100 shadow-sm" />}
                                    <div className="bg-[#D9FDD3] p-3 rounded-tr-none rounded-2xl text-[11px] font-bold leading-relaxed text-slate-800 shadow-sm border border-emerald-100">
                                        أهلاً بك يا [اسم الضيف] 🌺<br/>
                                        ندعوكم لحضور حفل زفاف {groomName} و {brideName} يوم {eventDate} في {eventLocation} في تمام الساعة {eventTime}...
                                        <div className="mt-2 pt-2 border-t border-emerald-200/50 flex flex-col gap-2">
                                            <div className="bg-white py-1.5 rounded-lg text-center text-indigo-600 text-[10px] shadow-sm border border-indigo-50">✅ تأكيد الحضور</div>
                                            <div className="bg-white py-1.5 rounded-lg text-center text-rose-600 text-[10px] shadow-sm border border-slate-50">❌ اعتذار</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
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

                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
                        <label className="text-[10px] font-black text-amber-600 uppercase block tracking-widest flex items-center gap-2"><Settings className="w-3 h-3"/> مركز المتابعة (Follow-up)</label>
                        <div className="grid grid-cols-1 gap-2">
                             <Button 
                                onClick={() => { setCampaignType('invite'); setTargetAudience('unsent'); handleStartQueue(); }}
                                className="bg-white border-amber-200 text-amber-700 h-8 text-[10px] font-black hover:bg-amber-100"
                                variant="outline"
                            >
                                🔔 تذكير من لم يرد (Pending)
                            </Button>
                            <Button 
                                onClick={() => { setCampaignType('qr_code'); setTargetAudience('all'); handleStartQueue(); }}
                                className="bg-white border-indigo-200 text-indigo-700 h-8 text-[10px] font-black hover:bg-indigo-100"
                                variant="outline"
                            >
                                🎫 تذكير ليلة الحفل (Confirmed)
                            </Button>
                        </div>
                    </div>

                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                        <label className="text-[10px] font-black text-emerald-600 uppercase block tracking-widest flex items-center gap-2"><Bot className="w-3 h-3"/> أتمتة الردود الذكية</label>
                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                            <span>إرسال الباركود آلياً عند التأكيد</span>
                            <div className="w-8 h-4 bg-emerald-500 rounded-full relative shadow-inner"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full shadow-sm"></div></div>
                        </div>
                    </div>

                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
                        <label className="text-[10px] font-black text-amber-600 uppercase block tracking-widest flex items-center gap-2"><Mail className="w-3 h-3"/> هاتف تقارير العميل</label>
                        <input 
                            type="text" 
                            value={ownerPhone} 
                            onChange={e => setOwnerPhone(e.target.value)}
                            placeholder="9665..."
                            className="w-full bg-white border border-amber-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none focus:ring-2 ring-amber-500/20"
                        />
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
                        <div className="h-10 w-[1px] bg-slate-100 mx-2" />
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">هاتف التقارير</label>
                            <input 
                                type="text"
                                value={ownerPhone}
                                onChange={e => setOwnerPhone(e.target.value)}
                                className="bg-transparent border-none p-0 text-sm font-black text-slate-600 outline-none focus:ring-0 w-32"
                                placeholder="9665..."
                            />
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

                    <div className="flex gap-2">
                        <Button 
                            onClick={handleSendOwnerReport} 
                            disabled={!selectedEventId || isSendingReport}
                            className="bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black px-6 h-10 hover:bg-indigo-200 flex items-center gap-2"
                        >
                            {isSendingReport ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bot className="w-4 h-4" />} 
                            إرسال ملخص لصاحب المناسبة
                        </Button>
                        <Button onClick={handleExportExcel} className="bg-emerald-600 text-white rounded-xl text-[10px] font-black px-6 h-10 hover:shadow-lg shadow-emerald-100 flex items-center gap-2">
                            <Download className="w-4 h-4" /> تقرير EXCEL
                        </Button>
                        
                        {/* Meta Quota Monitor Pulse */}
                        <div className="flex items-center gap-3 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-100">
                            <div className="flex flex-col text-left">
                                <span className="text-[8px] font-black text-slate-400 tracking-tighter uppercase whitespace-nowrap">Meta Daily Quota</span>
                                <span className="text-[10px] font-black text-slate-700">{dayUsage} / {metaLimit}</span>
                            </div>
                            <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${(metaLimit > 0 && dayUsage / metaLimit > 0.9) ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${metaLimit > 0 ? Math.min((dayUsage / metaLimit) * 100, 100) : 0}%` }} 
                                />
                            </div>
                            <div className={`w-2 h-2 rounded-full ${dayUsage/metaLimit > 0.9 ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10">
                    {/* Progress Monitor (Top) */}
                    {isSending && (
                        <div className="bg-slate-900 mx-8 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                           <div className="flex flex-col lg:flex-row justify-between items-center gap-10 relative z-10">
                                <div className="flex items-center gap-8">
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-indigo-600/20 rounded-[2rem] flex items-center justify-center border border-indigo-400/30">
                                            <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                                        </div>
                                        <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-lg">V2 LIVE</div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-3xl font-black text-white tracking-tight">جاري الإرسال الآن...</h3>
                                        <p className="text-xs text-slate-400 font-bold flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> 
                                            المستهدف: {totalBatches} ضيف في هذه الحملة
                                        </p>
                                    </div>
                                </div>

                                <div className="flex-1 max-w-2xl w-full">
                                    <div className="flex justify-between items-end mb-3">
                                        <div className="flex flex-col">
                                            <span className="text-4xl font-black text-white">{progress}%</span>
                                            {isSending && (
                                                <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-400/20 animate-pulse">
                                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                    <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">
                                                        {(events.find(e => e.id === selectedEventId)?.campaign_progress?.current_name) || 'Processing...'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="text-left">
                                                <span className="text-[9px] font-black text-emerald-400 uppercase block tracking-widest">SUCCESS</span>
                                                <span className="text-xl font-black text-white">{currentBatchIndex}</span>
                                            </div>
                                            <div className="text-left border-r border-slate-700 pr-4">
                                                <span className="text-[9px] font-black text-rose-400 uppercase block tracking-widest">FAILED</span>
                                                <span className="text-xl font-black text-white">{rsvpStats.failed}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden p-1 border border-slate-700 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full shadow-lg transition-all duration-1000 ease-out relative"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[pulse_1.5s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                           </div>
                           
                           {/* Decorative background shapes */}
                           <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
                           <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
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

                    {/* Search & Filter Bar */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                        <div className="flex-1 w-full relative">
                            <Bot className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="ابحث بالاسم أو رقم الجوال..."
                                className="w-full bg-slate-50 border-none rounded-2xl pr-12 py-3.5 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/10 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto w-full md:w-auto">
                            {(['all', 'confirmed', 'declined', 'failed'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setGuestFilter(filter)}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${guestFilter === filter ? 'bg-white text-indigo-600 shadow-sm border border-slate-100 animate-in fade-in zoom-in duration-300' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {filter === 'all' ? 'الكل' : filter === 'confirmed' ? 'تأكيد الحضور' : filter === 'declined' ? 'المعتذرين' : 'فشل الإرسال'}
                                </button>
                            ))}
                        </div>
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
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">استوديو المتغيرات (AI Studio)</label>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">اسم العريس</label>
                                                    <input value={groomName} onChange={e=>setGroomName(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">اسم العروس</label>
                                                    <input value={brideName} onChange={e=>setBrideName(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">التاريخ</label>
                                                    <input value={eventDate} onChange={e=>setEventDate(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">الوقت</label>
                                                    <input value={eventTime} onChange={e=>setEventTime(e.target.value)} placeholder="مثلاً: 8 مساءً" className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase">الموقع / القاعة</label>
                                                <input value={eventLocation} onChange={e=>setEventLocation(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {!isSending ? (
                                        <div className="space-y-4">
                                            <Button 
                                                onClick={handleStartQueue} 
                                                disabled={loadingGuests || !selectedEventId}
                                                className="w-full h-24 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
                                            >
                                                <Send className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                                <span className="text-xl font-black">إطلاق الدعوات الآن</span>
                                                <span className="text-[9px] font-bold opacity-60 italic">سيتم الإرسال لعدد {guests.length} ضيف</span>
                                            </Button>
                                            
                                            {rsvpStats.failed > 0 && (
                                                <Button 
                                                    onClick={handleRetryAllFailed}
                                                    className="w-full h-12 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black text-xs hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <RefreshCw className="w-4 h-4" /> إعادة إرسال الكل ({rsvpStats.failed}) فاشل
                                                </Button>
                                            )}
                                        </div>
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
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-black text-slate-800 leading-none">تتبع الضيوف لحظياً</h3>
                                            <button 
                                                onClick={() => selectedEventId && fetchGuests(selectedEventId)}
                                                className="p-1.5 hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 rounded-lg transition-all"
                                                title="تحديث البيانات يدوياً"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${loadingGuests ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                            <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">
                                                {realtimeConnected ? 'V2_PRO_TRACKING_ACTIVE' : 'OFFLINE_MODE'}
                                            </span>
                                        </div>
                                    </div>
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
                                    onShowLifecycle={setSelectedGuestForLifecycle}
                                    onSendTest={handleSendTest}
                                />
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Lifecycle Modal */}
            {selectedGuestForLifecycle && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800">دورة حياة الرسالة</h3>
                                <p className="text-xs text-slate-400 font-bold mt-1">تتبع دقيق لكل خطوة لـ: {selectedGuestForLifecycle.name}</p>
                            </div>
                            <button onClick={() => setSelectedGuestForLifecycle(null)} className="p-2 hover:bg-white rounded-full transition-colors border">
                                <RotateCcw className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            {selectedGuestForLifecycle.whatsapp_messages?.length > 0 ? (
                                <div className="space-y-6 relative before:absolute before:right-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                    {selectedGuestForLifecycle.whatsapp_messages.map((m: any, idx: number) => (
                                        <div key={idx} className="relative pr-12 group">
                                            <div className="absolute right-0 top-1 w-8 h-8 rounded-full bg-white border-2 border-indigo-500 shadow-sm z-10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-indigo-100 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{m.message_phase?.toUpperCase() || 'INFO'}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{new Date(m.created_at).toLocaleString('ar-SA')}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-700">{m.message_text || 'إرسال عبر Meta Cloud API'}</p>
                                                <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                                    m.delivery_status === 'read' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                                    m.delivery_status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    'bg-slate-100 text-slate-500 border border-slate-200'
                                                }`}>
                                                    {m.delivery_status === 'read' ? 'تمت القراءة ✅✅' : m.delivery_status === 'delivered' ? 'وصلت للجوال ✅' : 'مرسلة 📤'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center space-y-3 opacity-30">
                                    <Clock className="w-12 h-12 mx-auto text-slate-300" />
                                    <p className="font-bold text-slate-500">لا توجد سجلات بعد لهذا الضيف</p>
                                </div>
                            )}
                        </div>
                        <div className="p-8 border-t bg-slate-50 text-center">
                            <Button onClick={() => setSelectedGuestForLifecycle(null)} className="bg-slate-900 text-white px-8 rounded-xl font-black">إغلاق السجل</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
