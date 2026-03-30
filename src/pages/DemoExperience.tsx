import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import config from '../lib/config';
import {
    Play, Send, CheckCircle, XCircle, Clock, Sparkles,
    Loader2, Phone, MessageSquare, Shield, Eye, Upload,
    Users, BarChart3, QrCode, Image as ImageIcon, Plus, Trash2, ArrowRight, RefreshCw
} from 'lucide-react';

const API_URL = config.api.whatsapp;
const LIVE_URL = 'https://lonyinvit.netlify.app';

export default function DemoExperience() {
    const [step, setStep] = useState<'setup' | 'sending' | 'live'>('setup');

    // Setup State
    const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([
        { name: '', phone: '' },
        { name: '', phone: '' }
    ]);
    const [clientPhone, setClientPhone] = useState('');
    const [generalImage, setGeneralImage] = useState<string | null>(null);
    const [generalImageFile, setGeneralImageFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sendProgress, setSendProgress] = useState(0);
    const [sendTotal, setSendTotal] = useState(0);

    // Live State
    const [demoEventId, setDemoEventId] = useState('');
    const [magicToken, setMagicToken] = useState('');
    const [demoGuests, setDemoGuests] = useState<any[]>([]);
    const [sendLogs, setSendLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Poll guests for live updates
    useEffect(() => {
        if (step !== 'live' || !demoEventId) return;
        const interval = setInterval(async () => {
            const { data } = await supabase
                .from('guests')
                .select('id, name, phone, rsvp_status, card_image_url, rsvp_at')
                .eq('event_id', demoEventId)
                .order('created_at', { ascending: true });
            if (data) setDemoGuests(data);
        }, 3000);
        return () => clearInterval(interval);
    }, [step, demoEventId]);

    const addLog = (msg: string) => setSendLogs(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const addContact = () => {
        if (contacts.length >= 10) return;
        setContacts([...contacts, { name: '', phone: '' }]);
    };

    const removeContact = (i: number) => {
        if (contacts.length <= 1) return;
        setContacts(contacts.filter((_, idx) => idx !== i));
    };

    const updateContact = (i: number, field: 'name' | 'phone', value: string) => {
        const updated = [...contacts];
        updated[i][field] = value;
        setContacts(updated);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setGeneralImageFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setGeneralImage(ev.target?.result as string);
        reader.readAsDataURL(file);
    };

    const startDemo = async () => {
        // Validate
        const validContacts = contacts.filter(c => c.name.trim().length >= 2 && c.phone.trim().length >= 9);
        if (validContacts.length === 0) return setError('أدخل اسم ورقم واحد على الأقل');
        if (!clientPhone || clientPhone.trim().length < 9) return setError('أدخل رقم العميل (صاحب المناسبة)');
        setError('');
        setSending(true);
        setSendProgress(0);
        setSendTotal(validContacts.length);

        try {
            // 1. Create demo event with magic token
            const token = crypto.randomUUID();
            addLog('📌 جاري إنشاء مناسبة تجريبية...');

            const { data: event, error: eventErr } = await supabase
                .from('events')
                .insert({
                    name: '🎉 تجربة نظام لوني',
                    date: new Date().toISOString().split('T')[0],
                    token: 'demo-' + Date.now().toString(36),
                    client_phone: clientPhone.startsWith('966') ? clientPhone : clientPhone.startsWith('05') ? '966' + clientPhone.substring(1) : clientPhone.startsWith('5') ? '966' + clientPhone : clientPhone,
                    rsvp_cycle_status: 'idle',
                    magic_link_token: token
                })
                .select()
                .single();
            if (eventErr) throw eventErr;

            setDemoEventId(event.id);
            setMagicToken(token);
            addLog(`✅ المناسبة جاهزة! الرمز: ${token}`);

            // 2. Upload general image to Supabase Storage (if provided)
            let imageUrl: string | null = null;
            if (generalImageFile) {
                addLog('📷 جاري رفع صورة الدعوة...');
                const ext = generalImageFile.name.split('.').pop();
                const fileName = `demo/${event.id}/general.${ext}`;
                const { error: uploadErr } = await supabase.storage
                    .from('global-invitations')
                    .upload(fileName, generalImageFile, { upsert: true });

                if (!uploadErr) {
                    const { data: urlData } = supabase.storage
                        .from('global-invitations')
                        .getPublicUrl(fileName);
                    imageUrl = urlData.publicUrl;
                    addLog('✅ الصورة مرفوعة!');
                } else {
                    addLog('⚠️ فشل رفع الصورة، سيتم الإرسال بدون صورة');
                }
            }

            // 3. Find connected WhatsApp account
            const accRes = await fetch(`${API_URL}/accounts`);
            const accData = await accRes.json();
            const connectedAcc = accData.accounts?.find((a: any) => a.connected);
            if (!connectedAcc) throw new Error('لا يوجد حساب واتساب متصل!');
            addLog(`📱 حساب متصل: ${connectedAcc.name || connectedAcc.phone || connectedAcc.id}`);

            // 4. Create guests + send invitations
            for (let i = 0; i < validContacts.length; i++) {
                const c = validContacts[i];
                let phone = c.phone.trim().replace(/[^0-9]/g, '');
                if (phone.startsWith('05')) phone = '966' + phone.substring(1);
                else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;

                const qrPayload = `demo-${token}-${i}-${Date.now().toString(36)}`;

                addLog(`👤 [${i + 1}/${validContacts.length}] إنشاء ضيف: ${c.name}...`);

                // Create guest
                const { data: guest, error: gErr } = await supabase
                    .from('guests')
                    .insert({
                        event_id: event.id,
                        name: c.name.trim(),
                        phone: phone,
                        qr_payload: qrPayload,
                        status: 'pending',
                        rsvp_status: null
                    })
                    .select()
                    .single();
                if (gErr) {
                    addLog(`❌ فشل إنشاء ضيف ${c.name}: ${gErr.message}`);
                    continue;
                }

                // Generate real QR barcode card image for demo
                const qrData = `${LIVE_URL}/check-in.html?token=${qrPayload}`;
                const cardImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}&bgcolor=FFFFFF&color=2D1B69&format=png`;
                await supabase.from('guests').update({ card_image_url: cardImageUrl }).eq('id', guest.id);

                // Build invitation text — natural, not forced to numbers
                const inviteText = `🌹 *دعوة خاصة*\n\nالسلام عليكم يا *${c.name.trim()}*\n\nيسعدنا دعوتك لحضور *تجربة نظام لوني* ✨\n\nهذا مثال حي على رسالة الدعوة اللي توصل ضيوفك.\nالنظام يدير الردود والبطاقات — كل شي تلقائي!\n\nرد بـ \"حاضر\" للتأكيد ✅\nأو \"معتذر\" للاعتذار ❌\n\n(أو رد بأي كلمة — البوت يفهمك 🤖)`;

                // Send via WhatsApp
                addLog(`📨 [${i + 1}/${validContacts.length}] جاري الإرسال لـ ${c.name}...`);

                try {
                    let sendResult;
                    if (imageUrl) {
                        sendResult = await fetch(`${API_URL}/send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                accountId: connectedAcc.id,
                                phone: phone,
                                message: inviteText,
                                imageUrl: imageUrl
                            })
                        });
                    } else {
                        sendResult = await fetch(`${API_URL}/send-demo`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                accountId: connectedAcc.id,
                                phone: phone,
                                message: inviteText.replace('\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار', ''),
                                imageUrl: null
                            })
                        });
                    }

                    const sendData = await sendResult.json();
                    if (sendData.success) {
                        addLog(`✅ [${i + 1}/${validContacts.length}] تم الإرسال لـ ${c.name}!`);
                        // Log in DB for webhook context
                        await supabase.from('whatsapp_messages').insert({
                            event_id: event.id,
                            guest_id: guest.id,
                            phone: phone,
                            message_text: inviteText,
                            message_phase: 'invite',
                            status: 'sent',
                            sent_at: new Date().toISOString()
                        });
                    } else {
                        addLog(`⚠️ [${i + 1}] فشل إرسال لـ ${c.name}: ${sendData.error}`);
                    }
                } catch (sendErr: any) {
                    addLog(`❌ خطأ إرسال: ${sendErr.message}`);
                }

                setSendProgress(i + 1);

                // Delay between sends
                if (i < validContacts.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            addLog('🎉 تم إرسال جميع الدعوات!');
            addLog(`🔗 رابط المتابعة: ${LIVE_URL}/host/${token}`);

            // 5. Send report + dashboard link to CLIENT via WhatsApp
            if (clientPhone && connectedAcc) {
                let cPhone = clientPhone.trim().replace(/[^0-9]/g, '');
                if (cPhone.startsWith('05')) cPhone = '966' + cPhone.substring(1);
                else if (cPhone.startsWith('5') && cPhone.length === 9) cPhone = '966' + cPhone;

                const dashboardUrl = `${LIVE_URL}/host/${token}`;
                const reportMsg = `📊 *ديمو نظام لوني — جاهز!*\n━━━━━━━━━━━━━━━━━━━\n\n✅ تم إرسال *${validContacts.length}* دعوة تجريبية\n\n📱 الضيوف بيستقبلون الدعوة الحين على واتسابهم\n🔄 لما يردون (تأكيد/اعتذار) — النظام يتعامل تلقائي:\n   • المؤكد ← يوصله كرت باركود شخصي\n   • المعتذر ← رسالة لبقة\n\n👁️ *تابع النتائج لحظة بلحظة من هنا:*\n${dashboardUrl}\n\n━━━━━━━━━━━━━━━━━━━\nنظام لوني — إدارة الدعوات الذكية 🌹`;

                addLog(`📤 جاري إرسال التقرير + الرابط للعميل...`);
                try {
                    await fetch(`${API_URL}/send-demo`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accountId: connectedAcc.id,
                            phone: cPhone,
                            message: reportMsg,
                            imageUrl: null
                        })
                    });
                    addLog('✅ تم إرسال التقرير والرابط للعميل!');
                } catch (e: any) {
                    addLog(`⚠️ فشل إرسال التقرير: ${e.message}`);
                }
            }

            // Move to live view
            setStep('live');

            // Fetch initial guests
            const { data: guestList } = await supabase
                .from('guests')
                .select('id, name, phone, rsvp_status, card_image_url, rsvp_at')
                .eq('event_id', event.id);
            if (guestList) setDemoGuests(guestList);

        } catch (e: any) {
            setError(e.message);
            addLog(`❌ خطأ: ${e.message}`);
        } finally {
            setSending(false);
        }
    };

    // ===================== RENDER =====================
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white" dir="rtl">

            {/* ===== SETUP STEP ===== */}
            {step === 'setup' && (
                <div className="max-w-2xl mx-auto p-6 pt-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full mb-4">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span className="text-white/80 text-sm font-bold">ديمو تفاعلي</span>
                        </div>
                        <h1 className="text-3xl font-black mb-2">تجربة نظام لوني</h1>
                        <p className="text-white/50 text-sm">أدخل بيانات العميل المحتمل وارسل له الديمو لايف</p>
                    </div>

                    {/* Image Upload */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 mb-6">
                        <label className="text-xs font-bold text-white/70 block mb-3">📷 صورة الدعوة العامة (اختياري)</label>
                        {!generalImage ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400/50 hover:bg-white/5 transition-all"
                            >
                                <Upload className="w-8 h-8 text-white/30 mx-auto mb-2" />
                                <p className="text-white/40 text-sm">اضغط لرفع صورة الدعوة</p>
                                <p className="text-white/20 text-[10px] mt-1">JPG, PNG</p>
                            </div>
                        ) : (
                            <div className="relative rounded-xl overflow-hidden group">
                                <img src={generalImage} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => { setGeneralImage(null); setGeneralImageFile(null); }}
                                        className="p-2 bg-red-500 rounded-full text-white shadow-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </div>

                    {/* Client Phone (Event Owner) */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 mb-6">
                        <label className="text-xs font-bold text-white/70 block mb-3">📱 رقم العميل (صاحب المناسبة)</label>
                        <p className="text-white/30 text-[10px] mb-3">هذا الرقم يوصله: رابط المتابعة + ملخص الردود + إشعارات التأكيد والاعتذار</p>
                        <input
                            type="tel"
                            dir="ltr"
                            value={clientPhone}
                            onChange={e => setClientPhone(e.target.value)}
                            placeholder="05XXXXXXXX"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 text-left focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    {/* Contacts */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-xs font-bold text-white/70">👥 أرقام التجربة</label>
                            <button
                                onClick={addContact}
                                className="text-[10px] bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full hover:bg-emerald-500/30 font-bold flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> إضافة
                            </button>
                        </div>

                        <div className="space-y-3">
                            {contacts.map((c, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <span className="text-white/30 text-xs w-5 shrink-0">{i + 1}.</span>
                                    <input
                                        type="text"
                                        value={c.name}
                                        onChange={e => updateContact(i, 'name', e.target.value)}
                                        placeholder="الاسم"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                    <input
                                        type="tel"
                                        dir="ltr"
                                        value={c.phone}
                                        onChange={e => updateContact(i, 'phone', e.target.value)}
                                        placeholder="05XXXXXXXX"
                                        className="w-36 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 text-left focus:ring-1 focus:ring-emerald-500 outline-none"
                                    />
                                    {contacts.length > 1 && (
                                        <button onClick={() => removeContact(i)} className="text-red-400/50 hover:text-red-400 p-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm text-center mb-4">
                            {error}
                        </div>
                    )}

                    {/* Send Button */}
                    <button
                        onClick={startDemo}
                        disabled={sending}
                        className="w-full py-4 bg-gradient-to-l from-emerald-500 to-emerald-600 text-white font-black rounded-2xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-emerald-500/30 disabled:opacity-50 mb-4"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                جاري الإرسال ({sendProgress}/{sendTotal})...
                            </>
                        ) : (
                            <><Send className="w-5 h-5" /> أرسل الديمو</>
                        )}
                    </button>

                    {/* Send Logs */}
                    {sendLogs.length > 0 && (
                        <div className="bg-black/30 rounded-xl p-4 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1">
                            {sendLogs.map((log, i) => (
                                <div key={i} className="text-white/60">{log}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== LIVE TRACKING STEP ===== */}
            {step === 'live' && (
                <div className="max-w-4xl mx-auto p-6 pt-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <h1 className="text-2xl font-black flex items-center gap-3">
                                <BarChart3 className="w-7 h-7 text-emerald-400" />
                                متابعة الديمو — لايف
                            </h1>
                            <p className="text-white/40 text-sm mt-1">الإحصائيات تتحدث تلقائياً كل 3 ثواني</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setStep('setup'); setDemoGuests([]); setSendLogs([]); setDemoEventId(''); }}
                                className="px-4 py-2 bg-white/10 rounded-xl text-sm font-bold hover:bg-white/20 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> ديمو جديد
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'المجموع', value: demoGuests.length, color: 'from-blue-500/20 to-blue-600/20', border: 'border-blue-500/30', icon: Users },
                            { label: 'مؤكد', value: demoGuests.filter(g => g.rsvp_status === 'confirmed').length, color: 'from-emerald-500/20 to-emerald-600/20', border: 'border-emerald-500/30', icon: CheckCircle },
                            { label: 'معتذر', value: demoGuests.filter(g => g.rsvp_status === 'declined').length, color: 'from-red-500/20 to-red-600/20', border: 'border-red-500/30', icon: XCircle },
                            { label: 'بانتظار', value: demoGuests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length, color: 'from-amber-500/20 to-amber-600/20', border: 'border-amber-500/30', icon: Clock }
                        ].map((stat, i) => (
                            <div key={i} className={`bg-gradient-to-br ${stat.color} backdrop-blur rounded-2xl border ${stat.border} p-4`}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white/50 text-xs font-bold">{stat.label}</span>
                                    <stat.icon className="w-4 h-4 text-white/30" />
                                </div>
                                <div className="text-3xl font-black">{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Guest Table */}
                    <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 overflow-hidden mb-6">
                        <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
                            <h2 className="font-bold text-sm flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-400" />
                                الضيوف ({demoGuests.length})
                            </h2>
                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" title="يتحدث تلقائياً" />
                        </div>

                        <div className="divide-y divide-white/5">
                            {demoGuests.map((g, i) => (
                                <div key={g.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${g.rsvp_status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                                            g.rsvp_status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                'bg-white/10 text-white/40'
                                            }`}>
                                            {g.rsvp_status === 'confirmed' ? '✅' : g.rsvp_status === 'declined' ? '❌' : '⏳'}
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm">{g.name}</div>
                                            <div className="text-white/30 text-xs" dir="ltr">{g.phone}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${g.rsvp_status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                                            g.rsvp_status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                                'bg-white/10 text-white/40'
                                            }`}>
                                            {g.rsvp_status === 'confirmed' ? 'مؤكد' : g.rsvp_status === 'declined' ? 'معتذر' : 'بانتظار الرد'}
                                        </span>
                                        {g.rsvp_at && (
                                            <span className="text-white/20 text-[10px]">
                                                {new Date(g.rsvp_at).toLocaleTimeString('ar-SA')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Client Dashboard Link */}
                    {magicToken && (
                        <div className="bg-gradient-to-l from-purple-500/20 to-indigo-500/20 backdrop-blur rounded-2xl border border-purple-500/30 p-5">
                            <div className="flex items-start gap-4">
                                <div className="bg-purple-500/20 p-3 rounded-xl shrink-0">
                                    <Eye className="w-6 h-6 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-sm mb-1">🔗 رابط العميل (شاركه مع العميل المحتمل)</h3>
                                    <p className="text-white/40 text-xs mb-3">هذا الرابط يعطيه يتابع الإحصائيات بنفسه — نفس اللي يشوفه لما يشتري الخدمة</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`${APP_URL}/host/${magicToken}`}
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 font-mono text-left"
                                            dir="ltr"
                                        />
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${APP_URL}/host/${magicToken}`);
                                            }}
                                            className="px-4 py-2 bg-purple-500/30 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-500/40"
                                        >
                                            نسخ
                                        </button>
                                        <a
                                            href={`${APP_URL}/host/${magicToken}`}
                                            target="_blank"
                                            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1"
                                        >
                                            <Eye className="w-3 h-3" /> فتح
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Send Logs */}
                    {sendLogs.length > 0 && (
                        <details className="mt-6">
                            <summary className="text-white/30 text-xs cursor-pointer hover:text-white/50">📋 سجل العمليات ({sendLogs.length})</summary>
                            <div className="bg-black/30 rounded-xl p-4 mt-2 max-h-48 overflow-y-auto font-mono text-[10px] space-y-1">
                                {sendLogs.map((log, i) => (
                                    <div key={i} className="text-white/40">{log}</div>
                                ))}
                            </div>
                        </details>
                    )}

                    {/* Footer */}
                    <p className="text-center text-white/10 text-xs mt-8">
                        نظام لوني — إدارة الدعوات الذكية 🌹
                    </p>
                </div>
            )}
        </div>
    );
}
