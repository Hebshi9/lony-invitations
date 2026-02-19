import React, { useState, useEffect, useRef } from 'react';
import {
    Send, CheckCircle, XCircle, Clock, Users, MessageSquare,
    QrCode, ChevronRight, Loader2, RefreshCw, Zap, Image,
    FileArchive, AlertTriangle, Check, X, ArrowLeft, Play
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import { Button } from '../components/ui/Button';

const API_URL = config.api.whatsapp;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Event { id: string; name: string; date: string; venue: string; }
interface Guest {
    id: string; name: string; phone: string;
    status: string; // 'pending' | 'confirmed' | 'declined' | 'attended'
    card_image_url?: string;
    qr_token?: string;
    last_message_status?: string;
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
const MiniStat = ({ label, value, color, icon }: any) => {
    const colors: any = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        gray: 'text-gray-400 bg-white/5 border-white/10',
    };
    return (
        <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${colors[color]}`}>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-3xl font-black">{value}</div>
        </div>
    );
};

// ─── Phase Badge ──────────────────────────────────────────────────────────────
const PhaseBadge = ({ phase, currentPhase }: { phase: number; currentPhase: number }) => {
    const isPast = currentPhase > phase;
    const isActive = currentPhase === phase;
    return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all
            ${isPast ? 'bg-green-500 border-green-500 text-black' : isActive ? 'bg-white border-white text-black' : 'border-white/20 text-white/30'}`}>
            {isPast ? <Check className="w-4 h-4" /> : phase}
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignCenter() {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(false);
    const [phase, setPhase] = useState<1 | 2 | 3>(1);

    // Phase 1 — Invite
    const [inviteTemplate, setInviteTemplate] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [inviteProgress, setInviteProgress] = useState(0);

    // Phase 3 — QR Cards
    const [cardSending, setCardSending] = useState(false);
    const [cardProgress, setCardProgress] = useState(0);
    const [cardType, setCardType] = useState<'named' | 'numbered'>('named');
    const [cardFiles, setCardFiles] = useState<{ name: string; url: string; blob: File }[]>([]);
    const [matchedCards, setMatchedCards] = useState<{ guestId: string; cardUrl: string; file: File }[]>([]);
    const [matchPreview, setMatchPreview] = useState<{ guest: Guest; file?: File }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [logs, setLogs] = useState<string[]>([]);
    const addLog = (msg: string) => setLogs(p => [...p.slice(-49), `${new Date().toLocaleTimeString('ar-SA')} — ${msg}`]);

    // ── Stats ──────────────────────────────────────────────────────────────────
    const stats = {
        total: guests.length,
        confirmed: guests.filter(g => g.status === 'confirmed' || g.status === 'attended').length,
        declined: guests.filter(g => g.status === 'declined').length,
        pending: guests.filter(g => g.status === 'pending').length,
        sent: guests.filter(g => ['sent', 'delivered', 'read'].includes(g.last_message_status || '')).length,
    };

    // ── Fetch ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        supabase.from('events').select('id, name, date, venue').order('created_at', { ascending: false })
            .then(({ data }) => data && setEvents(data));
    }, []);

    const fetchGuests = async (eventId: string) => {
        setLoadingGuests(true);
        const { data, error } = await supabase
            .from('guests')
            .select('id, name, phone, status, card_image_url, qr_token, whatsapp_messages(status)')
            .eq('event_id', eventId)
            .order('name');

        if (data) {
            const processed = data.map((g: any) => {
                const msgs = (g.whatsapp_messages || []).sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return { ...g, last_message_status: msgs[0]?.status || 'pending' };
            });
            setGuests(processed);
        }
        setLoadingGuests(false);
    };

    const handleSelectEvent = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const ev = events.find(ev => ev.id === e.target.value) || null;
        setSelectedEvent(ev);
        setPhase(1);
        setGuests([]);
        setCardFiles([]);
        setMatchedCards([]);
        setMatchPreview([]);
        setLogs([]);
        if (ev) fetchGuests(ev.id);
    };

    // ── Phase 1: Send Invite ───────────────────────────────────────────────────
    const handleSendInvites = async () => {
        if (!selectedEvent || !inviteTemplate.trim()) return;
        const unsentGuests = guests.filter(g => !['sent', 'delivered', 'read'].includes(g.last_message_status || ''));
        if (unsentGuests.length === 0) return alert('جميع الضيوف استلموا الدعوة بالفعل.');
        if (!confirm(`سيتم إرسال ${unsentGuests.length} دعوة مع أزرار تأكيد/اعتذار.\nهل أنت متأكد؟`)) return;

        setInviteSending(true);
        setInviteProgress(0);
        addLog(`🚀 بدء حملة الدعوة — ${unsentGuests.length} ضيف`);

        try {
            // Prepare messages
            const prepRes = await fetch(`${API_URL}/prepare-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEvent.id,
                    template: inviteTemplate,
                    messagePhase: 'invite',
                    filters: { status: 'all' }
                })
            });
            const prep = await prepRes.json();
            if (!prep.success) throw new Error(prep.error || 'فشل في التحضير');
            addLog(`✅ جُهّزت ${prep.count} رسالة`);

            // Send batch
            const sendRes = await fetch(`${API_URL}/send-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEvent.id,
                    mode: 'balanced',
                    useButtons: true
                })
            });

            if (sendRes.ok) {
                addLog('📤 الإرسال بدأ بنجاح');
                // Poll for completion
                const pollId = setInterval(async () => {
                    const st = await fetch(`${API_URL}/status/${selectedEvent.id}`).then(r => r.json());
                    if (st.success && st.status) {
                        const done = st.status.stats?.sent || 0;
                        const total = prep.count;
                        setInviteProgress(Math.round((done / total) * 100));
                        addLog(`📩 أُرسلت ${done} / ${total}`);
                        if (!st.status.isRunning) {
                            clearInterval(pollId);
                            setInviteProgress(100);
                            addLog('✅ انتهى الإرسال');
                            fetchGuests(selectedEvent.id);
                        }
                    }
                }, 3000);
            }
        } catch (err: any) {
            addLog(`❌ خطأ: ${err.message}`);
            alert('حدث خطأ: ' + err.message);
        } finally {
            setInviteSending(false);
        }
    };

    // ── Phase 3: Match & Send Cards ────────────────────────────────────────────
    const confirmedGuests = guests.filter(g => g.status === 'confirmed' || g.status === 'attended');

    const handleCardFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const items = files.map(f => ({ name: f.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f), blob: f }));
        setCardFiles(items);

        // Auto-match
        if (cardType === 'named') {
            // Match by name similarity
            const preview = confirmedGuests.map(guest => {
                const nameNorm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
                const match = items.find(img => nameNorm(img.name).includes(nameNorm(guest.name)) || nameNorm(guest.name).includes(nameNorm(img.name)));
                return { guest, file: match?.blob };
            });
            setMatchPreview(preview);
            setMatchedCards(preview.filter(p => p.file).map(p => ({
                guestId: p.guest.id,
                cardUrl: URL.createObjectURL(p.file!),
                file: p.file!
            })));
            addLog(`🎯 تم مطابقة ${preview.filter(p => p.file).length} / ${confirmedGuests.length} كارت بالاسم`);
        } else {
            // Match by order (numbered)
            const sorted = [...confirmedGuests].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
            const preview = sorted.map((guest, i) => ({
                guest,
                file: items[i]?.blob
            }));
            setMatchPreview(preview);
            setMatchedCards(preview.filter(p => p.file).map(p => ({
                guestId: p.guest.id,
                cardUrl: URL.createObjectURL(p.file!),
                file: p.file!
            })));
            addLog(`🔢 تم مطابقة ${preview.filter(p => p.file).length} / ${confirmedGuests.length} كارت مرقم`);
        }
    };

    const handleSendCards = async () => {
        if (!selectedEvent || matchedCards.length === 0) return;
        if (!confirm(`سيتم إرسال ${matchedCards.length} كارت دعوة شخصية للضيوف المؤكدين.\nهل أنت متأكد؟`)) return;

        setCardSending(true);
        setCardProgress(0);
        addLog('🃏 بدء إرسال الكروت الشخصية...');

        try {
            let successCount = 0;

            for (let i = 0; i < matchedCards.length; i++) {
                const { guestId, file } = matchedCards[i];
                const guest = guests.find(g => g.id === guestId);
                if (!guest) continue;

                // Upload card to Supabase Storage
                const fileName = `${selectedEvent.id}/${guestId}-card.jpg`;
                const { error: uploadErr } = await supabase.storage
                    .from('invitation-cards')
                    .upload(fileName, file, { upsert: true });

                if (uploadErr) {
                    addLog(`⚠️ فشل رفع كارت ${guest.name}`);
                    continue;
                }

                const { data: { publicUrl } } = supabase.storage.from('invitation-cards').getPublicUrl(fileName);

                // Update guest card_image_url
                await supabase.from('guests').update({ card_image_url: publicUrl }).eq('id', guestId);

                // Queue WhatsApp message with card
                const verifyLink = `${window.location.origin}/verify/${guest.qr_token}`;
                const msgText = `🎉 *${guest.name}*\n\nيسعدنا تأكيد دعوتك لحضور ${selectedEvent.name}\n\n📍 ${selectedEvent.venue || ''}\n📅 ${selectedEvent.date || ''}\n\n🔲 *باركود دخولك الشخصي:*\n${verifyLink}\n\n_احفظ هذه الرسالة — ستحتاجها عند الدخول_`;

                await supabase.from('whatsapp_messages').insert({
                    event_id: selectedEvent.id,
                    guest_id: guestId,
                    phone: guest.phone,
                    message_text: msgText,
                    image_url: publicUrl,
                    message_phase: 'qr_code',
                    status: 'pending'
                });

                successCount++;
                setCardProgress(Math.round(((i + 1) / matchedCards.length) * 70));
                addLog(`✅ ${guest.name} — كارت جاهز`);
            }

            addLog(`📤 ${successCount} كارت جُهّزت — بدء الإرسال...`);

            // Trigger batch send for qr_code phase
            const sendRes = await fetch(`${API_URL}/send-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEvent.id, mode: 'balanced', useButtons: false })
            });

            if (sendRes.ok) {
                setCardProgress(100);
                addLog('✅ تم إرسال جميع الكروت بنجاح!');
                fetchGuests(selectedEvent.id);
            }
        } catch (err: any) {
            addLog(`❌ خطأ: ${err.message}`);
            alert('حدث خطأ: ' + err.message);
        } finally {
            setCardSending(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#080810] text-white font-sans" dir="rtl">
            {/* Header */}
            <div className="border-b border-white/5 bg-[#0d0d1a]/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-black text-white tracking-tight">مركز الحملات</h1>
                        <p className="text-xs text-gray-500 font-medium">إرسال الدعوات — تتبع الردود — توزيع الكروت</p>
                    </div>
                    {selectedEvent && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => fetchGuests(selectedEvent.id)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-400 ${loadingGuests ? 'animate-spin' : ''}`} />
                            </button>
                            <div className="text-right">
                                <p className="font-black text-sm">{selectedEvent.name}</p>
                                <p className="text-[10px] text-gray-500">{selectedEvent.date}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

                {/* Event Selector */}
                {!selectedEvent ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                            <MessageSquare className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-black mb-2">اختر المناسبة</h2>
                            <p className="text-gray-500 text-sm">ابدأ بتحديد المناسبة لإدارة حملاتها</p>
                        </div>
                        <select
                            onChange={handleSelectEvent}
                            className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold text-center focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value="">-- اختر المناسبة --</option>
                            {events.map(ev => <option key={ev.id} value={ev.id}>🎉 {ev.name}</option>)}
                        </select>
                    </div>
                ) : (
                    <>
                        {/* Phase Navigation */}
                        <div className="bg-white/3 border border-white/8 rounded-3xl p-5 flex items-center gap-4 overflow-x-auto">
                            {[
                                { n: 1, label: 'إرسال الدعوة', sub: 'مع أزرار تأكيد/اعتذار', icon: <Send className="w-4 h-4" /> },
                                { n: 2, label: 'نتائج الردود', sub: 'تأكيد — اعتذار — انتظار', icon: <Users className="w-4 h-4" /> },
                                { n: 3, label: 'إرسال الكروت', sub: 'للمؤكدين فقط', icon: <QrCode className="w-4 h-4" /> },
                            ].map((p, i) => (
                                <React.Fragment key={p.n}>
                                    <button
                                        onClick={() => setPhase(p.n as 1 | 2 | 3)}
                                        className={`flex items-center gap-3 flex-shrink-0 px-4 py-3 rounded-2xl transition-all ${phase === p.n ? 'bg-white/10 border border-white/15' : 'hover:bg-white/5'}`}
                                    >
                                        <PhaseBadge phase={p.n} currentPhase={phase} />
                                        <div className="text-right">
                                            <p className={`font-black text-sm ${phase === p.n ? 'text-white' : 'text-gray-500'}`}>{p.label}</p>
                                            <p className="text-[10px] text-gray-600">{p.sub}</p>
                                        </div>
                                    </button>
                                    {i < 2 && <ChevronRight className="w-4 h-4 text-gray-700 flex-shrink-0 rotate-180" />}
                                </React.Fragment>
                            ))}

                            <div className="mr-auto flex-shrink-0">
                                <select
                                    onChange={handleSelectEvent}
                                    value={selectedEvent.id}
                                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 focus:outline-none"
                                >
                                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Stats Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <MiniStat label="الكل" value={stats.total} color="gray" icon={<Users className="w-3 h-3" />} />
                            <MiniStat label="تأكيد حضور" value={stats.confirmed} color="green" icon={<CheckCircle className="w-3 h-3" />} />
                            <MiniStat label="اعتذار" value={stats.declined} color="red" icon={<XCircle className="w-3 h-3" />} />
                            <MiniStat label="لم يرد" value={stats.pending} color="amber" icon={<Clock className="w-3 h-3" />} />
                        </div>

                        {/* ═══ PHASE 1: INVITE ══════════════════════════════════════════════════ */}
                        {phase === 1 && (
                            <div className="bg-white/3 border border-white/8 rounded-3xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                                        <Send className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-lg">المرحلة 1 — إرسال الدعوة الأولية</h2>
                                        <p className="text-gray-500 text-sm">نص الدعوة + أزرار تأكيد حضور / اعتذار</p>
                                    </div>
                                    <div className="mr-auto bg-indigo-500/10 text-indigo-400 text-xs font-black px-3 py-1 rounded-full border border-indigo-500/20">
                                        {stats.total - stats.sent} لم يتلقوا الدعوة بعد
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Template editor */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black uppercase tracking-widest text-gray-500">نص رسالة الدعوة</label>

                                        {/* Quick templates */}
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { label: 'اسم الضيف', val: '{{name}}' },
                                                { label: 'اسم الحدث', val: '{{event_name}}' },
                                                { label: 'التاريخ', val: '{{date}}' },
                                                { label: 'المكان', val: '{{venue}}' },
                                            ].map(v => (
                                                <button
                                                    key={v.val}
                                                    onClick={() => setInviteTemplate(p => p + v.val)}
                                                    className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-mono hover:bg-indigo-500/20 transition-colors"
                                                >
                                                    + {v.label}
                                                </button>
                                            ))}
                                        </div>

                                        <textarea
                                            value={inviteTemplate}
                                            onChange={e => setInviteTemplate(e.target.value)}
                                            placeholder={`مثال:\nيسعدنا دعوة {{name}} لحضور {{event_name}}\nالتاريخ: {{date}}\nالمكان: {{venue}}\n\nنرجو تأكيد حضوركم عبر الأزرار أدناه 🎉`}
                                            rows={6}
                                            className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500/40 leading-relaxed"
                                        />
                                        <p className="text-[10px] text-gray-600">
                                            ⚡ ستُرسل مع أزرار تفاعلية: <span className="text-green-400 font-bold">✅ أؤكد حضوري</span> و <span className="text-red-400 font-bold">❌ أعتذر</span>
                                        </p>
                                    </div>

                                    {/* Progress */}
                                    {inviteProgress > 0 && inviteProgress < 100 && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> جاري الإرسال...</span>
                                                <span>{inviteProgress}%</span>
                                            </div>
                                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500 transition-all duration-500 rounded-full" style={{ width: `${inviteProgress}%` }} />
                                            </div>
                                        </div>
                                    )}
                                    {inviteProgress === 100 && (
                                        <div className="flex items-center gap-3 text-green-400 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                            <p className="font-bold text-sm">تم إرسال الدعوات بنجاح! انتظر ردود الضيوف ثم انتقل للمرحلة 2.</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <Button
                                            onClick={handleSendInvites}
                                            disabled={inviteSending || !inviteTemplate.trim()}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl h-auto flex items-center justify-center gap-2 disabled:opacity-40"
                                        >
                                            {inviteSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {inviteSending ? 'جاري الإرسال...' : `إرسال لـ ${stats.total - stats.sent} ضيف`}
                                        </Button>
                                        <Button
                                            onClick={() => setPhase(2)}
                                            variant="ghost"
                                            className="px-6 text-gray-400 hover:text-white border border-white/10 rounded-2xl"
                                        >
                                            التالي <ArrowLeft className="w-4 h-4 mr-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ PHASE 2: RSVP RESULTS ════════════════════════════════════════════ */}
                        {phase === 2 && (
                            <div className="bg-white/3 border border-white/8 rounded-3xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-lg">المرحلة 2 — نتائج الردود</h2>
                                        <p className="text-gray-500 text-sm">استعرض ردود الضيوف وتأكد من قائمة المؤكدين</p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* RSVP progress visual */}
                                    <div className="bg-black/20 rounded-2xl p-5 space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                                            <span>نسبة الاستجابة</span>
                                            <span>{stats.total > 0 ? Math.round(((stats.confirmed + stats.declined) / stats.total) * 100) : 0}%</span>
                                        </div>
                                        <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-green-500 transition-all" style={{ width: `${(stats.confirmed / (stats.total || 1)) * 100}%` }} />
                                            <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.declined / (stats.total || 1)) * 100}%` }} />
                                        </div>
                                        <div className="flex gap-4 text-xs">
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> مؤكد ({stats.confirmed})</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> اعتذار ({stats.declined})</span>
                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> انتظار ({stats.pending})</span>
                                        </div>
                                    </div>

                                    {/* Guest list */}
                                    <div className="rounded-2xl border border-white/8 overflow-hidden max-h-[400px] overflow-y-auto">
                                        <div className="sticky top-0 bg-[#0d0d1a] px-4 py-3 border-b border-white/5 grid grid-cols-3 text-[10px] font-black uppercase tracking-widest text-gray-600">
                                            <span>الاسم</span>
                                            <span className="text-center">الهاتف</span>
                                            <span className="text-left">الحالة</span>
                                        </div>
                                        {loadingGuests ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                                            </div>
                                        ) : guests.map(g => (
                                            <div key={g.id} className="px-4 py-3 border-b border-white/3 grid grid-cols-3 items-center hover:bg-white/3 transition-colors">
                                                <span className="font-bold text-sm text-white">{g.name}</span>
                                                <span className="text-center text-xs text-gray-500 font-mono">{g.phone}</span>
                                                <div className="flex justify-end">
                                                    {g.status === 'confirmed' || g.status === 'attended' ? (
                                                        <span className="flex items-center gap-1 text-green-400 text-xs font-black bg-green-500/10 px-2 py-1 rounded-full">
                                                            <Check className="w-3 h-3" /> مؤكد
                                                        </span>
                                                    ) : g.status === 'declined' ? (
                                                        <span className="flex items-center gap-1 text-red-400 text-xs font-black bg-red-500/10 px-2 py-1 rounded-full">
                                                            <X className="w-3 h-3" /> اعتذر
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-gray-500 text-xs font-black bg-white/5 px-2 py-1 rounded-full">
                                                            <Clock className="w-3 h-3" /> انتظار
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Action */}
                                    <div className="flex gap-3 pt-2">
                                        <Button onClick={() => setPhase(1)} variant="ghost" className="px-6 text-gray-500 border border-white/10 rounded-2xl">
                                            <ArrowLeft className="w-4 h-4 ml-1 rotate-180" /> السابق
                                        </Button>
                                        <Button
                                            onClick={() => setPhase(3)}
                                            disabled={stats.confirmed === 0}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl h-auto flex items-center justify-center gap-2 disabled:opacity-40"
                                        >
                                            <QrCode className="w-4 h-4" />
                                            إرسال الكروت للـ {stats.confirmed} مؤكد
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══ PHASE 3: SEND CARDS ══════════════════════════════════════════════ */}
                        {phase === 3 && (
                            <div className="bg-white/3 border border-white/8 rounded-3xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
                                        <QrCode className="w-5 h-5 text-[#D4AF37]" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-lg">المرحلة 3 — إرسال الكروت الشخصية</h2>
                                        <p className="text-gray-500 text-sm">كروت مخصصة للـ {stats.confirmed} مؤكد فقط — بالاسم أو مرقمة</p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-6">
                                    {confirmedGuests.length === 0 ? (
                                        <div className="flex flex-col items-center py-12 gap-4 text-gray-600">
                                            <AlertTriangle className="w-10 h-10 opacity-40" />
                                            <p className="font-bold">لا يوجد ضيوف مؤكدون بعد</p>
                                            <p className="text-sm opacity-60">ارجع للمرحلة 1 وأرسل الدعوات، ثم انتظر ردود الضيوف</p>
                                            <Button onClick={() => setPhase(1)} variant="ghost" className="border border-white/10 rounded-2xl px-6">
                                                <ArrowLeft className="w-4 h-4 ml-1 rotate-180" /> الرجوع للمرحلة 1
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Card type selector */}
                                            <div className="space-y-3">
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">نوع الكروت</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button
                                                        onClick={() => { setCardType('named'); setCardFiles([]); setMatchPreview([]); }}
                                                        className={`p-4 rounded-2xl border text-right transition-all ${cardType === 'named' ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'bg-white/3 border-white/10 hover:border-white/20'}`}
                                                    >
                                                        <Image className={`w-5 h-5 mb-2 ${cardType === 'named' ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
                                                        <p className={`font-black text-sm ${cardType === 'named' ? 'text-[#D4AF37]' : 'text-gray-400'}`}>كروت باسم الضيف</p>
                                                        <p className="text-[10px] text-gray-600 mt-1">مطابقة تلقائية باسم الملف مع اسم الضيف</p>
                                                    </button>
                                                    <button
                                                        onClick={() => { setCardType('numbered'); setCardFiles([]); setMatchPreview([]); }}
                                                        className={`p-4 rounded-2xl border text-right transition-all ${cardType === 'numbered' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/10 hover:border-white/20'}`}
                                                    >
                                                        <FileArchive className={`w-5 h-5 mb-2 ${cardType === 'numbered' ? 'text-blue-400' : 'text-gray-500'}`} />
                                                        <p className={`font-black text-sm ${cardType === 'numbered' ? 'text-blue-400' : 'text-gray-400'}`}>كروت مرقمة</p>
                                                        <p className="text-[10px] text-gray-600 mt-1">الكرت الأول للضيف الأول (ترتيب أبجدي)</p>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Upload cards */}
                                            <div className="space-y-3">
                                                <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                                                    رفع الكروت ({confirmedGuests.length} كرت مطلوب)
                                                </label>
                                                <div
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="border-2 border-dashed border-white/10 hover:border-[#D4AF37]/40 rounded-2xl p-8 text-center cursor-pointer transition-all group"
                                                >
                                                    <Image className="w-10 h-10 text-gray-600 mx-auto mb-3 group-hover:text-[#D4AF37]/60 transition-colors" />
                                                    <p className="text-gray-400 font-bold text-sm mb-1">اسحب الصور هنا أو اضغط للاختيار</p>
                                                    <p className="text-gray-600 text-xs">
                                                        {cardType === 'named'
                                                            ? 'يجب أن يحتوي اسم الملف على اسم الضيف (مثال: محمد.jpg)'
                                                            : 'سيتم ترتيبها أبجدياً حسب ترتيب الضيوف'}
                                                    </p>
                                                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleCardFilesUpload} />
                                                </div>

                                                {cardFiles.length > 0 && (
                                                    <p className="text-xs text-green-400 font-bold">
                                                        ✅ تم رفع {cardFiles.length} صورة
                                                    </p>
                                                )}
                                            </div>

                                            {/* Match preview */}
                                            {matchPreview.length > 0 && (
                                                <div className="space-y-2">
                                                    <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                                                        معاينة المطابقة — {matchPreview.filter(p => p.file).length} / {matchPreview.length}
                                                    </label>
                                                    <div className="rounded-2xl border border-white/8 overflow-hidden max-h-[280px] overflow-y-auto">
                                                        {matchPreview.map(({ guest, file }) => (
                                                            <div key={guest.id} className={`flex items-center gap-3 px-4 py-3 border-b border-white/3 ${file ? 'bg-green-500/3' : 'bg-red-500/3'}`}>
                                                                {file ? (
                                                                    <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                                                                ) : (
                                                                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                                                        <AlertTriangle className="w-4 h-4 text-red-400" />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1">
                                                                    <p className="font-bold text-sm text-white">{guest.name}</p>
                                                                    <p className="text-[10px] text-gray-500">{guest.phone}</p>
                                                                </div>
                                                                <span className={`text-xs font-black ${file ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {file ? '✅ مطابق' : '❌ لا يوجد كرت'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Progress */}
                                            {cardProgress > 0 && cardProgress < 100 && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-gray-400">
                                                        <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> جاري إرسال الكروت...</span>
                                                        <span>{cardProgress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-[#D4AF37] transition-all duration-500 rounded-full" style={{ width: `${cardProgress}%` }} />
                                                    </div>
                                                </div>
                                            )}
                                            {cardProgress === 100 && (
                                                <div className="flex items-center gap-3 text-green-400 bg-green-500/10 border border-green-500/20 rounded-2xl p-4">
                                                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                                    <p className="font-bold text-sm">✅ تم إرسال جميع الكروت الشخصية بنجاح!</p>
                                                </div>
                                            )}

                                            <div className="flex gap-3 pt-2">
                                                <Button onClick={() => setPhase(2)} variant="ghost" className="px-6 text-gray-500 border border-white/10 rounded-2xl">
                                                    <ArrowLeft className="w-4 h-4 ml-1 rotate-180" /> السابق
                                                </Button>
                                                <Button
                                                    onClick={handleSendCards}
                                                    disabled={cardSending || matchedCards.length === 0}
                                                    className="flex-1 bg-[#D4AF37] hover:bg-[#B5952F] text-black font-black py-4 rounded-2xl h-auto flex items-center justify-center gap-2 disabled:opacity-40"
                                                >
                                                    {cardSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                                    {cardSending ? 'جاري الإرسال...' : `إرسال ${matchedCards.length} كرت للمؤكدين`}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Activity Log */}
                        {logs.length > 0 && (
                            <div className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
                                <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] text-gray-500 font-mono font-bold uppercase tracking-widest">Activity Log</span>
                                </div>
                                <div className="p-4 space-y-1 max-h-40 overflow-y-auto font-mono text-[11px]">
                                    {logs.map((l, i) => (
                                        <div key={i} className="text-green-400/80">{l}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
