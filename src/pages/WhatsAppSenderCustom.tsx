import React, { useState, useEffect, useRef, useMemo } from 'react';
import { pdfService } from '../services/pdf-service';
import {
    CheckCircle, User, RefreshCw, Send, Loader2, RotateCcw,
    AlertTriangle, Mail, MailCheck, Eye, Bot, Sparkles,
    Variable, Palette, Layout, Settings, Share2, Copy,
    Zap, Clock, Shield, Upload, Trash2, Image as ImageIcon, Users, Save,
    Play, Square, LayoutPanelTop, Scan, Download, History, ShieldCheck,
    LayoutGrid, Search, X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { CONFIG } from '../lib/config';
import ConnectionPanel from '../components/WhatsApp/ConnectionPanel';
import GuestTable from '../components/WhatsApp/GuestTable';
import * as XLSX from 'xlsx';
import geminiService from '../services/gemini-service';
import { exportGuestListToCSV } from '../services/ExcelExportService';
import ConversationMirror from '../components/WhatsApp/ConversationMirror';

const API_URL = CONFIG.API_URL;

// --- Sub-Components ---
const StatCard = ({ label, value, color, icon }: any) => {
    const bgMap: any = {
        indigo: 'bg-gradient-to-br from-indigo-50 to-white text-indigo-700 border-indigo-100',
        green: 'bg-gradient-to-br from-emerald-50 to-white text-emerald-700 border-emerald-100',
        purple: 'bg-gradient-to-br from-purple-50 to-white text-purple-700 border-purple-100',
        red: 'bg-gradient-to-br from-rose-50 to-white text-rose-700 border-rose-100',
        gray: 'bg-gradient-to-br from-gray-50 to-white text-gray-700 border-gray-100',
        amber: 'bg-gradient-to-br from-amber-50 to-white text-amber-700 border-amber-100',
        blue: 'bg-gradient-to-br from-blue-50 to-white text-blue-700 border-blue-100',
        sky: 'bg-gradient-to-br from-sky-50 to-white text-sky-700 border-sky-100',
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

export default function WhatsAppSenderCustom() {
    // === STATE ===
    const [events, setEvents] = useState<any[]>([]);
    const [event, setEvent] = useState<any>(null);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    
    // Dynamic Template Settings
    const [templateName, setTemplateName] = useState('get_update');
    const [eventName, setEventName] = useState('');
    const [groomName, setGroomName] = useState('مشاري');
    const [brideName, setBrideName] = useState('رهف');
    
    const [eventDate, setEventDate] = useState('اليوم');
    const [eventLocation, setEventLocation] = useState('الموقع');
    const [locationMapsUrl, setLocationMapsUrl] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [note, setNote] = useState('');
    const [isExtractingAI, setIsExtractingAI] = useState(false);

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
        confirmed: 0, declined: 0, maybe: 0, entered: 0,
        bridging: 0, no_response: 0
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
    const [familyName, setFamilyName] = useState('');
    const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
    const [campaignType, setCampaignType] = useState<'invite' | 'qr_code' | 'official_template' | 'manual_bridge' | 'reminder_pending' | 'reminder_confirmed'>('invite');
    const [targetAudience, setTargetAudience] = useState<'all' | 'unsent' | 'replacements'>('all');
    const [isUploading, setIsUploading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuestForLifecycle, setSelectedGuestForLifecycle] = useState<any>(null);
    const [testPhone, setTestPhone] = useState('');

    const [isStabilizing, setIsStabilizing] = useState(false);
    const [metaMediaId, setMetaMediaId] = useState('');
    const [metaStatus, setMetaStatus] = useState<any>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [guestFilter, setGuestFilter] = useState<'all' | 'confirmed' | 'declined' | 'failed' | 'no_response'>('all');
    const [selectedGuestForMirror, setSelectedGuestForMirror] = useState<any>(null);
    const [financials, setFinancials] = useState({
        totalCost: 0,
        marketingCount: 0,
        utilityCount: 0,
        failedCount: 0
    });
    const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);

    // --- SMART EVENT PICKER STATE ---
    const [eventSearchQuery, setEventSearchQuery] = useState('');
    const [isEventPickerOpen, setIsEventPickerOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredEvents = events.filter(e =>
        (e.name || '').toLowerCase().includes(eventSearchQuery.toLowerCase())
    );

    const isPausedRef = useRef(false);
    const shouldStopRef = useRef(false);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const activeCampaignRef = useRef<{ targetIds: string[], phase: string, startTime: number } | null>(null);

    // Synchronize refs with state for loop access
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { shouldStopRef.current = shouldStop; }, [shouldStop]);

    // === INITIALIZATION ===
    useEffect(() => {
        // Read eventId from URL if present
        const params = new URLSearchParams(window.location.search);
        const urlEventId = params.get('eventId');

        fetchEvents().then(() => {
            if (urlEventId) setSelectedEventId(urlEventId);
        });
        fetchAccounts();
    }, []);

    // Sync state to URL for context preservation
    useEffect(() => {
        if (selectedEventId) {
            const url = new URL(window.location.href);
            url.searchParams.set('eventId', selectedEventId);
            window.history.replaceState({}, '', url.toString());
        }
        setSelectedGuestIds([]);
    }, [selectedEventId]);

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsEventPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (events.length > 0 && selectedEventId) {
            const ev = events.find(x => x.id === selectedEventId);
            if (ev) {
                setEvent(ev);
                setTemplateName(ev.template_name || 'get_update');
                setEventName(ev.name || '');
                setGlobalImageUrl(ev.settings?.global_invite_image_url || '');
                setGroomName(ev.settings?.groom_name || 'مشاري');
                setBrideName(ev.settings?.bride_name || 'رهف');
                setEventDate(ev.date || 'اليوم');
                setEventLocation(ev.location || 'قاعة الاحتفالات');
                setLocationMapsUrl(ev.location_maps_url || '');
                setEventTime(ev.time || '');
                setNote(ev.settings?.note || '');
                setOwnerPhone(ev.owner_phone || ev.settings?.owner_phone || '');
                setFamilyName(ev.settings?.family_name || '');
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
            fetchGuests(selectedEventId); // Automatically load guests when event changes
        }
    }, [events, selectedEventId]);

    const fetchUsage = async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);
        setDayUsage(count || 0);

        // Fetch Financials for the specific event
        if (selectedEventId) {
            const { data: messages } = await supabase
                .from('whatsapp_messages')
                .select('category, status')
                .eq('event_id', selectedEventId);

            if (messages) {
                const marketing = messages.filter(m => m.category === 'marketing' && m.status !== 'failed').length;
                const utility = messages.filter(m => m.category === 'utility' && m.status !== 'failed').length;
                const failed = messages.filter(m => m.status === 'failed').length;

                // Rates: Marketing ~0.11 SAR | Utility ~0.04 SAR
                const calculatedCost = (marketing * 0.113) + (utility * 0.038);

                setFinancials({
                    totalCost: Number(calculatedCost.toFixed(2)),
                    marketingCount: marketing,
                    utilityCount: utility,
                    failedCount: failed
                });
            }
        }

        // Fetch LIVE Quota from Meta
        fetchMetaQuota();
    };

    const fetchMetaQuota = async () => {
        try {
            const res = await fetch('/api/get-meta-quota');
            const data = await res.json();
            if (!data.error) {
                setMetaStatus(data);
                if (data.limit === 'TIER_250') setMetaLimit(250);
                if (data.limit === 'TIER_1000') setMetaLimit(1000);
            }
        } catch (e) {
            console.error('[Meta Quota] Failed to fetch live status');
        }
    };

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        if (selectedEventId) {
            await Promise.all([
                fetchEvents(),
                fetchGuests(selectedEventId),
                fetchUsage(),
                fetchMetaQuota()
            ]);
        }
        setIsRefreshing(false);
        addLog("🔄 تمت مزامنة جميع الحالات والبيانات يدوياً.");
    };

    const handleExportData = () => {
        if (!guests.length) return;
        const ev = events.find(e => e.id === selectedEventId);
        exportGuestListToCSV(guests, ev?.name || 'قائمة_الضيوف');
        addLog("📂 جاري تصدير تقرير الضيوف بصيغة CSV...");
    };

    const handleIndividualResend = async (guestId: string) => {
        const guest = guests.find(g => g.id === guestId);
        if (!guest) return;

        addLog(`🚀 إعادة إرسال فردية لـ: ${guest.name}`);

        try {
            const payload = {
                guestIds: [guestId],
                eventId: selectedEventId,
                campaignType: 'invitation',
                isTest: false
            };

            await fetch('/api/send-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            addLog(`✅ تم طلب إعادة الإرسال لـ ${guest.name}. ستصلك الحالات لحظياً.`);
            setTimeout(() => handleManualRefresh(), 2000);
        } catch (e) {
            addLog(`❌ فشل طلب إعادة الإرسال لـ ${guest.name}`);
        }
    };

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (data) setEvents(data);
    };

    const fetchAccounts = async () => { setAccounts([]); }; // Legacy compatibility

    const fetchGuests = async (eventId: string) => {
        setLoadingGuests(true);
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
            .channel(`sender_custom_updates_${selectedEventId}`)
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

                    if (p.status === 'done') {
                        setIsSending(false);
                        setIsPaused(false);
                        setProgress(100);
                        setCurrentBatchIndex(p.count || 0);
                        setTotalBatches(p.total || 0);
                        addLog(`🏁 ${p.last_log || 'اكتملت الحملة'}`);
                        return;
                    }

                    if (p.status === 'paused') {
                        setIsPaused(true);
                    }

                    const newProgress = p.total > 0 ? Math.round((p.count / p.total) * 100) : 0;
                    setProgress(newProgress);
                    setCurrentBatchIndex(p.count);
                    setTotalBatches(p.total);

                    if (p.last_log) {
                        addLog(`[Cloud Engine] ${p.last_log}`);
                    }
                }

                if (updatedEvent.campaign_status === 'idle' && isSending) {
                    setIsSending(false);
                    addLog("🏁 اكتملت الحملة بنجاح!");
                }
            })
            .subscribe((status) => {
                setRealtimeConnected(status === 'SUBSCRIBED');
            });

        return () => { guestSub.unsubscribe(); };
    }, [selectedEventId]);

    useEffect(() => {
        const failedCount = guests.filter((g: any) => 
            g.status === 'failed' || 
            g.whatsapp_messages?.some((m: any) => m.status === 'failed' || m.delivery_status === 'failed')
        ).length;

        const bridgingCount = guests.filter((g: any) => 
            g.status === 'bridging' || 
            g.whatsapp_messages?.some((m: any) => m.delivery_status === 'bridging')
        ).length;

        const stats = {
            total: guests.length,
            sent: guests.filter((g: any) => g.status === 'sent').length,
            delivered: guests.filter((g: any) => g.whatsapp_messages?.some((m: any) => m.delivery_status === 'delivered' || m.delivery_status === 'read')).length,
            read: guests.filter((g: any) => g.whatsapp_messages?.some((m: any) => m.delivery_status === 'read') || (g.rsvp_status && g.rsvp_status !== 'none' && g.rsvp_status !== 'pending')).length,
            failed: failedCount,
            confirmed: guests.filter((g: any) => g.rsvp_status === 'confirmed').length,
            declined: guests.filter((g: any) => g.rsvp_status === 'declined').length,
            maybe: guests.filter((g: any) => g.rsvp_status === 'maybe').length,
            entered: guests.filter((g: any) => g.checked_in).length,
            bridging: bridgingCount,
            no_response: guests.filter((g: any) => {
                const isSentOrReached = g.status === 'sent' || g.whatsapp_messages?.some((m: any) => m.delivery_status === 'delivered' || m.delivery_status === 'read');
                const noRsvp = !g.rsvp_status || g.rsvp_status === 'none' || g.rsvp_status === 'pending';
                const isNotFailed = g.status !== 'failed' && !g.whatsapp_messages?.some((m: any) => m.status === 'failed' || m.delivery_status === 'failed');
                return isSentOrReached && noRsvp && isNotFailed;
            }).length
        };
        setRsvpStats(stats);
    }, [guests]);

    const addLog = (msg: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString('ar-SA')} - ${msg}`]);
        setTimeout(() => logContainerRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleEventSelect = async (e: any) => {
        const id = e.target.value;
        setSelectedEventId(id);

        setIsSending(false);
        setIsPaused(false);
        setProgress(0);
        setCurrentBatchIndex(0);
        setTotalBatches(0);
        setLogs([]);

        if (id) {
            fetchGuests(id);

            const { data } = await supabase.from('events')
                .select('*')
                .eq('id', id).single();

            if (data) {
                setTemplateName(data.template_name || 'get_update');
                setEventName(data.name || '');
                if (data.settings?.global_invite_image_url) setGlobalImageUrl(data.settings.global_invite_image_url);
                if (data.settings?.meta_media_id) setMetaMediaId(data.settings.meta_media_id);
                if (data.settings?.groom_name) setGroomName(data.settings.groom_name);
                if (data.settings?.bride_name) setBrideName(data.settings.bride_name);
                if (data.settings?.event_time) setEventTime(data.settings.event_time);
                if (data.settings?.note) setNote(data.settings.note);
                else setNote('');
                if (data.owner_phone) setOwnerPhone(data.owner_phone);
                if (data.date) setEventDate(data.date);
                if (data.location) setEventLocation(data.location);
                if (data.location_maps_url) setLocationMapsUrl(data.location_maps_url);
                if (data.priority_level) setPriority(data.priority_level);
                if (data.daily_budget) setDailyBudget(data.daily_budget);

                if (data?.campaign_status === 'sending') {
                    setIsSending(true);
                    const p = data.campaign_progress;
                    if (p) {
                        setProgress(p.total > 0 ? Math.round((p.count / p.total) * 100) : 0);
                        setCurrentBatchIndex(p.count || 0);
                        setTotalBatches(p.total || 0);
                        addLog(`📡 استعادة حالة الحملة: ${p.current_name || 'جاري الإرسال...'} (${p.count}/${p.total})`);
                    }
                } else if (data?.campaign_status === 'paused') {
                    setIsSending(true);
                    setIsPaused(true);
                    addLog('⏸️ الحملة متوقفة مؤقتاً');
                } else if (data?.campaign_progress?.status === 'done') {
                    const p = data.campaign_progress;
                    addLog(`🏁 آخر حملة: ${p.last_log || 'اكتملت'}`);
                }
            }
        }
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
                const publicUrl = data.publicUrl;
                setGlobalImageUrl(publicUrl);
                setMetaMediaId('');

                if (selectedEventId) {
                    const { data: ev } = await supabase.from('events').select('settings').eq('id', selectedEventId).single();
                    const newSettings = { ...(ev?.settings || {}), global_invite_image_url: publicUrl, meta_media_id: '' };
                    await supabase.from('events').update({ settings: newSettings }).eq('id', selectedEventId);
                    addLog('✅ تم رفع وحفظ خلفية الدعوة تلقائياً في قاعدة البيانات!');
                } else {
                    addLog('✅ تم رفع الصورة بنجاح (سيتم حفظها عند اختيار مناسبة)');
                }
            }
        } catch (err) { }
        setIsUploading(false);
    };

    const handleStabilizeImage = async () => {
        if (!globalImageUrl || !selectedEventId) return alert('الرجاء رفع صورة واختيار مناسبة أولاً');
        setIsStabilizing(true);
        addLog('📤 جاري تثبيت الصورة في سيرفرات فيسبوك (Meta)...');
        try {
            const res = await fetch('/api/upload-meta-media', {
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
            const extract = await geminiService.extractInvitationDetails(globalImageUrl);
            if (extract) {
                if (extract.groom) setGroomName(extract.groom);
                if (extract.bride) setBrideName(extract.bride);
                if (extract.date) setEventDate(extract.date);
                if (extract.location) setEventLocation(extract.location);
                if (extract.time) setEventTime(extract.time);

                addLog('✨ تم استخراج البيانات بنجاح! راجع الحقول وقم بتعديل ما تراه غير دقيق.');
            }
        } catch (e: any) {
            console.error(e);
            addLog('❌ فشل الذكاء الاصطناعي في قراءة الصورة، يرجى تعبئتها يدوياً.');
        }
        setIsExtractingAI(false);
    };

    const handleExportExcel = () => {
        const exportData = guests.map(g => {
            return {
                'الاسم': g.name,
                'الجوال': g.phone,
                'الحالة': g.rsvp_status,
                'حالة الإرسال': g.status,
                'تاريخ الإضافة': g.created_at
            };
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'الضيوف');
        XLSX.writeFile(wb, `قائمة_الضيوف_${new Date().toLocaleDateString()}.xlsx`);
    };

    const handleExportFiltered = (filterType: string) => {
        let targetGuests = guests;
        if (filterType === 'confirmed') targetGuests = guests.filter(g => g.rsvp_status === 'confirmed');
        else if (filterType === 'declined') targetGuests = guests.filter(g => g.rsvp_status === 'declined');
        else if (filterType === 'failed') targetGuests = guests.filter(g => g.status === 'failed' || g.whatsapp_messages?.some((m: any) => m.status === 'failed'));
        else if (filterType === 'no_response') {
            targetGuests = guests.filter(g => 
                (g.status === 'sent' || g.status === 'delivered' || g.status === 'read') && 
                (!g.rsvp_status || g.rsvp_status === 'none' || g.rsvp_status === 'pending')
            );
        }

        const exportData = targetGuests.map(g => {
            const lastMsg = g.whatsapp_messages?.[g.whatsapp_messages.length - 1];
            return {
                'الاسم': g.name,
                'الجوال': g.phone,
                'الحالة النهائية': g.rsvp_status === 'confirmed' ? '✅ مؤكد' : g.rsvp_status === 'declined' ? '❌ معتذر' : '⏳ بانتظار الرد',
                'حالة الإرسال': g.status,
                'آخر تحديث من ميتا': lastMsg?.delivery_status || '--',
                'سبب الفشل (إن وجد)': lastMsg?.error_message || ''
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `تقرير_${filterType}`);
        XLSX.writeFile(wb, `تقرير_لوني_${filterType}_${new Date().toLocaleDateString()}.xlsx`);
    };

    const handleDirectSend = async (guest: any) => {
        if (!selectedEventId) return;
        await handleUpdateSettings();
        addLog(`📤 إرسال فوري عبر Meta لـ ${guest.name}...`);
        try {
            const res = await fetch(`/api/send-batch-v2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: [guest.id],
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            const dataText = await res.text();
            let data: any = {};
            try { data = JSON.parse(dataText); } catch(e) { data = { error: `Server error (${res.status})` }; }
            
            if (res.ok && data.success) addLog(`✅ الطلب نُفذ بنجاح لـ ${guest.name}`);
            else addLog(`❌ فشل الطلب لـ ${guest.name}: ${data.error || `خطأ (${res.status})`}`);
        } catch (e) {
            addLog(`⚠️ خطأ في الاتصال بالسيرفر`);
        }
    };

    const handleSendTest = async (guest: any) => {
        const phone = prompt('أدخل رقم الجوال الذي تريد استلام التجربة عليه (مثال: 966...):', ownerPhone || '96650...');
        if (!phone) return;

        await handleUpdateSettings();
        addLog(`🎯 إرسال تجربة لـ ${guest.name} إلى الرقم ${phone}...`);
        try {
            const res = await fetch(`/api/send-batch-v2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: [guest.id],
                    eventId: selectedEventId,
                    campaignType: campaignType,
                    testPhone: phone
                })
            });
            const dataText = await res.text();
            let data: any = {};
            try { data = JSON.parse(dataText); } catch(e) { data = { error: `Server error (${res.status})` }; }
            
            if (res.ok && data.success) addLog(`✅ تم إرسال التجربة بنجاح لـ ${phone}`);
            else addLog(`❌ فشل إرسال التجربة: ${data.error || `خطأ (${res.status})`}`);
        } catch (e) {
            addLog(`⚠️ خطأ في إرسال التجربة`);
        }
    };

    const handleRetryAllFailed = async () => {
        const failedGuests = guests.filter(g => g.status === 'failed' || g.whatsapp_messages?.some((m: any) => m.status === 'failed'));
        if (failedGuests.length === 0) return alert('لا يوجد ضيوف بحالة "فشل" لإعادة الإرسال لهم');

        if (!window.confirm(`هل أنت متأكد من إعادة إرسال الدعوة لعدد ${failedGuests.length} ضيف فشل إرسالهم سابقاً؟`)) return;

        addLog(`🔄 جاري البدء في إعادة إرسال ${failedGuests.length} دعوة فاشلة...`);
        try {
            const res = await fetch(`/api/send-batch-v2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: failedGuests.map(g => g.id),
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setIsSending(true);
                addLog(`✅ بدأت حملة الإعادة بنجاح.`);
            } else {
                addLog(`❌ فشل الإرسال الجماعي: ${data.error || 'خطأ غير معروف'}`);
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
            const res = await fetch('/api/owner-report', {
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
            global_invite_image_url: globalImageUrl,
            meta_media_id: metaMediaId,
            event_time: eventTime,
            family_name: familyName,
            note: note
        };
        const { error } = await supabase.from('events').update({
            name: eventName,
            settings,
            date: eventDate,
            location: eventLocation,
            location_maps_url: locationMapsUrl,
            event_time: eventTime,
            owner_phone: ownerPhone,
            groom_name: groomName,
            bride_name: brideName,
            priority_level: priority,
            daily_budget: dailyBudget,
            template_name: templateName
        }).eq('id', selectedEventId);

        if (error) addLog(`❌ فشل التحديث: ${error.message}`);
        else {
            addLog("✅ تم حفظ المتغيرات وقالب الإرسال للمناسبة!");
            fetchEvents();
        }
    };

    const handleDeleteGuest = async (guest: any) => {
        if (!window.confirm(`هل أنت متأكد من حذف الضيف "${guest.name}" نهائياً من القائمة؟`)) return;

        try {
            const { error } = await supabase.from('guests').delete().eq('id', guest.id);
            if (error) throw error;
            addLog(`🗑️ تم حذف الضيف ${guest.name} بنجاح.`);
            setGuests(prev => prev.filter(g => g.id !== guest.id));
        } catch (e: any) {
            addLog(`❌ فشل حذف الضيف: ${e.message}`);
            alert('حدث خطأ أثناء الحذف');
        }
    };

    const handleRemoveDuplicates = async () => {
        if (!selectedEventId || guests.length === 0) return;

        if (!window.confirm(`هل أنت متأكد من حذف الأسماء والأرقام المكررة من هذه القائمة؟ سيبقى نسخة واحدة فقط لكل ضيف.`)) return;

        addLog('🔍 جاري فحص القائمة عن الأسماء والأرقام المكررة...');

        const seen = new Set();
        const duplicates = [];

        for (const guest of guests) {
            const cleanPhone = (guest.phone || '').trim().replace(/\D/g, '');
            const cleanName = (guest.name || '').trim();
            const key = `${cleanName}-${cleanPhone}`;

            if (seen.has(key)) {
                duplicates.push(guest.id);
            } else {
                seen.add(key);
            }
        }

        if (duplicates.length === 0) {
            addLog('✨ لم يتم العثور على أي مكررات في القائمة.');
            return alert('القائمة نظيفة بالفعل!');
        }

        addLog(`🗑️ جاري حذف ${duplicates.length} سجل مكرر من قاعدة البيانات...`);

        try {
            const { error } = await supabase
                .from('guests')
                .delete()
                .in('id', duplicates);

            if (error) throw error;

            addLog(`✅ تم تنظيف القائمة بنجاح! تم حذف ${duplicates.length} سجل مكرر.`);
            fetchGuests(selectedEventId);
        } catch (e: any) {
            addLog(`❌ فشل تنظيف القائمة: ${e.message}`);
            alert('حدث خطأ أثناء محاولة الحذف: ' + e.message);
        }
    };

    const filteredGuests = useMemo(() => {
        return guests.filter(g => {
            const matchesSearch = (g.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (g.phone || '').includes(searchQuery);
            if (!matchesSearch) return false;
            
            if (guestFilter === 'failed') return g.status === 'failed' || g.whatsapp_messages?.some((m: any) => m.status === 'failed' || m.delivery_status === 'failed');
            if (guestFilter === 'confirmed') return g.rsvp_status === 'confirmed';
            if (guestFilter === 'declined') return g.rsvp_status === 'declined';
            if (guestFilter === 'no_response') {
                const isSentOrReached = g.status === 'sent' || g.whatsapp_messages?.some((m: any) => m.delivery_status === 'delivered' || m.delivery_status === 'read');
                const noRsvp = !g.rsvp_status || g.rsvp_status === 'none' || g.rsvp_status === 'pending';
                return isSentOrReached && noRsvp;
            }
            return true;
        });
    }, [guests, searchQuery, guestFilter]);

    const isAllSelected = filteredGuests.length > 0 && filteredGuests.every(g => selectedGuestIds.includes(g.id));

    const handleToggleSelectAll = () => {
        const visibleIds = filteredGuests.map(g => g.id);
        if (isAllSelected) {
            setSelectedGuestIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedGuestIds(prev => {
                const next = [...prev];
                visibleIds.forEach(id => {
                    if (!next.includes(id)) next.push(id);
                });
                return next;
            });
        }
    };

    const handleToggleSelect = (guestId: string) => {
        setSelectedGuestIds(prev =>
            prev.includes(guestId)
                ? prev.filter(id => id !== guestId)
                : [...prev, guestId]
        );
    };

    const handleBulkRetry = async () => {
        if (selectedGuestIds.length === 0) return alert('الرجاء اختيار ضيوف أولاً لإعادة الإرسال');
        if (!window.confirm(`هل أنت متأكد من إعادة إرسال المحاولة لعدد ${selectedGuestIds.length} ضيف محدد؟`)) return;

        await handleUpdateSettings();
        addLog(`🔄 البدء في إعادة إرسال لـ ${selectedGuestIds.length} ضيف محدد...`);
        try {
            const res = await fetch(`/api/send-batch-v2`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestIds: selectedGuestIds,
                    eventId: selectedEventId,
                    campaignType: campaignType
                })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setIsSending(true);
                addLog(`✅ بدأت حملة إعادة الإرسال الجماعية لـ ${selectedGuestIds.length} ضيف.`);
                setSelectedGuestIds([]);
            } else {
                addLog(`❌ فشل الإرسال الجماعي: ${data.error || 'خطأ غير معروف'}`);
            }
        } catch (e) {
            addLog(`⚠️ خطأ في عملية الإرسال الجماعي المحدد`);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedGuestIds.length === 0) return alert('الرجاء اختيار ضيوف أولاً للحذف');
        if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف عدد ${selectedGuestIds.length} ضيف محدد نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

        addLog(`🗑️ جاري حذف عدد ${selectedGuestIds.length} ضيف من قاعدة البيانات...`);
        try {
            const { error } = await supabase
                .from('guests')
                .delete()
                .in('id', selectedGuestIds);

            if (error) throw error;

            addLog(`✅ تم حذف عدد ${selectedGuestIds.length} ضيف بنجاح.`);
            setGuests(prev => prev.filter(g => !selectedGuestIds.includes(g.id)));
            setSelectedGuestIds([]);
        } catch (e: any) {
            addLog(`❌ فشل حذف الضيوف المحددّين: ${e.message}`);
            alert('حدث خطأ أثناء محاولة الحذف الجماعي');
        }
    };

    const handleExportPDF = async () => {
        if (!event || !guests.length) return;
        addLog('📄 جاري تصدير كشف الحضور بصيغة PDF...');
        try {
            await pdfService.generateAttendanceReport({
                eventName: eventName || event.name || 'مناسبة لوني الفاخرة',
                eventDate: eventDate || event.date || '',
                venue: eventLocation || event.location || 'القاعة المخصصة',
                totalGuests: guests.length,
                attendedCount: guests.filter(g => g.has_entered).length,
                remainingCount: guests.filter(g => !g.has_entered).length,
                guests: guests
            });
            addLog('✅ تم تصدير ملف PDF بنجاح.');
        } catch (e: any) {
            addLog(`❌ فشل تصدير PDF: ${e.message}`);
            alert('حدث خطأ أثناء تصدير ملف PDF');
        }
    };

    const handleStartQueue = async () => {
        if (!selectedEventId) {
            addLog('⚠️ الرجاء اختيار المناسبة أولاً من أعلى الشاشة');
            return alert('الرجاء اختيار المناسبة');
        }

        // Auto update settings before starting to ensure DB is in sync
        await handleUpdateSettings();

        setIsSending(true);
        setIsPaused(false);
        setShouldStop(false);
        addLog(`🚀 جاري إطلاق حملة ${campaignType === 'invite' ? 'الدعوات' : campaignType === 'qr_code' ? 'الكروت' : 'الرسمية'}...`);

        try {
            const res = await fetch('/api/send-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    campaignType: campaignType,
                    targetAudience: targetAudience
                })
            });

            const data = await res.json();
            if (data.success) {
                addLog('📡 تم تسجيل الحملة وتمريرها لمحرك الإرسال السحابي بنجاح!');
            } else {
                setIsSending(false);
                addLog(`❌ تعذر تشغيل الحملة: ${data.error}`);
            }
        } catch (e: any) {
            setIsSending(false);
            addLog(`⚠️ خطأ في الاتصال بخادم الحملات: ${e.message}`);
        }
    };

    const handlePause = async () => {
        if (!selectedEventId) return;
        const newPauseState = !isPaused;
        setIsPaused(newPauseState);
        addLog(newPauseState ? '⏸️ إرسال طلب إيقاف مؤقت للحملة...' : '▶️ إرسال طلب استئناف الحملة...');

        try {
            await fetch('/api/control-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId, action: newPauseState ? 'pause' : 'resume' })
            });
        } catch (e) {
            addLog('⚠️ فشل تغيير حالة الإيقاف المؤقت بالسيرفر');
        }
    };

    const handleStop = async () => {
        if (!selectedEventId) return;
        if (!window.confirm('هل أنت متأكد من إيقاف وإلغاء الحملة الحالية نهائياً؟')) return;
        setShouldStop(true);
        setIsSending(false);
        setIsPaused(false);
        addLog('🛑 إرسال طلب إلغاء فوري للحملة...');

        try {
            await fetch('/api/control-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId, action: 'stop' })
            });
            addLog('✅ تم إلغاء الحملة.');
        } catch (e) {
            addLog('⚠️ فشل إرسال طلب إلغاء الحملة');
        }
    };

    const handleRetryUncertain = async () => {
        if (!selectedEventId) return;
        addLog('🔍 جاري التحقق من وجود ضيوف عالقين بحالة معلقة لإعادة تفعيلهم...');
        
        const stuckGuests = guests.filter(g => {
            const isPendingOrSending = g.status === 'sending' || g.status === 'bridging';
            const lastMessageFailed = g.whatsapp_messages?.some((m: any) => m.status === 'failed' || m.delivery_status === 'failed');
            return isPendingOrSending || lastMessageFailed;
        });

        if (stuckGuests.length === 0) {
            addLog('✨ لا يوجد ضيوف بحالة عالقة أو معلقة حالياً.');
            return alert('لا يوجد ضيوف عالقين بحاجة لمعالجة');
        }

        if (window.confirm(`هل ترغب في إعادة إرسال المحاولة لعدد ${stuckGuests.length} ضيف عالق؟`)) {
            try {
                const res = await fetch(`/api/send-batch-v2`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guestIds: stuckGuests.map(g => g.id),
                        eventId: selectedEventId,
                        campaignType: campaignType
                    })
                });
                if (res.ok) addLog(`✅ جاري العمل على فك العلوق لـ ${stuckGuests.length} ضيف.`);
            } catch (e: any) {
                addLog(`❌ فشل معالجة العلوق: ${e.message}`);
            }
        }
    };

    return (
        <div className="flex bg-slate-50 h-screen w-full overflow-hidden text-right font-sans" dir="rtl">
            {/* Sidebar Controls */}
            <aside className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">
                <div className="p-6 border-b bg-gradient-to-b from-indigo-50/50 to-white">
                    <div className="flex items-center gap-2 mb-6">
                        <Play className="w-6 h-6 text-indigo-600" />
                        <h2 className="font-black text-slate-800 text-lg">بوابة تخصيص القوالب</h2>
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
                                    {isStabilizing ? <Loader2 className="w-3 h-3 animate-spin" /> : metaMediaId ? <Shield className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                    {metaMediaId ? 'تم التثبيت (Meta ID)' : 'تثبيت الصورة (Meta Stability)'}
                                </Button>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إعدادات وقالب المناسبة</label>
                                <button
                                    onClick={handleAIExtract}
                                    disabled={isExtractingAI || !globalImageUrl}
                                    className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded mt-[-5px] hover:bg-indigo-100 transition text-[9px] font-bold flex items-center gap-1 disabled:opacity-50"
                                >
                                    {isExtractingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                    AI قراءة
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {/* Template Selector */}
                                <div>
                                    <label className="text-[9px] text-indigo-600 font-black block mb-1">قالب الإرسال (WhatsApp Template)</label>
                                    <select 
                                        value={templateName} 
                                        onChange={e => setTemplateName(e.target.value)} 
                                        className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-2 py-2 text-[10px] font-black outline-none focus:ring-2 ring-indigo-500/20"
                                    >
                                        <option value="get_update">زفاف آل فلان (get_update - 5 متغيرات)</option>
                                        <option value="lony_generic">دعوة مناسبة عامة (lony_generic - 5 متغيرات)</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">الأولوية</label>
                                        <select value={priority} onChange={e => setPriority(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none">
                                            <option value={1}>عاجل جداً 🔥</option>
                                            <option value={2}>مرتفع ⬆️</option>
                                            <option value={3}>عادي 🟢</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">ميزانية اليوم</label>
                                        <input type="number" value={dailyBudget} onChange={e => setDailyBudget(parseInt(e.target.value))} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                    </div>
                                </div>

                                {/* Conditional Render based on template */}
                                {templateName === 'get_update' ? (
                                    <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                                        <div>
                                            <label className="text-[9px] text-slate-400 block mb-1">اسم العريس</label>
                                            <input type="text" value={groomName} onChange={e => setGroomName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-slate-400 block mb-1">اسم العروس</label>
                                            <input type="text" value={brideName} onChange={e => setBrideName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 animate-in fade-in duration-300">
                                        <div>
                                            <label className="text-[9px] text-slate-400 block mb-1">اسم المناسبة (مثال: حفل تخرج سارة)</label>
                                            <input type="text" value={eventName || ''} onChange={e => setEventName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                        </div>
                                        <div>
                                            <label className="text-[9px] text-slate-400 block mb-1">ملاحظة الدعوة (Note - المتغير الخامس في القالب)</label>
                                            <input type="text" value={note || ''} onChange={e => setNote(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[9px] text-slate-400 block mb-1">اسم القاعة / الموقع (نص)</label>
                                    <input type="text" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                </div>

                                <div>
                                    <label className="text-[9px] text-indigo-500 font-black block mb-1">رابط جوجل ماب (Google Maps URL)</label>
                                    <input 
                                        type="text" 
                                        value={locationMapsUrl} 
                                        onChange={e => setLocationMapsUrl(e.target.value)} 
                                        placeholder="الصقي الرابط هنا..."
                                        className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none focus:ring-2 ring-indigo-500/20" 
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">التاريخ</label>
                                        <input type="text" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-400 block mb-1">الوقت</label>
                                        <input type="text" value={eventTime} onChange={e => setEventTime(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                    </div>
                                </div>

                                <Button onClick={handleUpdateSettings} className="w-full bg-indigo-600 text-white h-9 rounded-xl font-black text-[10px] mt-2">حفظ التعديلات</Button>
                            </div>

                            {/* WhatsApp Live Preview Mockup */}
                            <div className="bg-[#E5DDD5] p-4 rounded-[2rem] border border-slate-200 relative overflow-hidden shadow-inner mt-6">
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
                                        <div className="bg-[#D9FDD3] p-3 rounded-tr-none rounded-2xl text-[10px] font-bold leading-relaxed text-slate-800 shadow-sm border border-emerald-100 text-right" dir="rtl">
                                            {templateName === 'get_update' ? (
                                                <>
                                                    أهلاً بك يا [اسم الضيف] 🌺<br />
                                                    ندعوكم لحضور حفل زفاف {groomName} و {brideName} يوم {eventDate} في {eventLocation} في تمام الساعة {eventTime}...
                                                </>
                                            ) : (
                                                <>
                                                    السلام عليكم ورحمة الله وبركاته،<br />
                                                    ضيفنا الغالي: [اسم الضيف]<br /><br />
                                                    نتشرف بدعوتكم لحضور ومشاركتنا فرحتنا في {eventName || '[اسم المناسبة]'}، حضوركم يكمل بهجتنا ويسعد قلوبنا.<br /><br />
                                                    📅 التاريخ: {eventDate}<br />
                                                    📍 الموقع: {eventLocation}<br /><br />
                                                    💡 يرجى تأكيد حضوركم أو الاعتذار بالضغط على الأزرار المرفقة أدناه.<br />
                                                    ⚠️ ملاحظة: {note || 'في حال عدم الرد خلال 3 أيام من استلام الدعوة، نعتذر منكم حيث سيتم إلغاء الدعوة تلقائياً نظراً لمحدودية المقاعد.'}<br /><br />
                                                    حضوركم شرف وتأكيد حضوركم يسعدنا 🌹
                                                </>
                                            )}
                                            <div className="mt-2 pt-2 border-t border-emerald-200/50 flex flex-col gap-2">
                                                <div className="bg-white py-1.5 rounded-lg text-center text-indigo-600 text-[10px] shadow-sm border border-indigo-50">✅ تأكيد الحضور</div>
                                                <div className="bg-white py-1.5 rounded-lg text-center text-rose-600 text-[10px] shadow-sm border border-slate-50">❌ اعتذار عن الحضور</div>
                                                <div className="bg-white py-1.5 rounded-lg text-center text-indigo-600 text-[10px] shadow-sm border border-indigo-50">📍 موقع المناسبة</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    <div className="w-full space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">الفئة المستهدفة</label>
                            <select value={targetAudience} onChange={(e: any) => setTargetAudience(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 ring-indigo-500/20">
                                <option value="all">كل الضيوف</option>
                                <option value="replacements">المستبدلين فقط 🆕</option>
                                <option value="unsent">الذين لم يستلموا بعد</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">مرحلة الرسالة (V2 Sandbox)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setCampaignType('invite')} className={`py-3 rounded-xl border text-[9px] font-black transition-all ${campaignType === 'invite' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-slate-500'}`}>الدعوات</button>
                                <button onClick={() => setCampaignType('qr_code')} className={`py-3 rounded-xl border text-[9px] font-black transition-all ${campaignType === 'qr_code' ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-white text-slate-500'}`}>الكروت</button>
                                <button onClick={() => setCampaignType('official_template')} className={`py-3 rounded-xl border text-[9px] font-black transition-all ${campaignType === 'official_template' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-500'}`}>رسمي (ميتا)</button>
                                <button onClick={() => setCampaignType('manual_bridge')} className={`py-3 rounded-xl border text-[9px] font-black transition-all ${campaignType === 'manual_bridge' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-100' : 'bg-white text-slate-500'}`}>الجسر اليدوي 🌉</button>
                            </div>

                            {campaignType === 'manual_bridge' && (
                                <div className="mt-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">تخصيص اسم العائلة (الجسر)</label>
                                        <button 
                                            onClick={async () => {
                                                setIsUpdatingSettings(true);
                                                try {
                                                    const newSettings = { ...(event?.settings || {}), family_name: familyName };
                                                    await supabase.from('events').update({ settings: newSettings }).eq('id', selectedEventId);
                                                    alert('تم الحفظ ✅');
                                                } catch (e) {
                                                    alert('خطأ في الحفظ');
                                                } finally {
                                                    setIsUpdatingSettings(false);
                                                }
                                            }}
                                            className="p-1.5 bg-white hover:bg-amber-100 rounded-lg text-amber-600 border border-amber-200 transition-all shadow-sm"
                                            disabled={isUpdatingSettings}
                                        >
                                            {isUpdatingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={familyName}
                                            onChange={e => setFamilyName(e.target.value)}
                                            className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2.5 text-xs font-black outline-none focus:ring-2 ring-amber-500/20"
                                            placeholder="اكتب اسم العائلة هنا (مثال: الفلان)..."
                                        />
                                        <p className="text-[9px] font-bold text-amber-500 mt-1 italic">
                                            💡 سيظهر للضيف: "لديك دعوة من زفاف آل <span className="underline">{familyName || '...'}</span>"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
                            <label className="text-[10px] font-black text-amber-600 uppercase block tracking-widest flex items-center gap-2"><Settings className="w-3 h-3" /> مركز المتابعة (Follow-up)</label>
                            <div className="grid grid-cols-1 gap-2">
                                <Button
                                    onClick={() => { setCampaignType('reminder_pending'); setTargetAudience('unsent'); handleStartQueue(); }}
                                    className="bg-white border-amber-200 text-amber-700 h-8 text-[10px] font-black hover:bg-amber-100"
                                    variant="outline"
                                >
                                    🔔 تذكير من لم يرد (Pending)
                                </Button>
                                <Button
                                    onClick={() => { setCampaignType('reminder_confirmed'); setTargetAudience('all'); handleStartQueue(); }}
                                    className="bg-white border-indigo-200 text-indigo-700 h-8 text-[10px] font-black hover:bg-indigo-100"
                                    variant="outline"
                                >
                                    🎫 تذكير ليلة الحفل (Confirmed)
                                </Button>
                            </div>
                        </div>

                        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                            <label className="text-[10px] font-black text-emerald-600 uppercase block tracking-widest flex items-center gap-2"><Bot className="w-3 h-3" /> أتمتة الردود الذكية</label>
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                                <span>إرسال الباركود آلياً عند التأكيد</span>
                                <div className="w-8 h-4 bg-emerald-500 rounded-full relative shadow-inner"><div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full shadow-sm"></div></div>
                            </div>
                        </div>

                        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
                            <label className="text-[10px] font-black text-amber-600 uppercase block tracking-widest flex items-center gap-2"><Mail className="w-3 h-3" /> هاتف تقارير العميل</label>
                            <input
                                type="text"
                                value={ownerPhone}
                                onChange={e => setOwnerPhone(e.target.value)}
                                placeholder="9665..."
                                className="w-full bg-white border border-amber-100 rounded-xl px-3 py-2 text-[10px] font-black outline-none focus:ring-2 ring-amber-500/20"
                            />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col relative" ref={dropdownRef}>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المناسبة الحالية</label>

                            <div
                                onClick={() => setIsEventPickerOpen(!isEventPickerOpen)}
                                className="group flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2 cursor-pointer transition-all duration-300 min-w-[240px]"
                            >
                                <LayoutGrid className="w-4 h-4 text-indigo-500" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[11px] font-black text-slate-800 line-clamp-1">
                                        {events.find(e => e.id === selectedEventId)?.name || 'اختر مناسبة لبدء العمل..'}
                                    </span>
                                    {selectedEventId && (
                                        <span className="text-[9px] font-bold text-slate-400">
                                            {events.find(e => e.id === selectedEventId)?.date || ''}
                                        </span>
                                    )}
                                </div>
                                <Search className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isEventPickerOpen ? 'rotate-180' : ''}`} />
                            </div>

                            {isEventPickerOpen && (
                                <div className="absolute top-[calc(100%+8px)] right-0 w-[320px] bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl z-[100] overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                                    <div className="p-3 border-b border-slate-100/50">
                                        <div className="relative">
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={eventSearchQuery}
                                                onChange={(e) => setEventSearchQuery(e.target.value)}
                                                placeholder="ابحث عن مناسبة..."
                                                className="w-full bg-slate-100/50 border-none rounded-xl pr-9 pl-4 py-2.5 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-indigo-500/10 transition-all"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>

                                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                        {filteredEvents.length > 0 ? (
                                            filteredEvents.map(e => (
                                                <button
                                                    key={e.id}
                                                    onClick={() => {
                                                        setSelectedEventId(e.id);
                                                        fetchGuests(e.id);
                                                        setIsEventPickerOpen(false);
                                                        setEventSearchQuery('');
                                                    }}
                                                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-right ${selectedEventId === e.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'}`}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black">{e.name}</span>
                                                        <span className={`text-[9px] font-bold ${selectedEventId === e.id ? 'text-indigo-100' : 'text-slate-400'}`}>{e.date}</span>
                                                    </div>
                                                    {selectedEventId === e.id && <CheckCircle className="w-3.5 h-3.5" />}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center flex flex-col items-center gap-3">
                                                <AlertTriangle className="w-8 h-8 text-slate-200" />
                                                <span className="text-[10px] font-bold text-slate-400">لا توجد مناسبات تطابق بحثك</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="h-10 w-[1px] bg-slate-100 mx-2" />

                        <div className="hidden md:flex items-center gap-6 px-4 bg-slate-50/50 border border-slate-100 rounded-2xl py-1.5">
                            <div className="flex flex-col items-end gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">الكوتا الحالية (Meta)</span>
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-24 h-2 bg-slate-200/50 rounded-full overflow-hidden border border-white">
                                        <div
                                            className={`h-full transition-all duration-1000 ${dayUsage > 220 ? 'bg-rose-500' : dayUsage > 180 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                            style={{ width: `${Math.min((dayUsage / metaLimit) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-700 font-mono">{dayUsage}/{metaLimit}</span>
                                </div>
                            </div>
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
                                <button onClick={handlePause} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                                    {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />}
                                </button>
                                <button onClick={handleStop} className="p-1.5 bg-rose-900/40 hover:bg-rose-600 rounded-lg transition-colors">
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
                            {isSendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                            إرسال ملخص لصاحب المناسبة
                        </Button>
                        <Button onClick={handleExportExcel} className="bg-emerald-600 text-white rounded-xl text-[10px] font-black px-6 h-10 hover:shadow-lg shadow-emerald-100 flex items-center gap-2">
                            <Download className="w-4 h-4" /> تقرير EXCEL
                        </Button>
                        <Button onClick={handleExportPDF} className="bg-indigo-600 text-white rounded-xl text-[10px] font-black px-6 h-10 hover:shadow-lg shadow-indigo-100 flex items-center gap-2">
                            <Download className="w-4 h-4" /> تقرير PDF
                        </Button>

                        <Button
                            onClick={handleRemoveDuplicates}
                            disabled={!selectedEventId || guests.length === 0}
                            className="bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[10px] font-black px-6 h-10 hover:bg-rose-100 flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> تنظيف المكررات
                        </Button>

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
                            <div className={`w-2 h-2 rounded-full ${dayUsage / metaLimit > 0.9 ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`} />
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8 lg:p-10 space-y-10">
                    <div className="flex flex-wrap items-center gap-4 mb-8">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                لوحة تحكم مخصصة (Custom Templates)
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black border transition-all ${realtimeConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                    {realtimeConnected ? 'متصل حيّ' : 'غير متصل'}
                                </span>
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">فريق العمل والعمليات الميدانية</p>
                        </div>

                        {metaStatus && (
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">حالة ميتا</span>
                                    <span className={`text-[10px] font-black ${metaStatus.status === 'CONNECTED' ? 'text-emerald-600' : 'text-rose-500'}`}>{metaStatus.status}</span>
                                </div>
                                <div className="h-6 w-[1px] bg-slate-100 mx-1" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">الجودة</span>
                                    <span className="text-[10px] font-black text-indigo-600">{metaStatus.quality}</span>
                                </div>
                                <div className="h-6 w-[1px] bg-slate-100 mx-1" />
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-indigo-600 z-10" title="Messaging Tier">
                                        {metaStatus.limit?.replace('TIER_', '')}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] shadow-sm z-0 ${metaStatus.quality === 'GREEN' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                        <Zap className="w-3 h-3 fill-current" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={handleManualRefresh}
                            disabled={isRefreshing}
                            className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl h-11 px-6 text-[10px] font-black shadow-sm"
                            variant="outline"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'جاري التحديث...' : 'تحديث البيانات'}
                        </Button>

                        <Button
                            onClick={handleExportExcel}
                            disabled={guests.length === 0}
                            className="bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 rounded-2xl h-11 px-6 text-[10px] font-black shadow-sm"
                            variant="outline"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" />
                            تصدير التقرير (Excel)
                        </Button>

                        <Button
                            onClick={handleExportPDF}
                            disabled={guests.length === 0}
                            className="bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-2xl h-11 px-6 text-[10px] font-black shadow-sm"
                            variant="outline"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" />
                            تصدير تقرير الحضور (PDF)
                        </Button>
                    </div>

                    {/* --- STRATEGIC INTEL ROW --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 overflow-visible">
                        <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 rounded-[2rem] p-6 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-500">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">مراقبة الكوتا اليومية (Meta)</span>
                                    <h3 className="text-2xl font-black text-slate-800">{dayUsage} / {metaLimit}</h3>
                                </div>
                                <div className={`p-3 rounded-2xl transition-colors duration-500 ${dayUsage / metaLimit > 0.9 ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                <div
                                    className={`h-full transition-all duration-1000 ${dayUsage / metaLimit > 0.9 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${(dayUsage / metaLimit) * 100}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-3 animate-pulse">
                                {dayUsage / metaLimit > 0.9 ? '⚠️ قاربت على استهلاك الحد اليومي لميتا' : '🌱 استهلاكك ضمن النطاق الآمن للفئة الأولى'}
                            </p>
                            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-3xl" />
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50/50 to-white border border-emerald-100 rounded-[2rem] p-6 shadow-sm group hover:shadow-md transition-all duration-500">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">جرد التكاليف (هذه المناسبة)</span>
                                    <h3 className="text-3xl font-black text-slate-800">{financials.totalCost} <span className="text-sm font-bold text-slate-400">SAR</span></h3>
                                </div>
                                <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 group-hover:rotate-12 transition-transform">
                                    <History className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-full border border-emerald-100/50">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-[9px] font-black text-slate-500">{financials.marketingCount} تسويقية</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/50 px-2 py-1 rounded-full border border-emerald-100/50">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-[9px] font-black text-slate-500">{financials.utilityCount} خدمية</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-[2rem] p-6 flex items-center justify-between transition-all hover:bg-white hover:border-solid hover:shadow-sm">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">درع إنتصار الاستراتيجي</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-xs font-black text-slate-700">مراقب الجودة نشط</span>
                                </div>
                                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">100% Delivery Confidence</span>
                            </div>
                            <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-indigo-500 group">
                                <ShieldCheck className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {isSending && (
                        <div className="bg-slate-900 mx-0 md:mx-4 xl:mx-8 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
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

                            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        <StatCard label="تم التأكيد ✅" value={rsvpStats.confirmed} color="purple" icon={<CheckCircle className="w-5 h-5" />} />
                        <StatCard label="المعتذرين ❌" value={rsvpStats.declined} color="red" icon={<AlertTriangle className="w-5 h-5" />} />
                        <StatCard label="لم يردوا ⏳" value={rsvpStats.no_response} color="amber" icon={<Clock className="w-5 h-5" />} />
                        <StatCard label="مشاكل ميتا 🚨" value={rsvpStats.failed} color="gray" icon={<ShieldCheck className="w-5 h-5" />} />
                        <StatCard label="وصلت (Delivered)" value={rsvpStats.delivered} color="green" icon={<MailCheck className="w-5 h-5" />} />
                        <StatCard label="تمت القراءة 👁️" value={rsvpStats.read} color="sky" icon={<Eye className="w-5 h-5" />} />
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
                            {(['all', 'confirmed', 'declined', 'failed', 'no_response'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setGuestFilter(filter)}
                                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${guestFilter === filter ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {filter === 'all' ? 'الكل' : filter === 'confirmed' ? 'المؤكدين' : filter === 'declined' ? 'المعتذرين' : filter === 'failed' ? 'مشاكل ميتا 🚨' : 'لم يردوا'}
                                </button>
                            ))}
                        </div>

                        {guestFilter !== 'all' && (
                            <Button
                                onClick={() => handleExportFiltered(guestFilter)}
                                variant="outline"
                                className="bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100 rounded-2xl h-11 px-6 text-[10px] font-black shadow-sm shrink-0"
                            >
                                <Download className="w-3.5 h-3.5 mr-2" />
                                تصدير هذه القائمة (Excel)
                            </Button>
                        )}

                        <Button
                            onClick={handleRetryUncertain}
                            variant="outline"
                            className="bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100 rounded-2xl h-11 px-6 text-[10px] font-black shadow-sm shrink-0"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-2" />
                            إعادة إرسال للعالقين (⚠️)
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 min-h-[600px] xl:h-[800px] pb-20">
                        {/* Control & Logs */}
                        <div className="xl:col-span-4 flex flex-col gap-6 order-2 xl:order-1">
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
                                <div className="p-4 md:p-6 border-b bg-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Zap className="w-5 h-5 text-indigo-600" />
                                        <span className="font-black text-slate-800">إطلاق الحملة</span>
                                    </div>
                                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">{campaignType === 'invite' ? 'INVITATION_PHASE' : 'QR_CARDS_PHASE'}</span>
                                </div>
                                <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                                    <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">استوديو المتغيرات (AI Studio)</label>
                                        <div className="space-y-4">
                                            {templateName === 'get_update' ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase">اسم العريس</label>
                                                        <input value={groomName} onChange={e => setGroomName(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase">اسم العروس</label>
                                                        <input value={brideName} onChange={e => setBrideName(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase">اسم المناسبة</label>
                                                        <input value={eventName} onChange={e => setEventName(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase">ملاحظة الدعوة (Note)</label>
                                                        <input value={note} onChange={e => setNote(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">التاريخ</label>
                                                    <input value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">الوقت</label>
                                                    <input value={eventTime} onChange={e => setEventTime(e.target.value)} placeholder="مثلاً: 8 مساءً" className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-slate-400 uppercase">الموقع / القاعة</label>
                                                <input value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="w-full bg-white border border-slate-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black text-indigo-500 uppercase">رابط جوجل ماب (Google Maps URL)</label>
                                                <input 
                                                    value={locationMapsUrl} 
                                                    onChange={e => setLocationMapsUrl(e.target.value)} 
                                                    placeholder="الصقي الرابط هنا..."
                                                    className="w-full bg-indigo-50 border border-indigo-100 rounded-xl px-2 py-2 text-[10px] font-bold outline-none focus:ring-2 ring-indigo-500/20" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Button onClick={handleUpdateSettings} className="w-full mt-4 bg-slate-900 text-white h-10 rounded-2xl font-black text-[10px] border border-slate-700">💾 حفظ بيانات المناسبة واللوكيشن</Button>

                                    {!isSending ? (
                                        <div className="space-y-4">
                                            <Button
                                                onClick={handleStartQueue}
                                                disabled={loadingGuests || !selectedEventId}
                                                className="w-full h-20 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
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
                                        <div className="space-y-4">
                                            <div className="bg-slate-900 rounded-2xl p-5 space-y-4 text-white">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">جاري الإرسال...</span>
                                                    <span className="text-xs font-black text-white bg-indigo-600 px-3 py-1 rounded-lg">{progress}%</span>
                                                </div>

                                                <div className="text-center py-2">
                                                    <div className="text-5xl font-black text-white">
                                                        {currentBatchIndex} <span className="text-xl text-slate-500">/ {totalBatches}</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold text-slate-400 mt-1">تم معالجتهم من إجمالي الضيوف</div>
                                                </div>

                                                <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-700 rounded-full" style={{ width: `${progress}%` }} />
                                                </div>

                                                {isPaused && (
                                                    <div className="text-center text-amber-400 text-xs font-black animate-pulse">⏸️ الحملة متوقفة مؤقتاً</div>
                                                )}
                                            </div>

                                            <div className="flex gap-3">
                                                <Button onClick={handlePause} className={`flex-1 h-14 rounded-2xl font-black transition-all ${isPaused ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-700'}`}>
                                                    {isPaused ? 'استئناف ▶️' : 'إيقاف مؤقت ⏸️'}
                                                </Button>
                                                <Button onClick={handleStop} className="flex-1 h-14 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black">إيقاف كلي 🛑</Button>
                                            </div>
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
                                        {logs.map((l, i) => <div key={i} className="flex gap-2"><span className="text-slate-700">{i + 1}.</span><span>{l}</span></div>)}
                                        {logs.length === 0 && <div className="text-slate-800 text-center py-10">بانتظار بدء العمليات...</div>}
                                    </div>
                                    <div ref={logContainerRef} />
                                </div>
                            </div>
                        </div>

                        {/* Guest List */}
                        <div className="xl:col-span-8 flex flex-col gap-6 order-1 xl:order-2">
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
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
                                        {(['all', 'confirmed', 'declined', 'failed', 'no_response'] as const).map(f => (
                                            <button key={f} onClick={() => setGuestFilter(f)} className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${guestFilter === f ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
                                                {f === 'all' ? 'الكل' : f === 'confirmed' ? 'تأكيد' : f === 'declined' ? 'اعتذار' : f === 'failed' ? 'مشاكل' : 'لم يرد'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                    {selectedGuestIds.length > 0 && (
                                        <div className="mb-4 p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl text-white flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-white/20 px-3 py-1 rounded-lg font-black text-xs">
                                                    {selectedGuestIds.length} ضيوف محددين
                                                </div>
                                                <span className="text-[11px] font-bold">يمكنك إجراء عمليات جماعية على الضيوف المحددين:</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleBulkRetry}
                                                    className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all flex items-center gap-1.5"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    إرسال للمحددين
                                                </button>
                                                <button
                                                    onClick={handleBulkDelete}
                                                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm transition-all flex items-center gap-1.5 border border-rose-400/30"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    حذف المحددين نهائياً
                                                </button>
                                                <button
                                                    onClick={() => setSelectedGuestIds([])}
                                                    className="bg-transparent hover:bg-white/10 text-white/80 px-3 py-2 rounded-xl text-[10px] font-black transition-all"
                                                >
                                                    إلغاء التحديد
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <GuestTable
                                        guests={filteredGuests}
                                        onRetry={handleIndividualResend}
                                        onDirectSend={handleDirectSend}
                                        onOverrideStatus={handleOverrideStatus}
                                        onEditPhone={handleEditPhone}
                                        onShowLifecycle={(g) => setSelectedGuestForLifecycle(g)}
                                        onSendTest={handleSendTest}
                                        onDelete={handleDeleteGuest}
                                        stuckTimeoutHours={0.16}
                                        selectedGuestIds={selectedGuestIds}
                                        onToggleSelect={handleToggleSelect}
                                        onToggleSelectAll={handleToggleSelectAll}
                                        isAllSelected={isAllSelected}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* Guest Journey Modal */}
            {selectedGuestForLifecycle && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 border border-white/20">
                        <div className="p-10 border-b flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                        <Eye className="w-5 h-5 text-white" />
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">رحلة الضيف</h3>
                                </div>
                                <p className="text-sm text-slate-400 font-bold">نحن الآن نراقب ما يحدث في جوال: <span className="text-indigo-600">{selectedGuestForLifecycle.name}</span></p>
                            </div>
                            <button onClick={() => setSelectedGuestForLifecycle(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all border border-slate-100 text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/30 text-right" dir="rtl">
                            {selectedGuestForLifecycle.whatsapp_messages?.some((m: any) => m.delivery_status === 'read') && selectedGuestForLifecycle.rsvp_status === 'pending' && (
                                <div className="mb-10 p-5 bg-amber-50 border border-amber-100 rounded-3xl flex items-center gap-4 animate-pulse">
                                    <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-amber-800">ملاحظة ذكية: الضيف يتأمل الدعوة 🤔</h4>
                                        <p className="text-[10px] text-amber-600 font-bold mt-0.5">الضيف قام بفتح الرسالة وقراءتها، ولكنه لم يقم بالرد حتى الآن.</p>
                                    </div>
                                </div>
                            )}

                            {selectedGuestForLifecycle.whatsapp_messages?.length > 0 ? (
                                <div className="space-y-10 relative before:absolute before:right-6 before:top-4 before:bottom-4 before:w-1 before:bg-slate-100/50">
                                    {selectedGuestForLifecycle.rsvp_status && selectedGuestForLifecycle.rsvp_status !== 'pending' && (
                                        <div className="relative pr-16 animate-in slide-in-from-right duration-500">
                                            <div className="absolute right-0 top-0 w-12 h-12 rounded-2xl bg-emerald-500 shadow-xl shadow-emerald-100 z-10 flex items-center justify-center border-4 border-white">
                                                <CheckCircle className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">تم اتخاذ القرار 🎉</span>
                                                    <span className="text-[10px] text-emerald-400 font-bold">تحديث نهائي</span>
                                                </div>
                                                <p className="text-lg font-black text-emerald-900">
                                                    {selectedGuestForLifecycle.rsvp_status === 'confirmed' ? 'أكد الضيف حضوره للمناسبة ✅' : 'اعتذر الضيف عن الحضور ❌'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedGuestForLifecycle.whatsapp_messages.slice().reverse().map((m: any, idx: number) => (
                                        <div key={idx} className="relative pr-16 group">
                                            <div className={`absolute right-0 top-0 w-12 h-12 rounded-2xl z-10 flex items-center justify-center border-4 border-white shadow-lg transition-transform group-hover:scale-110 ${m.delivery_status === 'read' ? 'bg-sky-500' :
                                                    m.delivery_status === 'delivered' ? 'bg-indigo-500' :
                                                        m.status === 'failed' ? 'bg-rose-500' : 'bg-slate-400'
                                                }`}>
                                                {m.delivery_status === 'read' ? <Eye className="w-5 h-5 text-white" /> :
                                                    m.delivery_status === 'delivered' ? <MailCheck className="w-5 h-5 text-white" /> :
                                                        <Send className="w-5 h-5 text-white" />}
                                            </div>

                                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                                <div className="flex justify-between items-start mb-3">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${m.delivery_status === 'read' ? 'text-sky-600' :
                                                            m.delivery_status === 'delivered' ? 'text-indigo-600' : 'text-slate-400'
                                                        }`}>
                                                        {m.message_phase === 'invitation' ? 'إرسال الدعوة 💌' : 'إرسال كرت الدخول 🎫'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-300 font-bold">{new Date(m.created_at).toLocaleString('ar-SA')}</span>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-sm font-black text-slate-700">
                                                            {m.delivery_status === 'read' ? 'الضيف فتح الرسالة وشاهدها الآن 🔵' :
                                                                m.delivery_status === 'delivered' ? 'وصلت الرسالة لجوال الضيف بنجاح ✅' :
                                                                    m.status === 'failed' ? 'فشلت المحاولة بسبب عائق تقني ❌' : 'الرسالة خرجت من النظام وفي طريقها للضيف 📤'}
                                                        </p>
                                                        {m.error_message && (
                                                            <p className="text-[10px] text-rose-500 font-bold bg-rose-50 p-2 rounded-xl border border-rose-100 mt-2">
                                                                سبب التعثر: {m.error_message}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                                        <div className="flex gap-2">
                                                            <span className="text-[9px] bg-slate-50 text-slate-400 px-2 py-1 rounded-lg font-bold">قناة: Meta Cloud</span>
                                                            {m.category && <span className="text-[9px] bg-indigo-50 text-indigo-400 px-2 py-1 rounded-lg font-bold uppercase">{m.category}</span>}
                                                        </div>
                                                        {m.wa_id && <span className="text-[8px] text-slate-200 font-mono">Trace: {m.wa_id}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-24 text-center space-y-4">
                                    <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                                        <Clock className="w-10 h-10" />
                                    </div>
                                    <p className="font-black text-slate-400">لا توجد تحركات مسجلة لهذا الضيف حتى الآن</p>
                                </div>
                            )}
                        </div>

                        <div className="p-10 border-t bg-slate-50/50 flex gap-4">
                            <Button onClick={() => setSelectedGuestForLifecycle(null)} className="flex-1 bg-slate-900 text-white h-14 rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:scale-[1.02] transition-transform">إغلاق نافذة المراقبة</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conversation Mirror Modal */}
            {selectedGuestForMirror && (
                <ConversationMirror
                    guest={selectedGuestForMirror}
                    messages={selectedGuestForMirror.whatsapp_messages || []}
                    onClose={() => setSelectedGuestForMirror(null)}
                />
            )}
        </div>
    );
}
