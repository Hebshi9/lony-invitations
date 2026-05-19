import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import geminiService from '../services/gemini-service';
import { 
    Sparkles, 
    Send, 
    Loader2, 
    CheckCircle, 
    User, 
    Phone, 
    Briefcase, 
    DollarSign, 
    Calendar,
    AlertCircle,
    ArrowRight
} from 'lucide-react';

const AIOperations: React.FC = () => {
    const [input, setInput] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleAIParsing = async () => {
        if (!input.trim()) return;
        
        setIsParsing(true);
        setMessage(null);
        try {
            const data = await geminiService.parseBusinessEntry(input);
            if (data) {
                setParsedData(data);
            } else {
                setMessage({ type: 'error', text: 'لم ينجح الذكاء الاصطناعي في تحليل النص، حاول كتابته بشكل أوضح.' });
            }
        } catch (error) {
            console.error('AI Parsing error:', error);
            setMessage({ type: 'error', text: 'حدث خطأ أثناء التواصل مع الذكاء الاصطناعي.' });
        } finally {
            setIsParsing(false);
        }
    };

    const handleSaveEntry = async () => {
        if (!parsedData) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('business_ledger')
                .insert([{
                    client_name: parsedData.clientName,
                    client_phone: parsedData.clientPhone,
                    service_type: parsedData.serviceType,
                    total_price: parsedData.totalPrice,
                    deposit_amount: parsedData.depositAmount,
                    designer_fee: parsedData.designerFee,
                    follow_up_date: parsedData.followUpDate,
                    raw_input: input,
                    ai_parsed: true
                }]);

            if (error) throw error;

            setMessage({ type: 'success', text: 'تم حفظ البيانات بنجاح وجدولتها في المركز المالي!' });
            setParsedData(null);
            setInput('');
        } catch (error: any) {
            console.error('Save error:', error);
            setMessage({ type: 'error', text: `فشل الحفظ: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 font-kufi max-w-5xl mx-auto" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-lony-navy font-amiri flex items-center gap-3">
                        <Sparkles className="text-lony-gold w-8 h-8" />
                        العمليات الذكية (AI Magic Box)
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">تحدث مع النظام ليقوم بجدولة الطلبات والمدفوعات آلياً</p>
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Section */}
                <Card className="border-none shadow-2xl bg-white overflow-hidden">
                    <CardHeader className="bg-lony-navy text-white p-6 relative">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Sparkles className="w-20 h-20" />
                        </div>
                        <CardTitle className="text-xl flex items-center gap-2 relative z-10">
                            أدخل معلومات العميل
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <p className="text-sm text-gray-500 leading-relaxed">
                            اكتب وصفاً للطلب كما ترسل لزميلك (مثلاً: جاني عميل اسمه فلان، جواله كذا، دفع كذا لخدمة كذا...).
                        </p>
                        <textarea
                            className="w-full h-48 p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-lony-gold/50 focus:ring-0 outline-none transition-all resize-none text-lg leading-relaxed text-gray-700"
                            placeholder="مثال: جاني عميل اسمه محمد، رقمه 055... دفع لي 1500 ريال عربون لبكج كامل. المصممة طلبت 200. تابع معاه بعد اسبوع."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <Button
                            onClick={handleAIParsing}
                            disabled={isParsing || !input.trim()}
                            className="w-full bg-lony-navy hover:bg-lony-navy/90 text-white py-6 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            {isParsing ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> جاري التحليل برؤية الذكاء الاصطناعي...</>
                            ) : (
                                <><Send className="w-5 h-5 ml-2" /> تحليل البيانات وتجهيزها</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview Section */}
                <div className="relative">
                    {!parsedData && !isParsing && (
                        <div className="h-full flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-200">
                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Sparkles className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="text-gray-400 text-center text-sm">بانتظار إدخال البيانات للتحليل...</p>
                        </div>
                    )}

                    {isParsing && (
                        <Card className="border-none shadow-sm animate-pulse h-full bg-gray-50/50">
                            <CardContent className="p-8 space-y-6">
                                <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                                <div className="space-y-3">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="h-12 bg-white rounded-xl"></div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {parsedData && (
                        <Card className="border-lony-gold/30 border-2 shadow-2xl bg-white overflow-hidden animate-in zoom-in-95 duration-300">
                            <CardHeader className="bg-lony-gold text-lony-navy p-6">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <CheckCircle className="w-6 h-6" />
                                    مراجعة البيانات المستخرجة
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <DataRow icon={<User />} label="اسم العميل" value={parsedData.clientName} />
                                    <DataRow icon={<Phone />} label="رقم الجوال" value={parsedData.clientPhone} />
                                    <DataRow icon={<Briefcase />} label="نوع الخدمة" value={parsedData.serviceType} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <DataRow icon={<DollarSign />} label="المبلغ الكلي" value={parsedData.totalPrice} isMoney />
                                        <DataRow icon={<DollarSign />} label="العربون" value={parsedData.depositAmount} isMoney highlight />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DataRow icon={<DollarSign />} label="تكلفة المصممة" value={parsedData.designerFee} isMoney color="text-red-500" />
                                        <DataRow icon={<Calendar />} label="تاريخ المتابعة" value={parsedData.followUpDate} />
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                                    <Button
                                        onClick={handleSaveEntry}
                                        disabled={isSaving}
                                        className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد وحفظ في السجل المالي'}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={() => setParsedData(null)}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        إلغاء وإعادة المحاولة
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

const DataRow = ({ icon, label, value, isMoney = false, highlight = false, color = "text-lony-navy" }: any) => (
    <div className={`flex items-center gap-4 p-3 rounded-xl border border-gray-100 ${highlight ? 'bg-lony-gold/10 border-lony-gold/20' : 'bg-gray-50'}`}>
        <div className={`p-2 rounded-lg bg-white shadow-sm ${highlight ? 'text-lony-gold' : 'text-lony-navy'}`}>
            {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <div className="flex-grow">
            <span className="text-[10px] text-gray-400 block uppercase font-bold">{label}</span>
            <span className={`font-bold text-sm ${color}`}>
                {value || '---'} {isMoney && value ? 'SAR' : ''}
            </span>
        </div>
    </div>
);

export default AIOperations;
