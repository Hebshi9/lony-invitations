import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Check, AlertCircle, Upload, FileSpreadsheet,
    ArrowRight, Download, Sparkles, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
    analyzeExcelColumns,
    parseExcelWithMapping,
    validateGuestsData,
    type ExcelAnalysisResult
} from '../lib/excelAnalyzer';
import { v4 as uuidv4 } from 'uuid';

interface Event {
    id: string;
    name: string;
}

const UploadGuests: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const eventIdFromUrl = searchParams.get('event');

    const [step, setStep] = useState<'select' | 'upload' | 'analyze' | 'review' | 'confirm'>('select');
    const [selectedEvent, setSelectedEvent] = useState<string>(eventIdFromUrl || '');
    const [events, setEvents] = useState<Event[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<ExcelAnalysisResult | null>(null);
    const [mapping, setMapping] = useState<Record<string, number>>({});
    const [parsedGuests, setParsedGuests] = useState<any[]>([]);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (eventIdFromUrl) {
            setSelectedEvent(eventIdFromUrl);
            setStep('upload');
        }
    }, [eventIdFromUrl]);

    const fetchEvents = async () => {
        const { data } = await supabase
            .from('events')
            .select('id, name')
            .order('created_at', { ascending: false });

        if (data) setEvents(data);
    };

    const downloadSample = () => {
        const ws = {
            '!ref': 'A1:E3',
            A1: { v: 'الاسم' },
            B1: { v: 'الجوال' },
            C1: { v: 'رقم الطاولة' },
            D1: { v: 'عدد المرافقين' },
            E1: { v: 'الفئة' },
            A2: { v: 'أحمد محمد' },
            B2: { v: '0512345678' },
            C2: { v: 'T-1' },
            D2: { v: 2 },
            E2: { v: 'VIP' },
            A3: { v: 'سارة علي' },
            B3: { v: '0598765432' },
            C3: { v: 'T-2' },
            D3: { v: 1 },
            E3: { v: 'عادي' }
        };

        const wb = { Sheets: { 'الضيوف': ws }, SheetNames: ['الضيوف'] };
        const XLSX = require('xlsx');
        XLSX.writeFile(wb, 'نموذج-الضيوف.xlsx');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);
        setError(null);

        try {
            // AI Analysis
            const result = await analyzeExcelColumns(selectedFile);
            setAnalysis(result);
            setMapping(result.suggestions);
            setStep('analyze');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToReview = async () => {
        if (!file || !analysis) return;

        setLoading(true);
        try {
            // Parse with current mapping
            const guests = await parseExcelWithMapping(file, mapping);
            const validation = validateGuestsData(guests);

            setParsedGuests(validation.valid);
            setValidationResult(validation);
            setStep('review');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedEvent || parsedGuests.length === 0) return;

        setLoading(true);
        try {
            // Prepare guests for insertion
            const guestsToInsert = parsedGuests.map(guest => ({
                id: uuidv4(),
                event_id: selectedEvent,
                name: guest.name,
                phone: guest.phone || null,
                table_no: guest.table_no || null,
                companions_count: guest.companions_count || 0,
                remaining_companions: guest.companions_count || 0,
                category: guest.category || 'عادي',
                status: 'pending',
                qr_payload: uuidv4(),
                card_generated: false
            }));

            // Insert into database
            const { error: insertError } = await supabase
                .from('guests')
                .insert(guestsToInsert);

            if (insertError) throw insertError;

            setStep('confirm');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">رفع قائمة الضيوف</h1>
                    <p className="text-gray-600">رفع ملف Excel بذكاء اصطناعي لتحليل تلقائي</p>
                </div>

                {/* Step 1: Select Event */}
                {step === 'select' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>اختر الحدث</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <select
                                value={selectedEvent}
                                onChange={(e) => setSelectedEvent(e.target.value)}
                                className="w-full px-4 py-3 border rounded-lg"
                            >
                                <option value="">-- اختر حدث --</option>
                                {events.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}
                                    </option>
                                ))}
                            </select>

                            <Button
                                onClick={() => setStep('upload')}
                                disabled={!selectedEvent}
                                className="w-full"
                            >
                                متابعة <ChevronRight className="w-5 h-5 mr-2" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Upload File */}
                {step === 'upload' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="w-6 h-6" />
                                رفع ملف Excel
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Sample Download */}
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h4 className="font-bold text-blue-900 mb-2">
                                    💡 ليس لديك ملف جاهز؟
                                </h4>
                                <p className="text-sm text-blue-800 mb-3">
                                    حمّل نموذج Excel واملأه ببياناتك
                                </p>
                                <Button onClick={downloadSample} variant="outline" size="sm">
                                    <Download className="w-4 h-4 ml-2" />
                                    تحميل النموذج
                                </Button>
                            </div>

                            {/* File Input */}
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer flex flex-col items-center gap-3"
                                >
                                    <FileSpreadsheet className="w-12 h-12 text-gray-400" />
                                    <div>
                                        <p className="text-lg font-semibold text-gray-700">
                                            اضغط لرفع ملف Excel
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            يدعم: .xlsx, .xls
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {loading && (
                                <div className="text-center py-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-gray-600">جاري التحليل...</p>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <p className="text-red-800">{error}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: AI Analysis Results */}
                {step === 'analyze' && analysis && (
                    <Card>
                        <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="w-6 h-6" />
                                نتائج التحليل الذكي
                            </CardTitle>
                            <p className="text-sm text-purple-100 mt-2">
                                تم تحليل {analysis.totalRows} صف من البيانات
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            {/* Warnings */}
                            {analysis.warnings.length > 0 && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        تنبيهات:
                                    </h4>
                                    <ul className="space-y-1">
                                        {analysis.warnings.map((warning, i) => (
                                            <li key={i} className="text-sm text-yellow-800">{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Column Mappings */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-900 text-lg">تحديد الأعمدة:</h4>
                                {analysis.analysis.map((col) => (
                                    <div
                                        key={col.columnIndex}
                                        className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="font-bold text-gray-800 mb-1">
                                                    {col.columnName}
                                                </div>
                                                <div className="text-sm text-gray-600 mb-2">
                                                    عينات: {col.samples.join(' | ') || 'لا يوجد'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                {/* Confidence Badge */}
                                                {col.confidence > 0.7 && (
                                                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold whitespace-nowrap">
                                                        {Math.round(col.confidence * 100)}% متأكد
                                                    </span>
                                                )}

                                                {/* Field Selector */}
                                                <select
                                                    value={
                                                        Object.entries(mapping).find(
                                                            ([_, idx]) => idx === col.columnIndex
                                                        )?.[0] || 'ignore'
                                                    }
                                                    onChange={(e) => {
                                                        const newMapping = { ...mapping };
                                                        // Remove old mapping for this column
                                                        Object.keys(newMapping).forEach((key) => {
                                                            if (newMapping[key] === col.columnIndex) {
                                                                delete newMapping[key];
                                                            }
                                                        });
                                                        // Add new mapping
                                                        if (e.target.value !== 'ignore') {
                                                            newMapping[e.target.value] = col.columnIndex;
                                                        }
                                                        setMapping(newMapping);
                                                    }}
                                                    className="px-3 py-2 border rounded-lg min-w-[150px]"
                                                >
                                                    <option value="ignore">تجاهل</option>
                                                    <option value="name">الاسم ⭐</option>
                                                    <option value="phone">الجوال</option>
                                                    <option value="table_no">رقم الطاولة</option>
                                                    <option value="companions_count">المرافقين</option>
                                                    <option value="category">الفئة</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setStep('upload')}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    رفع ملف آخر
                                </Button>
                                <Button
                                    onClick={handleProceedToReview}
                                    disabled={!mapping.name || loading}
                                    className="flex-1"
                                >
                                    {loading ? 'جاري المعالجة...' : 'متابعة للمراجعة'}
                                    <ArrowRight className="w-5 h-5 mr-2" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 4: Review Parsed Data */}
                {step === 'review' && validationResult && (
                    <Card>
                        <CardHeader>
                            <CardTitle>مراجعة البيانات</CardTitle>
                            <p className="text-sm text-gray-600 mt-2">
                                ✅ {parsedGuests.length} ضيف جاهز للرفع
                                {validationResult.errors.length > 0 && (
                                    <span className="text-red-600 mr-2">
                                        | ❌ {validationResult.errors.length} خطأ
                                    </span>
                                )}
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Errors */}
                            {validationResult.errors.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                                    <h4 className="font-bold text-red-900 mb-3">الأخطاء المكتشفة:</h4>
                                    <div className="space-y-2">
                                        {validationResult.errors.map((err: any, i: number) => (
                                            <div key={i} className="text-sm text-red-800">
                                                <span className="font-bold">صف {err.row}:</span> {err.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-96">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-right">#</th>
                                                <th className="px-4 py-3 text-right">الاسم</th>
                                                <th className="px-4 py-3 text-right">الجوال</th>
                                                <th className="px-4 py-3 text-right">الطاولة</th>
                                                <th className="px-4 py-3 text-right">المرافقين</th>
                                                <th className="px-4 py-3 text-right">الفئة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedGuests.slice(0, 50).map((guest, i) => (
                                                <tr key={i} className="border-t hover:bg-gray-50">
                                                    <td className="px-4 py-2">{i + 1}</td>
                                                    <td className="px-4 py-2 font-semibold">{guest.name}</td>
                                                    <td className="px-4 py-2">{guest.phone || '-'}</td>
                                                    <td className="px-4 py-2">{guest.table_no || '-'}</td>
                                                    <td className="px-4 py-2">{guest.companions_count || 0}</td>
                                                    <td className="px-4 py-2">{guest.category || 'عادي'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {parsedGuests.length > 50 && (
                                    <div className="bg-gray-50 px-4 py-2 text-sm text-gray-600 text-center">
                                        وأكثر... (إجمالي: {parsedGuests.length})
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setStep('analyze')}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    تعديل التحديد
                                </Button>
                                <Button
                                    onClick={handleConfirmImport}
                                    disabled={parsedGuests.length === 0 || loading}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    {loading ? 'جاري الرفع...' : `✅ رفع ${parsedGuests.length} ضيف`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 5: Success */}
                {step === 'confirm' && (
                    <Card className="border-2 border-green-500">
                        <CardContent className="p-12 text-center">
                            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                                <Check className="w-12 h-12 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-3">
                                تم رفع الضيوف بنجاح! 🎉
                            </h2>
                            <p className="text-gray-600 mb-8">
                                تم إضافة {parsedGuests.length} ضيف إلى الحدث
                            </p>

                            <div className="flex gap-4 justify-center">
                                <Button
                                    onClick={() => navigate(`/studio?event=${selectedEvent}`)}
                                    className="bg-purple-600 hover:bg-purple-700"
                                >
                                    افتح الاستوديو لتصميم البطاقات
                                </Button>
                                <Button
                                    onClick={() => navigate('/dashboard')}
                                    variant="outline"
                                >
                                    العودة للرئيسية
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default UploadGuests;
