import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Check, AlertCircle, MessageCircle, ArrowRight, FileSpreadsheet, Wand2, Download, HelpCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { analyzeGuestList } from '../lib/gemini';

interface Event {
    id: string;
    name: string;
}

interface GuestPreview {
    id: string;
    name: string;
    phone?: string;
    table_no?: string;
    companions_count?: number;
    remaining_companions?: number;
    category?: string;
    custom_fields?: any;
    qr_payload: string;
    [key: string]: any;
}

const UploadGuests: React.FC = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [guests, setGuests] = useState<GuestPreview[]>([]);
    const [rawFile, setRawFile] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);

    // Intake Settings
    const [listType, setListType] = useState<'single' | 'multiple'>('single');
    const [hasCompanions, setHasCompanions] = useState<boolean>(false);
    const [defaultCompanions, setDefaultCompanions] = useState<number>(0);
    const [showHelp, setShowHelp] = useState<boolean>(false);

    const [mapping, setMapping] = useState<{
        name: string;
        phone: string;
        table: string;
        companions: string;
        category: string;
    }>({ name: '', phone: '', table: '', companions: '', category: '' });

    const [step, setStep] = useState<'upload' | 'mapping' | 'confirmation' | 'preview' | 'sending'>('upload');
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [anomalies, setAnomalies] = useState<string[]>([]);

    // Fast Queue State
    const [currentGuestIndex, setCurrentGuestIndex] = useState(0);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('id, name').order('created_at', { ascending: false });
        if (data) setEvents(data);
    };

    const downloadSample = () => {
        const sampleData = [
            { "الاسم": "أحمد محمد", "الجوال": "0501234567", "عدد المرافقين": "2", "الطاولة": "A1", "الفئة": "VIP" },
            { "الاسم": "سارة خالد", "الجوال": "0559876543", "عدد المرافقين": "0", "الطاولة": "B3", "الفئة": "عام" }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sample");
        XLSX.writeFile(wb, "sample_guest_list.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            if (data.length > 0) {
                const fileHeaders = Object.keys(data[0] as object);
                setHeaders(fileHeaders);
                setRawFile(data);

                // Auto-analyze with AI
                setAnalyzing(true);
                setStep('mapping');
                try {
                    const suggestion = await analyzeGuestList(fileHeaders, data.slice(0, 5));
                    if (suggestion) {
                        setMapping({
                            name: suggestion.name || '',
                            phone: suggestion.phone || '',
                            table: suggestion.table || '',
                            companions: suggestion.companions || '',
                            category: suggestion.category || ''
                        });
                        setMessage({ type: 'success', text: 'تم تحليل الأعمدة بذكاء! يرجى التأكد من صحة الاختيارات.' });
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setAnalyzing(false);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    const parseCompanions = (val: any, rowName: string): number => {
        if (!hasCompanions) return 0;

        // 1. Explicit number
        if (typeof val === 'number') return val;
        if (!isNaN(parseInt(val))) return parseInt(val);

        // 2. Text patterns
        const str = String(val || '').toLowerCase();
        if (str.includes('guest + 3') || str.includes('+3')) return 3;
        if (str.includes('guest + 2') || str.includes('+2')) return 2;
        if (str.includes('guest + 1') || str.includes('+1')) return 1;
        if (str.includes('pax')) {
            const match = str.match(/(\d+)\s*pax/);
            if (match) return Math.max(0, parseInt(match[1]) - 1); // "4 pax" means guest + 3
        }

        // 3. Arabic patterns
        if (str.includes('مع زوجته') || str.includes('وزوجته')) return 1;
        if (str.includes('وأبنائه الاثنين')) return 2;
        if (str.includes('وأطفاله الثلاثة')) return 3;

        // 4. Implicit family
        if (str.includes('وعائلته') || str.includes('and family') || rowName.includes('وعائلته')) {
            return defaultCompanions > 0 ? defaultCompanions : 2; // Default fallback
        }

        return 0;
    };

    const cleanName = (name: string): string => {
        return name
            .replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.|Eng\.|Prof\.|Doctor|Sheikh|Abu|Umm|الشيخ|الدكتور|المهندس|الاستاذ|أبو|ابو|ام|آل)\s+/i, '')
            .trim();
    };

    const cleanPhone = (phone: string | number | undefined): string | undefined => {
        if (!phone) return undefined;
        let p = String(phone).replace(/\D/g, ''); // Remove non-digits

        // Normalize to +966
        if (p.startsWith('05')) {
            p = '966' + p.substring(1);
        } else if (p.startsWith('5') && p.length === 9) {
            p = '966' + p;
        }

        // Check if valid length (approximate)
        if (p.length < 9) return undefined;

        return '+' + p;
    };

    const processMapping = () => {
        if (!mapping.name) {
            setMessage({ type: 'error', text: 'يجب تحديد عمود الاسم على الأقل' });
            return;
        }

        const newAnomalies: string[] = [];
        const parsedGuests = rawFile.map((row, idx) => {
            const rawName = row[mapping.name];
            if (!rawName) {
                newAnomalies.push(`صف ${idx + 2}: اسم مفقود`);
                return null;
            }

            const name = cleanName(rawName);
            const phone = cleanPhone(mapping.phone ? row[mapping.phone] : undefined);
            const table_no = mapping.table ? row[mapping.table] : undefined;
            const category = mapping.category ? row[mapping.category] : undefined;

            // Handle companions logic
            let companions_count = 0;
            if (mapping.companions) {
                companions_count = parseCompanions(row[mapping.companions], rawName);
            } else if (hasCompanions && (rawName.includes('+') || rawName.includes('وعائلته'))) {
                // Try to infer from name if no column mapped but toggle is ON
                companions_count = parseCompanions(rawName, rawName);
            }

            // Handle Category Logic
            let finalCategory = category;
            if (listType === 'multiple' && mapping.category && !headers.includes(mapping.category)) {
                // If listType is multiple, mapping.category holds the fixed value (e.g., "Men")
                // unless it happens to match a header name (edge case, but unlikely if we use specific values)
                // Better approach: check if mapping.category is one of our fixed options and NOT in headers
                finalCategory = mapping.category;
            } else if (mapping.category && headers.includes(mapping.category)) {
                finalCategory = row[mapping.category];
            }

            // Validation checks
            if (phone && String(phone).length < 9) newAnomalies.push(`صف ${idx + 2}: رقم هاتف قصير (${name})`);

            // Custom fields
            const custom_fields: any = {};
            headers.forEach(h => {
                if (h !== mapping.name && h !== mapping.phone && h !== mapping.table && h !== mapping.companions && h !== mapping.category) {
                    custom_fields[h] = row[h];
                }
            });

            return {
                id: uuidv4(),
                name,
                phone,
                table_no,
                category: finalCategory,
                companions_count,
                remaining_companions: companions_count, // Initialize remaining
                custom_fields,
                qr_payload: uuidv4(),
                ...row
            };
        }).filter(g => g !== null) as GuestPreview[];

        setGuests(parsedGuests);
        setAnomalies(newAnomalies);
        setStep('confirmation');
    };

    const handleImport = async () => {
        if (!selectedEventId) {
            setMessage({ type: 'error', text: 'الرجاء اختيار حدث أولاً' });
            return;
        }

        setUploading(true);
        try {
            const guestsToInsert = guests.map(guest => ({
                event_id: selectedEventId,
                name: guest.name,
                phone: guest.phone,
                table_no: guest.table_no,
                companions_count: guest.companions_count,
                remaining_companions: guest.remaining_companions,
                category: guest.category,
                custom_fields: guest.custom_fields,
                qr_token: uuidv4(), // Use secure token
                status: 'pending'
            }));

            const { error } = await supabase.from('guests').insert(guestsToInsert);
            if (error) throw error;

            setMessage({ type: 'success', text: 'تم الحفظ بنجاح!' });
            setStep('preview'); // Or go to sending directly
        } catch (error: any) {
            setMessage({ type: 'error', text: `فشل الاستيراد: ${error.message}` });
        } finally {
            setUploading(false);
        }
    };

    const startSending = () => {
        setStep('sending');
        setCurrentGuestIndex(0);
    };

    const sendWhatsApp = () => {
        const guest = guests[currentGuestIndex];
        if (!guest.phone) {
            alert('لا يوجد رقم هاتف');
            return;
        }
        let phone = String(guest.phone).replace(/\D/g, '');
        if (!phone.startsWith('966') && phone.startsWith('05')) phone = '966' + phone.substring(1);

        const link = `${window.location.origin}/v/${guest.id}`; // Should use qr_token in real app
        const text = `أهلاً بك يا ${guest.name}،\nنتشرف بدعوتك لحضور حفلنا.\nالرجاء تأكيد الحضور عبر الرابط التالي:\n${link}`;
        window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`, '_blank');
    };

    const nextGuest = () => {
        if (currentGuestIndex < guests.length - 1) setCurrentGuestIndex(prev => prev + 1);
        else {
            alert('انتهت القائمة!');
            setStep('preview');
        }
    };

    if (step === 'sending') {
        const guest = guests[currentGuestIndex];
        const progress = ((currentGuestIndex + 1) / guests.length) * 100;
        return (
            <div className="space-y-6 font-kufi" dir="rtl">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-lony-navy font-amiri">الطابور السريع</h1>
                    <Button variant="outline" onClick={() => setStep('preview')}>إغلاق</Button>
                </div>
                <Card className="bg-white shadow-xl border-none">
                    <CardContent className="p-8 flex flex-col items-center space-y-8">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-green-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="text-gray-500">ضيف {currentGuestIndex + 1} من {guests.length}</p>
                        <div className="text-center space-y-2">
                            <h2 className="text-4xl font-bold text-lony-navy">{guest.name}</h2>
                            <p className="text-xl text-lony-gold">{guest.phone || 'لا يوجد رقم هاتف'}</p>
                        </div>
                        <Button onClick={sendWhatsApp} className="w-full max-w-md bg-green-600 hover:bg-green-700 text-white py-6 text-lg gap-2 shadow-lg">
                            <MessageCircle className="w-6 h-6" /> إرسال واتساب
                        </Button>
                        <div className="flex gap-4 w-full max-w-md">
                            <Button onClick={nextGuest} variant="outline" className="flex-1">تخطي</Button>
                            <Button onClick={nextGuest} className="flex-1 bg-lony-navy text-white">التالي <ArrowRight className="w-4 h-4 mr-2" /></Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-kufi" dir="rtl">
            <h1 className="text-3xl font-bold text-lony-navy font-amiri">رفع قائمة الضيوف</h1>

            <Card className="border-none shadow-md">
                <CardHeader>
                    <CardTitle className="text-right text-lony-navy flex justify-between items-center">
                        <span>
                            {step === 'upload' && '1. إعدادات القائمة ورفع الملف'}
                            {step === 'mapping' && '2. مطابقة الأعمدة'}
                            {step === 'confirmation' && '3. مراجعة البيانات'}
                            {step === 'preview' && '4. الحفظ النهائي'}
                        </span>
                        {step === 'upload' && (
                            <Button variant="ghost" size="sm" onClick={() => setShowHelp(!showHelp)} className="text-lony-gold">
                                <HelpCircle className="w-5 h-5 ml-2" /> تعليمات هامة
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {step === 'upload' && (
                        <>
                            {showHelp && (
                                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 space-y-2 border border-blue-100">
                                    <h4 className="font-bold">تعليمات هامة لضمان دقة البيانات:</h4>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>يرجى استخدام الملف النموذجي لضمان توافق الأعمدة.</li>
                                        <li>تأكد من فصل الأسماء عن الألقاب (مثل دكتور، مهندس) للحصول على أفضل نتيجة.</li>
                                        <li>إذا كانت القائمة تحتوي على مرافقين، يفضل وضع عددهم في عمود منفصل.</li>
                                        <li>صيغ المرافقين المدعومة: "Guest + 3", "4 pax", "أحمد وعائلته".</li>
                                    </ul>
                                    <Button variant="outline" size="sm" onClick={downloadSample} className="mt-2 gap-2">
                                        <Download className="w-4 h-4" /> تحميل ملف نموذجي
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 text-right">اختر الحدث</label>
                                        <select
                                            className="w-full p-3 bg-gray-50 border-gray-200 rounded-xl text-right"
                                            value={selectedEventId}
                                            onChange={(e) => setSelectedEventId(e.target.value)}
                                        >
                                            <option value="">-- اختر حدث --</option>
                                            {events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 text-right">نوع القائمة</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="listType" checked={listType === 'single'} onChange={() => setListType('single')} />
                                                <span>قائمة موحدة</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" name="listType" checked={listType === 'multiple'} onChange={() => setListType('multiple')} />
                                                <span>فئات متعددة</span>
                                            </label>
                                        </div>

                                        {listType === 'multiple' && (
                                            <div className="mt-2 animate-in slide-in-from-top-2">
                                                <label className="block text-xs text-gray-500 mb-1">تصنيف هذه القائمة</label>
                                                <select
                                                    className="w-full p-2 border rounded-lg text-sm bg-blue-50 border-blue-200"
                                                    value={mapping.category} // Reuse mapping.category for the batch category
                                                    onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                                                >
                                                    <option value="">-- اختر التصنيف --</option>
                                                    <option value="رجال">رجال</option>
                                                    <option value="نساء">نساء</option>
                                                    <option value="VIP">VIP</option>
                                                    <option value="عام">عام</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={hasCompanions} onChange={(e) => setHasCompanions(e.target.checked)} className="w-4 h-4 text-lony-navy rounded" />
                                            <span className="font-medium text-gray-700">هل تحتوي القائمة على مرافقين؟</span>
                                        </label>
                                        {hasCompanions && (
                                            <div className="mr-6">
                                                <label className="block text-xs text-gray-500 mb-1">عدد المرافقين الافتراضي (في حال عدم التحديد)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={defaultCompanions}
                                                    onChange={(e) => setDefaultCompanions(parseInt(e.target.value))}
                                                    className="w-24 p-2 border rounded-lg text-center"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="relative border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 group">
                                    <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="bg-green-50 p-4 rounded-full group-hover:scale-110 transition-transform">
                                        <FileSpreadsheet className="w-8 h-8 text-green-700" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-gray-900">اضغط لرفع ملف Excel</p>
                                        <p className="text-sm text-gray-500 mt-1">سيقوم الذكاء الاصطناعي بالتعرف على الأعمدة تلقائياً</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-6">
                            {analyzing ? (
                                <div className="text-center py-8 text-lony-gold animate-pulse">
                                    <Wand2 className="w-12 h-12 mx-auto mb-4" />
                                    <p>جاري تحليل الملف بالذكاء الاصطناعي...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-6">
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                                            <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                                <Wand2 className="w-4 h-4" />
                                                الأعمدة المكتشفة في ملف Excel
                                            </h4>
                                            <div className="flex flex-wrap gap-2">
                                                {headers.map(h => (
                                                    <span key={h} className="px-3 py-1 bg-white rounded-full text-sm border border-blue-200 text-blue-900">
                                                        {h}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-600">
                                            قم بمطابقة كل عمود من ملفك مع الحقول المطلوبة أدناه:
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                                    عمود الاسم (إجباري) <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    className={`w-full p-2 border rounded-lg ${mapping.name ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}
                                                    value={mapping.name}
                                                    onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                                                >
                                                    <option value="">-- اختر العمود --</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                {mapping.name && <p className="text-xs text-green-600 mt-1">✓ تم الاختيار</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">عمود الجوال</label>
                                                <select
                                                    className={`w-full p-2 border rounded-lg ${mapping.phone ? 'bg-green-50 border-green-300' : ''}`}
                                                    value={mapping.phone}
                                                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                                                >
                                                    <option value="">-- تجاهل --</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                {mapping.phone && <p className="text-xs text-green-600 mt-1">✓ تم الاختيار</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">عمود الطاولة</label>
                                                <select
                                                    className={`w-full p-2 border rounded-lg ${mapping.table ? 'bg-green-50 border-green-300' : ''}`}
                                                    value={mapping.table}
                                                    onChange={(e) => setMapping({ ...mapping, table: e.target.value })}
                                                >
                                                    <option value="">-- تجاهل --</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                {mapping.table && <p className="text-xs text-green-600 mt-1">✓ تم الاختيار</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">عدد المرافقين</label>
                                                <select
                                                    className={`w-full p-2 border rounded-lg ${mapping.companions ? 'bg-green-50 border-green-300' : ''}`}
                                                    value={mapping.companions}
                                                    onChange={(e) => setMapping({ ...mapping, companions: e.target.value })}
                                                >
                                                    <option value="">-- تجاهل (أو استنتاج تلقائي) --</option>
                                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                                {mapping.companions && <p className="text-xs text-green-600 mt-1">✓ تم الاختيار</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">الفئة (VIP/عام)</label>
                                                {listType === 'single' ? (
                                                    <select
                                                        className={`w-full p-2 border rounded-lg ${mapping.category ? 'bg-green-50 border-green-300' : ''}`}
                                                        value={mapping.category}
                                                        onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                                                    >
                                                        <option value="">-- تجاهل --</option>
                                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                                    </select>
                                                ) : (
                                                    <div className="w-full p-2 border rounded-lg bg-gray-100 text-gray-500 text-sm">
                                                        تم تحديد الفئة كـ: <strong>{mapping.category || 'غير محدد'}</strong>
                                                    </div>
                                                )}
                                                {mapping.category && <p className="text-xs text-green-600 mt-1">✓ تم الاختيار</p>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setStep('upload')}>إلغاء</Button>
                                        <Button onClick={processMapping} className="bg-lony-navy text-white">تحليل ومراجعة</Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'confirmation' && (
                        <div className="space-y-6">
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                <h4 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> تقرير التحليل
                                </h4>
                                <ul className="text-sm text-yellow-700 space-y-1">
                                    <li>تم العثور على <strong>{guests.length}</strong> ضيف.</li>
                                    <li>تم اكتشاف <strong>{guests.filter(g => g.companions_count && g.companions_count > 0).length}</strong> ضيف مع مرافقين.</li>
                                    {anomalies.length > 0 && (
                                        <li className="text-red-600 font-bold mt-2">تنبيهات ({anomalies.length}):</li>
                                    )}
                                    {anomalies.slice(0, 5).map((a, i) => <li key={i} className="text-red-500">- {a}</li>)}
                                    {anomalies.length > 5 && <li className="text-red-500">...و {anomalies.length - 5} آخرين</li>}
                                </ul>
                            </div>

                            <div className="border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50 sticky top-0">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500">الاسم (بعد التنظيف)</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500">مرافقين</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500">الفئة</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500">الهاتف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {guests.slice(0, 10).map((guest) => (
                                            <tr key={guest.id}>
                                                <td className="px-6 py-4 text-sm font-medium">{guest.name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {guest.companions_count || 0}
                                                    {guest.companions_count !== guest.remaining_companions && <span className="text-xs text-red-500 mr-1">(خطأ)</span>}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{guest.category || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{guest.phone || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-center text-xs text-gray-400 p-2">عرض أول 10 سجلات فقط</p>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setStep('mapping')} disabled={uploading}>تعديل المطابقة</Button>
                                <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700 text-white" disabled={uploading}>
                                    {uploading ? 'جاري الحفظ...' : 'اعتماد وحفظ نهائي'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4 text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-lony-navy">تم حفظ القائمة بنجاح!</h3>
                            <p className="text-gray-500">تم إضافة {guests.length} ضيف إلى الحدث.</p>
                            <div className="flex justify-center gap-4 mt-8">
                                <Button variant="outline" onClick={() => { setGuests([]); setStep('upload'); }}>رفع ملف آخر</Button>
                                <Button onClick={startSending} className="bg-lony-navy text-white gap-2">
                                    <MessageCircle className="w-4 h-4" /> الذهاب للطابور السريع
                                </Button>
                            </div>
                        </div>
                    )}

                    {message && (
                        <div className={`p-4 rounded-xl flex items-center gap-2 flex-row-reverse ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span>{message.text}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default UploadGuests;
