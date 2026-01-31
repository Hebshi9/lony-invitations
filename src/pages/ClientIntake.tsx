import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Upload, Calendar, FileText, CheckCircle, Loader2, ArrowRight, ArrowLeft, Table, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { aiService } from '../lib/gemini';
import * as XLSX from 'xlsx';

const ClientIntake: React.FC = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [success, setSuccess] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        clientName: '',
        clientPhone: '',
        clientEmail: '',
        eventTitle: '',
        eventDate: '',
        eventLocation: '',
        eventType: 'wedding',
        notes: ''
    });

    const [file, setFile] = useState<File | null>(null);
    const [parsedGuests, setParsedGuests] = useState<any[]>([]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setParsing(true);

            try {
                let guests = [];

                // Check if Excel
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

                    // Send to AI for cleaning/mapping
                    guests = await aiService.processGuestJson(data);
                } else {
                    // Image or Text
                    guests = await aiService.parseGuestList(selectedFile);
                }

                setParsedGuests(guests);
                setStep(4);
            } catch (error) {
                console.error(error);
                alert('لم نتمكن من قراءة الملف. يرجى التأكد من الصيغة (Excel أو صورة واضحة).');
            } finally {
                setParsing(false);
            }
        }
    };

    const handleSubmit = async () => {
        if (!formData.clientName || !formData.clientPhone || !file) {
            alert('الرجاء تعبئة الحقول المطلوبة');
            return;
        }

        setLoading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('intake_files')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const fileUrl = supabase.storage.from('intake_files').getPublicUrl(fileName).data.publicUrl;

            const { error: insertError } = await supabase
                .from('client_intake_requests')
                .insert({
                    client_name: formData.clientName,
                    client_phone: formData.clientPhone,
                    client_email: formData.clientEmail,
                    event_details: {
                        title: formData.eventTitle,
                        date: formData.eventDate,
                        location: formData.eventLocation,
                        type: formData.eventType,
                        notes: formData.notes
                    },
                    guest_list_url: fileUrl,
                    ai_analysis: parsedGuests,
                    status: 'new'
                });

            if (insertError) throw insertError;

            setSuccess(true);
        } catch (error: any) {
            console.error('Error submitting request:', error);
            alert('حدث خطأ أثناء إرسال الطلب: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-lony-cream flex items-center justify-center p-4 font-kufi" dir="rtl">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
                <Card className="max-w-lg w-full text-center p-10 shadow-2xl rounded-[2rem] border-none relative z-10 bg-white/90 backdrop-blur">
                    <div className="flex justify-center mb-8">
                        <div className="bg-lony-green/10 p-6 rounded-full animate-bounce">
                            <CheckCircle className="w-20 h-20 text-lony-green" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-bold text-lony-navy mb-4 font-amiri">تم استلام طلبك بنجاح</h2>
                    <p className="text-gray-600 mb-10 text-lg leading-relaxed">
                        شكراً لك <span className="font-bold text-lony-gold">{formData.clientName}</span>.<br />
                        لقد استلمنا قائمة الضيوف ({parsedGuests.length} ضيف).<br />
                        سيقوم فريقنا بمراجعة الطلب والتواصل معك قريباً.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline" className="border-lony-gold text-lony-gold hover:bg-lony-gold hover:text-white transition-all">
                        إرسال طلب جديد
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-lony-cream font-kufi relative overflow-hidden" dir="rtl">
            {/* Background Decor */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-lony-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-lony-navy/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">

                {/* Header */}
                <header className="text-center mb-12 space-y-4">
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-6 py-2 rounded-full shadow-sm border border-lony-gold/20 mb-4">
                        <Sparkles className="w-5 h-5 text-lony-gold" />
                        <span className="text-lony-navy font-bold tracking-wide">LONY DESIGN</span>
                    </div>
                    <h1 className="text-5xl font-bold text-lony-navy font-amiri">صمم دعوة مناسبتك بذكاء</h1>
                    <p className="text-gray-500 text-lg max-w-xl mx-auto">
                        ارفع قائمة الضيوف، وسيقوم نظامنا الذكي بتنظيمها وتجهيز بطاقات الدعوة لك ولضيوفك في ثوانٍ.
                    </p>
                </header>

                {/* Progress Steps */}
                <div className="flex justify-center mb-12">
                    <div className="flex items-center gap-4">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-500 ${step >= s ? 'bg-lony-gold text-white shadow-lg scale-110' : 'bg-white text-gray-300 border border-gray-200'}`}>
                                    {s}
                                </div>
                                {s < 3 && <div className={`h-1 w-16 mx-2 rounded-full transition-all duration-500 ${step > s ? 'bg-lony-gold' : 'bg-gray-200'}`}></div>}
                            </div>
                        ))}
                    </div>
                </div>

                <Card className="shadow-2xl border-none rounded-[2rem] bg-white/80 backdrop-blur-sm overflow-hidden">
                    <CardContent className="p-10">

                        {/* Step 1: Client Info */}
                        {step === 1 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-lony-navy mb-2">لنبدأ بمعلوماتك</h2>
                                    <p className="text-gray-400 text-sm">كيف يمكننا التواصل معك؟</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">الاسم الكامل</label>
                                        <input
                                            name="clientName"
                                            value={formData.clientName}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                            placeholder="الاسم الكريم"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">رقم الجوال (واتساب)</label>
                                        <input
                                            name="clientPhone"
                                            value={formData.clientPhone}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                            placeholder="05xxxxxxxx"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-bold text-gray-600">البريد الإلكتروني (اختياري)</label>
                                        <input
                                            name="clientEmail"
                                            value={formData.clientEmail}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button onClick={() => setStep(2)} className="bg-lony-navy text-white px-10 py-4 rounded-xl hover:bg-lony-navy/90 shadow-lg hover:shadow-xl transition-all flex items-center gap-3 text-lg">
                                        التالي
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Event Details */}
                        {step === 2 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-lony-navy mb-2">تفاصيل المناسبة السعيدة</h2>
                                    <p className="text-gray-400 text-sm">أخبرنا المزيد عن حدثك</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">عنوان المناسبة</label>
                                        <input
                                            name="eventTitle"
                                            value={formData.eventTitle}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                            placeholder="مثال: زفاف محمد وسارة"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">نوع المناسبة</label>
                                        <select
                                            name="eventType"
                                            value={formData.eventType}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                        >
                                            <option value="wedding">حفل زفاف</option>
                                            <option value="graduation">تخرج</option>
                                            <option value="business">اجتماع عمل</option>
                                            <option value="other">أخرى</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">التاريخ</label>
                                        <input
                                            type="date"
                                            name="eventDate"
                                            value={formData.eventDate}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-600">الموقع (القاعة)</label>
                                        <input
                                            name="eventLocation"
                                            value={formData.eventLocation}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all"
                                            placeholder="اسم القاعة أو الفندق"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-bold text-gray-600">ملاحظات إضافية</label>
                                        <textarea
                                            name="notes"
                                            value={formData.notes}
                                            onChange={handleInputChange}
                                            className="w-full p-4 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-lony-gold/50 outline-none transition-all h-32 resize-none"
                                            placeholder="أي تفاصيل أخرى..."
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between pt-4">
                                    <Button variant="ghost" onClick={() => setStep(1)} className="text-gray-500 hover:text-lony-navy">
                                        السابق
                                    </Button>
                                    <Button onClick={() => setStep(3)} className="bg-lony-navy text-white px-10 py-4 rounded-xl hover:bg-lony-navy/90 shadow-lg hover:shadow-xl transition-all flex items-center gap-3 text-lg">
                                        التالي
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Guest List Upload */}
                        {step === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-lony-navy mb-2">قائمة الضيوف</h2>
                                    <p className="text-gray-400 text-sm">ارفع الملف وسنتكفل بالباقي</p>
                                </div>

                                {parsing ? (
                                    <div className="text-center py-16 space-y-6 bg-gray-50 rounded-3xl border-2 border-dashed border-lony-gold/30">
                                        <div className="relative inline-block">
                                            <div className="absolute inset-0 bg-lony-gold blur-xl opacity-20 animate-pulse rounded-full"></div>
                                            <Loader2 className="w-16 h-16 animate-spin text-lony-gold relative z-10" />
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-lony-navy">جاري تحليل البيانات...</p>
                                            <p className="text-gray-500 mt-2">نستخدم الذكاء الاصطناعي لاستخراج الأسماء والمرافقين</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="group bg-white border-2 border-dashed border-gray-200 hover:border-lony-gold rounded-3xl p-12 text-center transition-all cursor-pointer relative overflow-hidden">
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,image/*"
                                            />
                                            <div className="absolute inset-0 bg-lony-gold/0 group-hover:bg-lony-gold/5 transition-colors z-10"></div>

                                            <div className="flex flex-col items-center gap-6 relative z-10">
                                                <div className="bg-lony-cream p-6 rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
                                                    <Upload className="w-10 h-10 text-lony-gold" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-2xl text-lony-navy mb-2">اضغط لرفع الملف</p>
                                                    <p className="text-gray-400">Excel, PDF, Word, أو حتى صورة للقائمة</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-lony-gold/10 p-6 rounded-2xl flex items-start gap-4">
                                            <Sparkles className="w-6 h-6 text-lony-gold flex-shrink-0 mt-1" />
                                            <div>
                                                <p className="font-bold text-lony-navy text-sm mb-1">ذكاء اصطناعي متطور</p>
                                                <p className="text-gray-600 text-xs leading-relaxed">
                                                    لا تقلق بشأن تنسيق الملف. نظامنا قادر على قراءة الجداول، الصور، والنصوص العشوائية واستخراج البيانات بدقة عالية.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-4">
                                            <Button variant="ghost" onClick={() => setStep(2)} className="text-gray-500 hover:text-lony-navy">
                                                السابق
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 4: Review & Submit */}
                        {step === 4 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold text-lony-navy mb-2">مراجعة البيانات</h2>
                                    <p className="text-gray-400 text-sm">تأكد من صحة البيانات المستخرجة</p>
                                </div>

                                <div className="bg-green-50 p-6 rounded-2xl border border-green-100 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-green-800 text-lg">تم استخراج {parsedGuests.length} ضيف</p>
                                        <p className="text-sm text-green-600">جاهز للإرسال</p>
                                    </div>
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                </div>

                                <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm">
                                    <table className="w-full text-sm text-right">
                                        <thead className="bg-gray-50 text-gray-600 font-bold">
                                            <tr>
                                                <th className="p-4">الاسم</th>
                                                <th className="p-4">الجوال</th>
                                                <th className="p-4">المرافقين</th>
                                                <th className="p-4">الطاولة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {parsedGuests.slice(0, 5).map((g, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 font-bold text-lony-navy">{g.name}</td>
                                                    <td className="p-4 font-mono text-gray-500">{g.phone || '-'}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${g.companions_count > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            {g.companions_count || 0}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-500">{g.table_no || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {parsedGuests.length > 5 && (
                                    <p className="text-center text-xs text-gray-400 font-medium">...و {parsedGuests.length - 5} آخرين</p>
                                )}

                                <div className="flex justify-between pt-6">
                                    <Button variant="ghost" onClick={() => setStep(3)} className="text-gray-500 hover:text-lony-navy">
                                        إعادة الرفع
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        className="bg-lony-gold text-lony-navy hover:bg-lony-gold/90 px-12 py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 text-lg font-bold"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : 'اعتماد وإرسال الطلب'}
                                        {!loading && <CheckCircle className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>

                <footer className="text-center mt-12 text-gray-400 text-sm">
                    <p>© 2025 Lony Design. جميع الحقوق محفوظة.</p>
                </footer>
            </div>
        </div>
    );
};

export default ClientIntake;
