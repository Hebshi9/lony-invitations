import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    Database,
    Upload,
    Download,
    Eye,
    Palette,
    Image as ImageIcon,
    FileText,
    ArrowRight,
    ArrowLeft,
    CheckCircle,
    Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { Event, Guest } from '../../types';
import CanvasEditor, { CanvasElement } from '../../components/editor/CanvasEditor';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCodeLib from 'qrcode';

type StudioStep = 'data' | 'design' | 'preview' | 'generate';
type ExportFormat = 'zip' | 'pdf';

const InvitationStudio: React.FC = () => {
    // Pipeline State
    const [currentStep, setCurrentStep] = useState<StudioStep>('data');
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [guests, setGuests] = useState<Guest[]>([]);

    // Data Input State
    const [inputMethod, setInputMethod] = useState<'excel' | 'existing'>('existing');
    const [excelFile, setExcelFile] = useState<any[]>([]);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [excelMapping, setExcelMapping] = useState({ name: '', phone: '', table: '' });

    // Design State
    const [backgroundUrl, setBackgroundUrl] = useState<string>('');
    const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [cardDimensions, setCardDimensions] = useState<{ width: number; height: number } | undefined>(undefined);

    // Generation State
    const [previewCards, setPreviewCards] = useState<string[]>([]);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [exportFormat, setExportFormat] = useState<ExportFormat>('zip');

    // UI Feedback
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Initial Load
    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            fetchExistingGuests();
        }
    }, [selectedEventId]);

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (data) setEvents(data);
    };

    const fetchExistingGuests = async () => {
        if (!selectedEventId) return;
        const { data } = await supabase.from('guests').select('*').eq('event_id', selectedEventId).order('serial', { ascending: true });
        if (data) {
            setGuests(data);
            if (data.length > 0 && currentStep === 'data') {
                setInputMethod('existing');
                // Auto-advance logic for better UX
                setCurrentStep('design');
                showMessage('success', `تم تحميل ${data.length} ضيف. انتقلنا للتصميم مباشرة!`);
            }
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // --- STEP 1: DATA HANDLERS ---
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
            if (data.length > 0) {
                const headers = Object.keys(data[0] as object);
                setExcelHeaders(headers);
                setExcelFile(data);
                // Auto-map
                setExcelMapping({
                    name: headers.find(h => /name|اسم/i.test(h)) || '',
                    phone: headers.find(h => /phone|mobile|جوال|هاتف/i.test(h)) || '',
                    table: headers.find(h => /table|طاولة/i.test(h)) || ''
                });
                showMessage('success', `تم قراءة ${data.length} صف`);
            }
        };
        reader.readAsBinaryString(file);
    };

    const saveExcelGuests = async () => {
        if (!selectedEventId || !excelMapping.name) return showMessage('error', 'حدد الحدث وعمود الاسم');
        setLoading(true);
        try {
            const newGuests = excelFile.map((row: any, idx) => ({
                event_id: selectedEventId,
                name: row[excelMapping.name],
                phone: row[excelMapping.phone] || null,
                table_no: row[excelMapping.table] || null,
                serial: String(guests.length + idx + 1).padStart(3, '0'),
                qr_payload: uuidv4(), // Changed to match schema
                status: 'pending'
            }));
            const { error } = await supabase.from('guests').insert(newGuests);
            if (error) throw error;
            showMessage('success', 'تم حفظ الضيوف بنجاح');
            fetchExistingGuests();
            setInputMethod('existing');
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- STEP 2: DESIGN HANDLERS ---
    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setBackgroundUrl(url);
        }
    };

    // --- STEP 3: PREVIEW/EXPORT CORE LOGIC ---
    const generateCards = async (guestList: Guest[]): Promise<string[]> => {
        const img = new Image();
        img.src = backgroundUrl;
        await new Promise(r => img.onload = r);

        const canvas = document.createElement('canvas');
        canvas.width = cardDimensions ? cardDimensions.width : img.width;
        canvas.height = cardDimensions ? cardDimensions.height : img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const results: string[] = [];

        for (const guest of guestList) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            for (const el of canvasElements) {
                const x = (el.x / 100) * canvas.width;
                const y = (el.y / 100) * canvas.height;

                if (el.type === 'qr') {
                    // Use qr_payload as per schema
                    const qrContent = guest.qr_payload || guest.id;
                    let size = el.width || el.fontSize || 150;

                    const qrDataUrl = await QRCodeLib.toDataURL(qrContent, {
                        width: size,
                        margin: 0,
                        color: {
                            dark: el.qrColor || '#000000',
                            light: el.qrBgColor === 'transparent' ? '#00000000' : (el.qrBgColor || '#ffffff')
                        }
                    });
                    const qrImg = new Image();
                    qrImg.src = qrDataUrl;
                    await new Promise(r => qrImg.onload = r);

                    ctx.drawImage(qrImg, x - (size / 2), y - (size / 2), size, size);
                } else if (el.type === 'text') {
                    ctx.fillStyle = el.color;
                    let fontSize = el.fontSize || 30;

                    const weight = el.fontWeight || 'normal';
                    const family = el.fontFamily || 'Arial';
                    ctx.font = `${weight} ${fontSize}px ${family}`;

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    let text = el.content || '';
                    if (el.label === 'اسم الضيف') text = guest.name;
                    if (el.label === 'رقم الطاولة') text = guest.table_no || '';
                    if (el.label === 'serial') text = guest.serial || '';

                    if (el.prefix) text = `${el.prefix} ${text}`;
                    ctx.fillText(text, x, y);
                }
            }
            results.push(canvas.toDataURL('image/jpeg', 0.9));
        }
        return results;
    };

    const generatePreview = async () => {
        if (!backgroundUrl || canvasElements.length === 0) return showMessage('error', 'التصميم غير مكتمل');
        setLoading(true);
        try {
            const sampleGuests = guests.slice(0, 3);
            const cards = await generateCards(sampleGuests);
            setPreviewCards(cards);
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!previewCards.length && !confirm('لم تقم بالمعاينة. هل تريد المتابعة؟')) return;
        setGenerating(true);
        setProgress(0);

        try {
            const img = new Image();
            img.src = backgroundUrl;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = cardDimensions ? cardDimensions.width : img.width;
            canvas.height = cardDimensions ? cardDimensions.height : img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas error");

            const zip = new JSZip();

            for (let i = 0; i < guests.length; i++) {
                const guest = guests[i];
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                for (const el of canvasElements) {
                    const x = (el.x / 100) * canvas.width;
                    const y = (el.y / 100) * canvas.height;

                    if (el.type === 'qr') {
                        const qrContent = guest.qr_payload || guest.id;
                        const size = el.width || el.fontSize || 150;
                        const qrDataUrl = await QRCodeLib.toDataURL(qrContent, {
                            width: size, margin: 0,
                            color: { dark: el.qrColor || '#000000', light: el.qrBgColor === 'transparent' ? '#00000000' : (el.qrBgColor || '#ffffff') }
                        });
                        const qrImg = new Image();
                        qrImg.src = qrDataUrl;
                        await new Promise(r => qrImg.onload = r);
                        ctx.drawImage(qrImg, x - (size / 2), y - (size / 2), size, size);
                    } else if (el.type === 'text') {
                        ctx.fillStyle = el.color;
                        let fontSize = el.fontSize || 30;
                        const weight = el.fontWeight || 'normal';
                        const family = el.fontFamily || 'Arial';
                        ctx.font = `${weight} ${fontSize}px ${family}`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        let text = el.content || '';
                        if (el.label === 'اسم الضيف') text = guest.name;
                        if (el.label === 'رقم الطاولة') text = guest.table_no || '';
                        if (el.label === 'serial') text = guest.serial || '';
                        if (el.prefix) text = `${el.prefix} ${text}`;

                        ctx.fillText(text, x, y);
                    }
                }

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const fileName = `invite_${guest.serial || i + 1}_${guest.name.replace(/\s+/g, '_')}.jpg`;
                zip.file(fileName, dataUrl.split(',')[1], { base64: true });
                setProgress(Math.round(((i + 1) / guests.length) * 100));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `invitations_${guests.length}.zip`);
            showMessage('success', 'تم التحميل بنجاح');

        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setGenerating(false);
            setProgress(0);
        }
    };

    // --- RENDER ---
    const steps = [
        { id: 'data', label: '1. البيانات', icon: Database },
        { id: 'design', label: '2. التصميم', icon: Palette },
        { id: 'preview', label: '3. المعاينة', icon: Eye },
        { id: 'generate', label: '4. التصدير', icon: Download },
    ];

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans" dir="rtl">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header */}
                <div className="bg-white p-4 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold text-lony-navy">🏭 مصنع الدعوات</h1>
                        {selectedEventId && <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">الحدث: {events.find(e => e.id === selectedEventId)?.name}</span>}
                    </div>
                    {/* Progress Bar */}
                    <div className="flex justify-between relative px-4">
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -z-0 mx-8 -translate-y-1/2" />
                        {steps.map((s, idx) => {
                            const isActive = s.id === currentStep;
                            const isCompleted = steps.findIndex(x => x.id === currentStep) > idx;
                            return (
                                <div key={s.id} className="relative z-10 flex flex-col items-center bg-white px-2 cursor-pointer" onClick={() => { if (isCompleted) setCurrentStep(s.id as any) }}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${isActive ? 'bg-lony-gold text-white shadow-lg scale-110' :
                                        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                                        }`}>
                                        <s.icon className="w-5 h-5" />
                                    </div>
                                    <span className={`text-xs font-bold ${isActive ? 'text-lony-navy' : 'text-gray-500'}`}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {message && (
                    <div className={`p-4 rounded-lg text-center font-bold animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                {/* STEP 1: DATA */}
                {currentStep === 'data' && (
                    <div className="grid md:grid-cols-3 gap-6 animate-in slide-in-from-right-4">
                        <Card className="md:col-span-1">
                            <CardHeader><CardTitle>اختر الحدث</CardTitle></CardHeader>
                            <CardContent>
                                <select className="w-full p-3 border rounded-lg bg-gray-50" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                                    <option value="">-- اختر --</option>
                                    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <div className="mt-6 text-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    <p className="text-sm text-gray-500">إجمالي الضيوف</p>
                                    <p className="text-4xl font-bold text-blue-600 mt-2">{guests.length}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-2">
                            <CardHeader><CardTitle>مصدر البيانات</CardTitle></CardHeader>
                            <CardContent>
                                <div className="flex gap-2 mb-6">
                                    <Button variant={inputMethod === 'existing' ? 'default' : 'outline'} onClick={() => setInputMethod('existing')} className="flex-1">
                                        قاعدة البيانات
                                    </Button>
                                    <Button variant={inputMethod === 'excel' ? 'default' : 'outline'} onClick={() => setInputMethod('excel')} className="flex-1">
                                        رفع Excel جديد
                                    </Button>
                                </div>

                                {inputMethod === 'existing' && (
                                    <div className="text-center py-8">
                                        {guests.length > 0 ? (
                                            <div className="text-green-600 font-bold text-lg">
                                                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                                                البيانات جاهزة ({guests.length} ضيف)
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">لا يوجد ضيوف في هذا الحدث. يمكنك رفع ملف Excel.</p>
                                        )}
                                    </div>
                                )}

                                {inputMethod === 'excel' && (
                                    <div className="space-y-4">
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition" onClick={() => document.getElementById('xls')?.click()}>
                                            <input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" id="xls" />
                                            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                            <p className="font-bold text-gray-600">اضغط لرفع ملف Excel</p>
                                        </div>
                                        {excelFile.length > 0 && (
                                            <div className="flex gap-2 items-center bg-green-50 p-4 rounded">
                                                <span className="text-green-700 font-bold flex-1">تمت قراءة {excelFile.length} سجل</span>
                                                <select className="p-2 border rounded" onChange={e => setExcelMapping({ ...excelMapping, name: e.target.value })}>
                                                    <option value="">اختر عمود الاسم</option>
                                                    {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                <Button onClick={saveExcelGuests} disabled={loading}>حفظ</Button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {guests.length > 0 && (
                                    <Button className="w-full mt-4 bg-lony-navy text-white" size="lg" onClick={() => setCurrentStep('design')}>
                                        انتقل للتصميم <ArrowRight className="mr-2" />
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* STEP 2: DESIGN */}
                {currentStep === 'design' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div className="flex justify-between items-center">
                            <Button variant="outline" onClick={() => setCurrentStep('data')}> <ArrowLeft className="ml-2 w-4 h-4" /> العودة للبيانات </Button>
                            {backgroundUrl && (
                                <Button className="bg-lony-navy text-white px-8" onClick={() => setCurrentStep('preview')}>
                                    معاينة التصميم <ArrowRight className="mr-2" />
                                </Button>
                            )}
                        </div>

                        {!backgroundUrl ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-24 text-center hover:bg-white hover:shadow-lg transition cursor-pointer bg-gray-50" onClick={() => document.getElementById('bg-up')?.click()}>
                                <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" id="bg-up" />
                                <ImageIcon className="w-24 h-24 mx-auto text-gray-300 mb-4" />
                                <h3 className="text-2xl font-bold text-gray-600">ارفع تصميم الدعوة (فارغ)</h3>
                                <p className="text-gray-400 mt-2">نقبل JPG, PNG بأي دقة</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-8 h-[600px]">
                                {/* Preview Side */}
                                <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-center relative overflow-hidden shadow-2xl">
                                    <img src={backgroundUrl} className="max-w-full max-h-full object-contain" />
                                    {/* Overlay Elements Preview */}
                                    {canvasElements.map(el => (
                                        <div key={el.id} className="absolute bg-white/50 border border-white text-xs px-1"
                                            style={{ left: `${el.x}%`, top: `${el.y}%`, transform: 'translate(-50%, -50%)' }}>
                                            {el.type === 'qr' ? 'QR' : el.label}
                                        </div>
                                    ))}
                                </div>

                                {/* Controls Side */}
                                <div className="bg-white rounded-xl shadow border p-8 flex flex-col justify-center items-center text-center space-y-6">
                                    <Palette className="w-16 h-16 text-lony-gold" />
                                    <h2 className="text-3xl font-bold text-gray-800">استوديو التصميم</h2>
                                    <p className="text-gray-500 text-lg max-w-xs">اضبط أماكن النصوص ورمز QR بدقة باستخدام المحرر المتقدم</p>

                                    <Button size="lg" className="w-full py-6 text-xl bg-lony-navy hover:bg-black text-white shadow-xl transform transition hover:scale-105" onClick={() => setShowEditor(true)}>
                                        فتح المحرر المتقدم
                                    </Button>

                                    <Button variant="ghost" className="text-red-500" onClick={() => setBackgroundUrl('')}>
                                        تغيير الخلفية
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: PREVIEW */}
                {currentStep === 'preview' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep('design')}> <ArrowLeft className="ml-2 w-4 h-4" /> تعديل التصميم </Button>
                            {previewCards.length > 0 && <Button className="bg-green-600 text-white" onClick={() => setCurrentStep('generate')}>التالي: التصدير <ArrowRight className="mr-2" /></Button>}
                        </div>

                        <div className="bg-white p-8 rounded-xl shadow border text-center min-h-[400px]">
                            <h2 className="text-2xl font-bold mb-8">معاينة حية ببيانات حقيقية</h2>

                            {previewCards.length === 0 ? (
                                <div className="py-12">
                                    <Button size="lg" onClick={generatePreview} disabled={loading} className="px-12 py-6 text-xl">
                                        {loading ? <Loader2 className="animate-spin ml-2" /> : <Eye className="ml-2 w-6 h-6" />}
                                        إنشاء المعاينة
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {previewCards.slice(0, 3).map((src, i) => (
                                        <div key={i} className="group relative">
                                            <div className="absolute -top-3 right-4 bg-lony-navy text-white text-xs px-2 py-1 rounded shadow z-10">
                                                {guests[i]?.name}
                                            </div>
                                            <img src={src} className="w-full rounded-lg shadow-lg border hover:scale-105 transition-transform duration-300" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 4: EXPORT */}
                {currentStep === 'generate' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in zoom-in-95">
                        <Card className="border-t-4 border-lony-gold shadow-2xl">
                            <CardHeader className="text-center bg-gray-50 border-b pb-8 pt-8">
                                <Download className="w-16 h-16 mx-auto text-lony-navy mb-4" />
                                <CardTitle className="text-3xl font-bold">تصدير الدعوات</CardTitle>
                                <p className="text-gray-500 mt-2">أنت على وشك تصدير <span className="text-lony-gold font-bold text-xl">{guests.length}</span> دعوة</p>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">

                                <div className="space-y-4">
                                    <label className="font-bold block">خيارات التصدير:</label>
                                    <div className="flex gap-4">
                                        <div onClick={() => setExportFormat('zip')} className={`flex-1 p-4 border rounded-xl cursor-pointer flex items-center gap-3 ${exportFormat === 'zip' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : ''}`}>
                                            <div className="bg-white p-2 rounded shadow-sm"><ImageIcon className="w-6 h-6 text-blue-600" /></div>
                                            <div>
                                                <div className="font-bold">صور (ZIP)</div>
                                                <div className="text-xs text-gray-500">للواتساب (JPG)</div>
                                            </div>
                                        </div>
                                        <div className="flex-1 p-4 border rounded-xl opacity-50 cursor-not-allowed flex items-center gap-3">
                                            <div className="bg-white p-2 rounded shadow-sm"><FileText className="w-6 h-6 text-red-600" /></div>
                                            <div>
                                                <div className="font-bold">PDF للطباعة</div>
                                                <div className="text-xs text-user-500">قريباً</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {generating && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold text-gray-500">
                                            <span>جاري المعالجة...</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="h-4 bg-gray-100 rounded-full overflow-hidden border">
                                            <div className="h-full bg-gradient-to-r from-lony-gold to-yellow-300 transition-all duration-300" style={{ width: `${progress}%` }} />
                                        </div>
                                    </div>
                                )}

                                <Button size="lg" className="w-full py-8 text-2xl font-bold bg-green-600 hover:bg-green-700 text-white shadow-xl" onClick={handleExport} disabled={generating}>
                                    {generating ? <Loader2 className="animate-spin w-8 h-8" /> : 'بدء التصدير الآن'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Editor Modal */}
            {showEditor && (
                <CanvasEditor
                    backgroundUrl={backgroundUrl}
                    initialElements={canvasElements}
                    onClose={() => setShowEditor(false)}
                    onSave={(elements, dimensions) => {
                        setCanvasElements(elements);
                        if (dimensions) setCardDimensions(dimensions);
                        setShowEditor(false);
                        showMessage('success', 'تم حفظ التصميم');
                    }}
                    availableFields={['name', 'serial', 'table_no', 'qr_code']}
                />
            )}
        </div>
    );
};

export default InvitationStudio;
