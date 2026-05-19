import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
    Upload, 
    Calendar, 
    FileText, 
    CheckCircle, 
    Loader2, 
    ArrowRight, 
    ArrowLeft, 
    Table, 
    Sparkles, 
    MapPin, 
    User, 
    MessageSquare,
    Image as ImageIcon,
    Clipboard,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { aiService } from '../lib/gemini';
import * as XLSX from 'xlsx';

const ClientIntake: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [parsing, setParsing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [order, setOrder] = useState<any>(null);

    // Intake Method
    const [intakeMethod, setIntakeMethod] = useState<'paste' | 'upload'>('paste');
    const [pastedText, setPastedText] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        eventTitle: '',
        eventDate: '',
        eventLocation: '',
        notes: ''
    });

    const [file, setFile] = useState<File | null>(null);
    const [invitationImage, setInvitationImage] = useState<File | null>(null);
    const [parsedGuests, setParsedGuests] = useState<any[]>([]);

    useEffect(() => {
        if (token) fetchOrder();
    }, [token]);

    const fetchOrder = async () => {
        try {
            const { data, error } = await supabase
                .from('business_ledger')
                .select('*')
                .or(`magic_token.eq.${token},id.eq.${token}`)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setOrder(data);
                setFormData({
                    eventTitle: data.event_details?.title || '',
                    eventDate: data.order_date || '',
                    eventLocation: data.event_details?.location || '',
                    notes: data.notes || ''
                });
            }
        } catch (err) {
            console.error('Error fetching order:', err);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasteProcess = async () => {
        if (!pastedText.trim()) return;
        setParsing(true);
        try {
            const guests = await aiService.parseGuestText(pastedText);
            setParsedGuests(guests);
            setStep(3);
        } catch (error) {
            alert('حدث خطأ أثناء تحليل النص. يرجى التأكد من وضوح الأسماء والأرقام.');
        } finally {
            setParsing(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setParsing(true);

            try {
                let guests = [];
                if (selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
                    const data = await new Promise<any[]>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            try {
                                const bstr = evt.target?.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const wsname = wb.SheetNames[0];
                                const ws = wb.Sheets[wsname];
                                const jsonData = XLSX.utils.sheet_to_json(ws);
                                resolve(jsonData);
                            } catch (err) { reject(err); }
                        };
                        reader.onerror = reject;
                        reader.readAsBinaryString(selectedFile);
                    });
                    guests = await aiService.processGuestJson(data);
                } else {
                    guests = await aiService.parseGuestList(selectedFile);
                }
                setParsedGuests(guests);
                setStep(3);
            } catch (error) {
                alert('لم نتمكن من قراءة الملف. يرجى التأكد من الصيغة.');
            } finally {
                setParsing(false);
            }
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            let invitationUrl = order?.event_details?.invitation_url;

            // Upload Image if provided
            if (invitationImage) {
                const fileExt = invitationImage.name.split('.').pop();
                const fileName = `invitation_${order.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('invitations')
                    .upload(fileName, invitationImage);
                if (!uploadError) {
                    invitationUrl = supabase.storage.from('invitations').getPublicUrl(fileName).data.publicUrl;
                }
            }

            // Update Business Ledger
            const { error } = await supabase
                .from('business_ledger')
                .update({
                    order_status: 'قيد التنفيذ',
                    event_details: {
                        ...order?.event_details,
                        title: formData.eventTitle,
                        location: formData.eventLocation,
                        invitation_url: invitationUrl,
                        guests: parsedGuests
                    },
                    notes: formData.notes
                })
                .eq('id', order.id);

            if (error) throw error;
            setSuccess(true);
        } catch (error: any) {
            alert('حدث خطأ أثناء إرسال البيانات: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center p-6 text-white font-kufi">
                <Loader2 className="w-12 h-12 animate-spin text-lony-gold mb-4" />
                <p className="animate-pulse">جاري تجهيز بوابتكم الخاصة...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-6 text-center font-kufi">
                <Card className="max-w-md w-full p-10 rounded-[2.5rem] bg-white text-right">
                    <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">الرابط غير صالح</h2>
                    <p className="text-gray-500 mb-8">عذراً، يبدو أن الرابط الذي استخدمته غير صحيح أو قديم.</p>
                    <Button onClick={() => window.close()} className="w-full bg-lony-navy">إغلاق الصفحة</Button>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4 font-kufi" dir="rtl">
                <Card className="max-w-lg w-full text-center p-12 shadow-2xl rounded-[3rem] border-none bg-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lony-gold via-yellow-200 to-lony-gold"></div>
                    <div className="flex justify-center mb-8">
                        <div className="bg-green-100 p-6 rounded-full animate-bounce">
                            <CheckCircle className="w-20 h-20 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-bold text-lony-navy mb-4 font-amiri">شكراً لثقتك بـ لوني</h2>
                    <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                        تم استلام بيانات ضيوفك بنجاح ({parsedGuests.length} ضيف).<br />
                        يقوم فريقنا الآن بمراجعة الطلب لبدء عملية الإرسال فوراً.
                    </p>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
                        <p className="text-sm text-gray-500">سيصلك إشعار عبر الواتساب فور بدء الحملة.</p>
                    </div>
                    <Button onClick={() => window.close()} className="w-full bg-lony-navy py-6 text-lg rounded-2xl shadow-lg">
                        العودة للواتساب
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0E1A] font-kufi relative overflow-hidden text-white" dir="rtl">
            {/* Background Aesthetics */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lony-gold/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
                
                {/* Header */}
                <header className="text-center mb-12 animate-in fade-in zoom-in duration-700">
                    <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl px-6 py-2 rounded-full border border-white/10 mb-6">
                        <Sparkles className="w-5 h-5 text-lony-gold" />
                        <span className="text-lony-gold font-bold tracking-widest text-xs uppercase">LONY LUXURY CONCIERGE</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold text-white font-amiri mb-4">بوابة ضيوف لوني</h1>
                    <p className="text-gray-400 text-lg max-w-xl mx-auto leading-relaxed">
                        أهلاً بكِ <span className="text-lony-gold font-bold">{order.client_name}</span>، دعينا ننظم قائمة ضيوفكِ بلمسة من الذكاء.
                    </p>
                </header>

                {/* Progress Bar */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-4 bg-white/5 p-2 rounded-full border border-white/10">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 ${step >= s ? 'bg-lony-gold text-lony-navy shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-110' : 'bg-white/10 text-gray-500'}`}>
                                    {s === 1 ? <Calendar size={20} /> : s === 2 ? <User size={20} /> : <CheckCircle size={20} />}
                                </div>
                                {s < 3 && <div className={`h-1 w-12 mx-2 rounded-full transition-all duration-500 ${step > s ? 'bg-lony-gold' : 'bg-white/10'}`}></div>}
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="shadow-2xl border-none rounded-[3rem] bg-white/5 backdrop-blur-2xl overflow-hidden border border-white/10">
                    <CardContent className="p-8 md:p-12">

                        {/* Step 1: Event Info Confirmation */}
                        {step === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-500">
                                <div className="text-right border-r-4 border-lony-gold pr-6 mb-10">
                                    <h2 className="text-3xl font-bold text-white mb-2 font-amiri">تأكيد تفاصيل المناسبة</h2>
                                    <p className="text-gray-400">تأكدي من صحة المعلومات التي ستظهر في الدعوة</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-3 text-right">
                                        <label className="text-sm font-bold text-lony-gold/80 flex items-center gap-2 justify-end">
                                            عنوان المناسبة <FileText size={16} />
                                        </label>
                                        <input
                                            name="eventTitle"
                                            value={formData.eventTitle}
                                            onChange={handleInputChange}
                                            dir="rtl"
                                            className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all text-white placeholder-gray-600"
                                            placeholder="زفاف فلان وفلانة"
                                        />
                                    </div>
                                    <div className="space-y-3 text-right">
                                        <label className="text-sm font-bold text-lony-gold/80 flex items-center gap-2 justify-end">
                                            موقع القاعة (Maps) <MapPin size={16} />
                                        </label>
                                        <input
                                            name="eventLocation"
                                            value={formData.eventLocation}
                                            onChange={handleInputChange}
                                            dir="ltr"
                                            className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all text-white placeholder-gray-600 text-right"
                                            placeholder="الصقي رابط قوقل ماب هنا"
                                        />
                                    </div>
                                    <div className="space-y-3 text-right">
                                        <label className="text-sm font-bold text-lony-gold/80 flex items-center gap-2 justify-end">
                                            صورة الدعوة (اختياري) <ImageIcon size={16} />
                                        </label>
                                        <div className="relative group cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*,video/*"
                                                onChange={(e) => setInvitationImage(e.target.files?.[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group-hover:bg-white/10 transition-all">
                                                <span className="text-gray-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {invitationImage ? invitationImage.name : 'اختاري الملف...'}
                                                </span>
                                                <Upload size={18} className="text-lony-gold" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-right">
                                        <label className="text-sm font-bold text-lony-gold/80 flex items-center gap-2 justify-end">
                                            ملاحظات للمصمم <MessageSquare size={16} />
                                        </label>
                                        <input
                                            name="notes"
                                            value={formData.notes}
                                            onChange={handleInputChange}
                                            dir="rtl"
                                            className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all text-white placeholder-gray-600"
                                            placeholder="أي تعليمات إضافية..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-8">
                                    <Button onClick={() => setStep(2)} className="bg-lony-gold text-lony-navy px-12 py-7 rounded-2xl hover:bg-white shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all flex items-center gap-4 text-xl font-black">
                                        بدء تنظيم الضيوف
                                        <ArrowLeft className="w-6 h-6" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Guest Collection (AI Parser) */}
                        {step === 2 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-500">
                                <div className="text-right border-r-4 border-lony-gold pr-6 mb-10">
                                    <h2 className="text-3xl font-bold text-white mb-2 font-amiri">تجميع الضيوف بالذكاء الاصطناعي</h2>
                                    <p className="text-gray-400">انسخي قائمة الواتساب كما هي، وسنتكفل بالباقي</p>
                                </div>

                                <div className="flex gap-4 p-1 bg-white/5 rounded-2xl border border-white/10 mb-8">
                                    <button 
                                        onClick={() => setIntakeMethod('paste')}
                                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${intakeMethod === 'paste' ? 'bg-lony-gold text-lony-navy' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Clipboard size={18} /> لصق نص الواتساب
                                    </button>
                                    <button 
                                        onClick={() => setIntakeMethod('upload')}
                                        className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${intakeMethod === 'upload' ? 'bg-lony-gold text-lony-navy' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Upload size={18} /> رفع ملف إكسل
                                    </button>
                                </div>

                                {parsing ? (
                                    <div className="text-center py-20 space-y-8 bg-white/5 rounded-[2rem] border border-white/10">
                                        <div className="relative inline-block">
                                            <div className="absolute inset-0 bg-lony-gold blur-[40px] opacity-30 animate-pulse rounded-full"></div>
                                            <Loader2 className="w-20 h-20 animate-spin text-lony-gold relative z-10" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-white mb-2">جاري تحليل بياناتكِ بذكاء...</h3>
                                            <p className="text-gray-500">نقوم بتنظيم الأسماء والأرقام وفهم المرافقين</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {intakeMethod === 'paste' ? (
                                            <div className="space-y-6">
                                                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-4 focus-within:ring-2 focus-within:ring-lony-gold/50 transition-all">
                                                    <textarea 
                                                        value={pastedText}
                                                        onChange={(e) => setPastedText(e.target.value)}
                                                        dir="rtl"
                                                        className="w-full h-80 bg-transparent border-none outline-none resize-none text-white text-lg placeholder-gray-700 p-4"
                                                        placeholder="انسخي الأسماء من الواتساب وألصقيها هنا... مثال:
أم محمد 0500000000
سارة الحربي ومعها مرافقين
نورة فلان 055..."
                                                    />
                                                </div>
                                                <Button 
                                                    onClick={handlePasteProcess}
                                                    disabled={!pastedText.trim()}
                                                    className="w-full py-8 bg-white text-lony-navy rounded-2xl font-black text-xl hover:bg-lony-gold transition-all flex items-center justify-center gap-4 shadow-xl"
                                                >
                                                    <Sparkles className="text-lony-gold" />
                                                    تنسيق القائمة فوراً
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="group bg-white/5 border-2 border-dashed border-white/10 hover:border-lony-gold rounded-[2rem] p-16 text-center transition-all cursor-pointer relative overflow-hidden">
                                                <input
                                                    type="file"
                                                    onChange={handleFileChange}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                    accept=".xlsx,.xls,.csv"
                                                />
                                                <div className="flex flex-col items-center gap-6">
                                                    <div className="bg-lony-gold/10 p-8 rounded-full">
                                                        <Table size={40} className="text-lony-gold" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-2xl text-white mb-2">اسحبي ملف الإكسل هنا</p>
                                                        <p className="text-gray-500">أو اضغطي لاختيار ملف من جهازك</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex justify-start">
                                            <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-500 hover:text-white">
                                                السابق
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 3: Review & Confirm */}
                        {step === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-500">
                                <div className="text-right border-r-4 border-lony-gold pr-6 mb-10">
                                    <h2 className="text-3xl font-bold text-white mb-2 font-amiri">مراجعة القائمة النهائية</h2>
                                    <p className="text-gray-400">تأكدي من صحة الأسماء قبل الاعتماد</p>
                                </div>

                                <div className="bg-lony-gold/10 p-6 rounded-2xl border border-lony-gold/20 flex items-center justify-between">
                                    <ShieldCheck className="w-10 h-10 text-lony-gold" />
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className="font-bold text-white text-lg">مكتشف {parsedGuests.length} ضيف</p>
                                            <p className="text-sm text-lony-gold/70">جاهزون للإرسال</p>
                                        </div>
                                        <div className="w-12 h-12 bg-lony-gold rounded-full flex items-center justify-center text-lony-navy font-black text-xl">
                                            {parsedGuests.length}
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-hidden border border-white/10 rounded-[2rem] bg-white/5">
                                    <table className="w-full text-right">
                                        <thead className="bg-white/10 text-lony-gold font-bold">
                                            <tr>
                                                <th className="p-5">الاسم</th>
                                                <th className="p-5">الجوال</th>
                                                <th className="p-5 text-center">المرافقين</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5 text-gray-300">
                                            {parsedGuests.map((g, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-5 font-bold text-white">{g.name}</td>
                                                    <td className="p-5 font-mono text-sm">{g.phone || '-'}</td>
                                                    <td className="p-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${g.companions_count > 0 ? 'bg-lony-gold text-lony-navy' : 'bg-white/10 text-gray-500'}`}>
                                                            {g.companions_count || 0}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-between pt-8">
                                    <Button variant="ghost" onClick={() => setStep(2)} className="text-gray-500 hover:text-white">
                                        تعديل القائمة
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="bg-lony-gold text-lony-navy px-16 py-8 rounded-2xl shadow-[0_0_40px_rgba(212,175,55,0.4)] hover:scale-105 transition-all text-2xl font-black"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'تأكيد وإرسال لـ لوني'}
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>

                <footer className="text-center mt-16 space-y-4">
                    <p className="text-gray-600 text-sm tracking-widest font-bold uppercase">LUXURY INVITATION MANAGEMENT SYSTEM</p>
                    <p className="text-lony-gold/40 text-xs">© 2025 LONY DESIGN • ALL RIGHTS RESERVED</p>
                </footer>
            </div>
        </div>
    );
};

export default ClientIntake;
