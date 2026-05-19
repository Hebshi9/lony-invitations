import { useState } from 'react';
import { FileSpreadsheet, FileArchive, MessageSquare, CheckCircle, AlertCircle, Send, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import smartMatcher from '../services/smart-card-matcher';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Guest {
    id: string;
    name: string;
    phone: string;
    cardImage?: any;
    matched: boolean;
    matchScore?: number;
    matchMethod?: string;
}

/**
 * Quick WhatsApp Event Upload - Advanced Version
 * Supports: Excel, WhatsApp Lists, ZIP files with smart matching
 */
export default function QuickWhatsAppUpload() {
    const [step, setStep] = useState(1);
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [venue, setVenue] = useState('');
    const [locationUrl, setLocationUrl] = useState('');
    const [groomName, setGroomName] = useState('');
    const [brideName, setBrideName] = useState('');
    const [inputMethod, setInputMethod] = useState<'excel' | 'whatsapp' | null>(null);
    const [guestsData, setGuestsData] = useState<Guest[]>([]);
    const [cardImages, setCardImages] = useState<any[]>([]);
    const [matches, setMatches] = useState<Guest[]>([]);
    const [uploading, setUploading] = useState(false);
    const [matching, setMatching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [matchProgress, setMatchProgress] = useState(0);

    /**
     * Handle Excel Upload
     */
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(worksheet);

            const guests: Guest[] = json.map((row: any, index) => ({
                id: `guest-${Date.now()}-${index}`,
                name: row['الاسم'] || row['Name'] || row['name'] || '',
                phone: smartMatcher.normalizePhone(row['الرقم'] || row['Phone'] || row['phone'] || ''),
                matched: false
            }));

            setGuestsData(guests);
            setInputMethod('excel');
            setStep(2);
        };
        reader.readAsArrayBuffer(file);
    };

    /**
     * Handle WhatsApp List Paste
     */
    const handleWhatsAppPaste = (text: string) => {
        const guests = smartMatcher.parseWhatsAppList(text);
        setGuestsData(guests as Guest[]);
        setInputMethod('whatsapp');
        setStep(2);
    };

    /**
     * Handle ZIP Upload
     */
    const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setMatching(true);
        setMatchProgress(0);

        try {
            // Extract images from ZIP files
            const images = await smartMatcher.extractFromZip(files);
            setCardImages(images);

            // Auto-match with guests
            if (guestsData.length > 0) {
                const matched = await smartMatcher.matchGuestsToCards(
                    guestsData,
                    images,
                    (progress) => setMatchProgress(progress * 100)
                );
                setMatches(matched as Guest[]);
            } else {
                setCardImages(images);
            }

            setStep(3);
        } catch (error) {
            console.error('Error processing ZIP:', error);
            alert('خطأ في معالجة ملف ZIP');
        } finally {
            setMatching(false);
        }
    };

    /**
     * Handle individual images upload
     */
    const handleImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        const imageData = files.map(file => ({
            filename: file.name,
            blob: file,
            url: URL.createObjectURL(file)
        }));

        setCardImages(imageData);

        // Auto-match
        if (guestsData.length > 0) {
            setMatching(true);
            const matched = await smartMatcher.matchGuestsToCards(
                guestsData,
                imageData,
                (progress) => setMatchProgress(progress * 100)
            );
            setMatches(matched as Guest[]);
            setMatching(false);
        }

        setStep(3);
    };

    /**
     * Create Event and Send
     */
    const handleCreateAndSend = async () => {
        setUploading(true);
        setProgress(0);

        try {
            // 1. Create Event
            const { data: event, error: eventError } = await supabase
                .from('events')
                .insert([{
                    name: eventName,
                    date: eventDate,
                    location: venue || 'رفع سريع',
                    venue: venue,
                    location_maps_url: locationUrl,
                    groom_name: groomName,
                    bride_name: brideName,
                    description: `تم الرفع من ${inputMethod === 'whatsapp' ? 'قائمة WhatsApp' : 'Excel'}`
                }])
                .select()
                .single();

            if (eventError) throw eventError;
            setProgress(20);

            // 2. Upload card images
            const uploadedCards: any[] = [];
            const matchesToUse = matches.length > 0 ? matches : guestsData;

            for (let i = 0; i < matchesToUse.length; i++) {
                const match = matchesToUse[i];
                if (!match.cardImage) continue;

                const fileName = `${event.id}/${match.id}-${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('invitation-cards')
                    .upload(fileName, match.cardImage.blob);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('invitation-cards')
                        .getPublicUrl(fileName);

                    uploadedCards.push({
                        guestId: match.id,
                        url: publicUrl
                    });
                }

                setProgress(20 + (i / matchesToUse.length) * 40);
            }

            // 3. Create Guests
            const guestsToInsert = matchesToUse.map(match => {
                const uploadedCard = uploadedCards.find(c => c.guestId === match.id);

                return {
                    event_id: event.id,
                    name: match.name,
                    phone: match.phone,
                    card_image_url: uploadedCard?.url || null,
                    qr_token: `quick-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                };
            });

            const { error: guestsError } = await supabase
                .from('guests')
                .insert(guestsToInsert);

            if (guestsError) throw guestsError;
            setProgress(100);

            alert(`✅ تم! تم إنشاء الحدث بنجاح وتجهيز الضيوف والكروت.\n\nانتقل الآن إلى صفحة الإطلاق الرسمية (Meta) لبدء الإرسال.`);
            window.location.href = `/whatsapp-sender?eventId=${event.id}`;

        } catch (error: any) {
            console.error('Error:', error);
            alert('❌ حدث خطأ: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const stats = matches.length > 0 ? smartMatcher.getMatchingStats(matches) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8" dir="rtl">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <Zap className="w-8 h-8 text-yellow-500" />
                        رفع سريع لحدث WhatsApp
                    </h1>
                    <p className="text-gray-600">
                        ارفع قائمة الضيوف (Excel أو WhatsApp) + كروت (ZIP أو صور) وأرسل مباشرة!
                    </p>
                </div>

                {/* Step 1: Upload Guest List */}
                {step === 1 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            الخطوة 1: معلومات الحدث وقائمة الضيوف
                        </h2>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="اسم الحدث"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                            />

                            <input
                                type="date"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Excel Upload */}
                            <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                                <p className="font-semibold text-gray-700 mb-2">ملف Excel</p>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleExcelUpload}
                                    className="hidden"
                                    id="excel-upload"
                                />
                                <label
                                    htmlFor="excel-upload"
                                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 text-sm"
                                >
                                    اختر ملف
                                </label>
                            </div>

                            {/* WhatsApp List */}
                            <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-green-500 transition-colors">
                                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-green-600" />
                                <p className="font-semibold text-gray-700 mb-2">قائمة WhatsApp</p>
                                <button
                                    onClick={() => {
                                        const text = prompt('الصق قائمة الأسماء والأرقام من WhatsApp:');
                                        if (text) handleWhatsAppPaste(text);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                    الصق القائمة
                                </button>
                            </div>
                        </div>

                        {guestsData.length > 0 && (
                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                <CheckCircle className="w-6 h-6 text-green-600 inline-block ml-2" />
                                <span className="text-green-800 font-semibold">
                                    تم تحميل {guestsData.length} ضيف
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Upload Cards */}
                {step === 2 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            الخطوة 2: رفع صور الكروت
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            {/* ZIP Upload */}
                            <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-500 transition-colors">
                                <FileArchive className="w-12 h-12 mx-auto mb-3 text-purple-600" />
                                <p className="font-semibold text-gray-700 mb-2">ملفات ZIP</p>
                                <p className="text-xs text-gray-500 mb-3">مطابقة ذكية تلقائية</p>
                                <input
                                    type="file"
                                    accept=".zip"
                                    multiple
                                    onChange={handleZipUpload}
                                    className="hidden"
                                    id="zip-upload"
                                />
                                <label
                                    htmlFor="zip-upload"
                                    className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg cursor-pointer hover:bg-purple-700 text-sm"
                                >
                                    اختر ZIP
                                </label>
                            </div>

                            {/* Individual Images */}
                            <div className="border-4 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
                                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 text-blue-600" />
                                <p className="font-semibold text-gray-700 mb-2">صور منفصلة</p>
                                <p className="text-xs text-gray-500 mb-3">اختر عدة صور</p>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImagesUpload}
                                    className="hidden"
                                    id="images-upload"
                                />
                                <label
                                    htmlFor="images-upload"
                                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 text-sm"
                                >
                                    اختر صور
                                </label>
                            </div>
                        </div>

                        {matching && (
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <p className="text-blue-800 mb-2">جاري المطابقة الذكية...</p>
                                <div className="w-full bg-blue-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all"
                                        style={{ width: `${matchProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => { setMatches(guestsData); setStep(3); }}
                            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            تخطي (بدون كروت)
                        </button>
                    </div>
                )}

                {/* Step 3: Review & Send */}
                {step === 3 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            الخطوة 3: المراجعة والإرسال
                        </h2>

                        {stats && (
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <p className="text-blue-800"><strong>الحدث:</strong> {eventName}</p>
                                <p className="text-blue-800"><strong>الضيوف:</strong> {stats.total}</p>
                                <p className="text-blue-800"><strong>المطابقة:</strong> {stats.matched} / {stats.total} ({stats.matchRate}%)</p>
                            </div>
                        )}

                        {uploading ? (
                            <div className="space-y-4">
                                <div className="w-full bg-gray-200 rounded-full h-4">
                                    <div
                                        className="bg-blue-600 h-4 rounded-full transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-center text-gray-600">جاري الرفع... {Math.round(progress)}%</p>
                            </div>
                        ) : (
                            <button
                                onClick={handleCreateAndSend}
                                disabled={!eventName || !eventDate}
                                className="w-full px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Send className="w-6 h-6" />
                                إنشاء الحدث وتجهيز الرسائل
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
