import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Settings2, Sparkles, Palette, Save, Type, ImageIcon, FileDown, CheckCircle, RefreshCw, Eraser, AlignLeft, AlignCenter, AlignRight, Smartphone, Download, Move, ChevronRight, ChevronLeft, Mic, MicOff, Wand2, QrCode as QrCodeIcon, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import * as QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { analyzeInvitationLayout, cleanImageBackground } from '../services/openaiService';
import { v4 as uuidv4 } from 'uuid';

const AVAILABLE_FONTS = [
    { name: 'Arial', label: 'Arial (اقتراضي)' },
    { name: 'Cairo', label: 'القاهرة (Cairo)' },
    { name: 'Amiri', label: 'الأميري (Amiri)' },
    { name: 'Noto Kufi Arabic', label: 'كوفي (Noto Kufi)' },
    { name: 'Tajawal', label: 'تجوال (Tajawal)' },
    { name: 'Almarai', label: 'المراعي (Almarai)' },
];

// --- Types ---
interface Guest {
    id: string;
    name: string;
    qr_token: string;
    status: string;
    table?: string;
    table_no?: string;
    category?: string;
    card_number?: string;
    companions_count: number;
    qr_payload?: string; // Payload used for scanning
}

interface DesignElement {
    id: string;
    type: 'text' | 'qr';
    x: number;
    y: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    fontWeight?: string;
    size?: number; // For QR
    prefix?: string; // New: Prefix text
    suffix?: string; // New: Suffix text
    qrUrl?: string; // Custom URL pattern
    qrCenterImage?: string; // URL for center logo
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

// Simple Error Boundary for Debugging
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-10 text-red-600 bg-red-50 border border-red-200 m-10 rounded">
                    <h2 className="text-xl font-bold mb-2">Something went wrong!</h2>
                    <pre className="text-sm bg-white p-4 rounded border overflow-auto">
                        {this.state.error?.toString()}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

function UnifiedInvitationStudioContent() {
    // --- State ---
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [currentGuestIndex, setCurrentGuestIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    // Dynamic Fields State
    const [availableFields, setAvailableFields] = useState<string[]>(['name', 'table_no', 'qr_token', 'serial']);

    // Bulk Generation State
    // Bulk Generation State
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState({
        current: 0,
        total: 0,
        failed: 0,
        lastError: null as string | null,
        logs: [] as string[] // Full log history
    });
    const isCancelled = useRef(false);

    const cancelOperation = () => {
        isCancelled.current = true;
    };

    // Design State
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [elements, setElements] = useState<DesignElement[]>([
        { id: '1', type: 'text', text: '{name}', x: 540, y: 960, fontSize: 60, color: '#000000', align: 'center', fontWeight: 'bold' },
        { id: 'qr', type: 'qr', x: 540, y: 1500, size: 200 }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // const showRealData = true; // Unused

    // New Feature State
    const [mode, setMode] = useState<'fields' | 'creative' | 'export'>('fields');
    const [cleanQRCode, setCleanQRCode] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);
    const [bulkAddCount, setBulkAddCount] = useState(50);
    const [bulkPrefix, setBulkPrefix] = useState('');
    const [bulkStart, setBulkStart] = useState(1);
    const [bulkPadding, setBulkPadding] = useState(3);


    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDragging = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    const currentGuest = guests[currentGuestIndex];
    const selectedElement = elements.find(el => el.id === selectedId);

    // --- Load Events ---
    const [eventsList, setEventsList] = useState<{ id: string, name: string, date: string, features?: any }[]>([]);

    const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => {
        return new Promise((resolve) => {
            try {
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else {
                        console.error('Canvas toBlob returned null — possibly tainted canvas or empty canvas');
                        resolve(null);
                    }
                }, 'image/jpeg', 0.92);
            } catch (e) {
                console.error('Canvas toBlob threw:', e);
                resolve(null);
            }
        });
    };

    // Wait for canvas render to finish painting
    const waitForRender = (ms = 120) => new Promise(r => setTimeout(r, ms));

    useEffect(() => {
        const fetchEvents = async () => {
            const { data } = await supabase.from('events').select('id, name, date, features').order('date', { ascending: false });
            if (data) {
                setEventsList(data);
                // Auto-select first event
                if (data.length > 0) handleEventSelect(data[0].id);
            }
        };
        fetchEvents();
    }, []);

    const handleEventSelect = async (eventId: string) => {
        setSelectedEventId(eventId);
        setLoading(true);

        // Load Guests & Discover Fields
        const { data: guestsData } = await supabase.from('guests').select('*').eq('event_id', eventId);
        if (guestsData && guestsData.length > 0) {
            setGuests(guestsData);

            // Discover Fields from First Guest
            const sampleGuest = guestsData[0];
            const standardFields = ['name', 'table_no', 'category', 'companions_count', 'serial', 'qr_token'];
            let customFields: string[] = [];

            if (sampleGuest.custom_data && typeof sampleGuest.custom_data === 'object') {
                customFields = Object.keys(sampleGuest.custom_data).map(key => `custom_data.${key}`);
            }

            setAvailableFields([...standardFields, ...customFields]);
        }

        // Load Saved Design from 'features.design_config'
        // Find existing event name if needed, but we mainly want features
        // const eventName = eventsList.find(e => e.id === eventId)?.name;
        // We might need to fetch fresh if eventsList is stale, but let's try logic:
        const { data: eventFresh } = await supabase.from('events').select('features').eq('id', eventId).single();

        if (eventFresh?.features?.design_config) {
            const config = eventFresh.features.design_config;
            if (config.elements) setElements(config.elements);
            if (config.backgroundUrl) setBackgroundImage(config.backgroundUrl);
        }

        setLoading(false);
    };

    // --- Voice Recognition ---
    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
            return;
        }

        if ('webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = () => setIsListening(false);

            recognition.onresult = (e: any) => {
                const transcript = e.results[0][0].transcript;
                setCustomPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
            };

            recognition.start();
        } else {
            alert("عذراً، متصفحك لا يدعم الإملاء الصوتي.");
        }
    };

    // --- Creative AI Edit ---
    const handleCreativeEdit = async (promptOverride?: string) => {
        // Placeholder for future DALL-E Edit implementation
        const promptToUse = promptOverride || customPrompt;
        if (!promptToUse) return;
        alert(`سيتم إرسال الطلب لـ DALL-E: "${promptToUse}" (هذه الميزة تحت التطوير)`);
    }

    // --- AI Logic ---
    const handleAIAnalysis = async () => {
        if (!backgroundImage) {
            alert('يرجى اختيار صورة خلفية أولاً');
            return;
        }

        setAnalyzing(true);
        try {
            let imageToAnalyze = backgroundImage;

            // 1. Cleaning Phase (Inpainting)
            if (cleanQRCode) {
                // Generate Mask for QR Area (Bottom Center approximation)
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = 1024; // DALL-E Requirement
                maskCanvas.height = 1024;
                const ctx = maskCanvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = 'black'; // Opaque (Keep)
                    ctx.fillRect(0, 0, 1024, 1024);
                    // Clear the QR area (Bottom Center) -> Transparent (Edit)
                    ctx.clearRect(362, 700, 300, 300);

                    const maskBase64 = maskCanvas.toDataURL('image/png');
                    const resizedBg = await resizeImage(backgroundImage, 1024, 1024);
                    const cleanedImageUrl = await cleanImageBackground(resizedBg, maskBase64);
                    const cleanedBase64 = await urlToBase64(cleanedImageUrl);

                    setBackgroundImage(cleanedBase64);
                    imageToAnalyze = cleanedBase64;
                }
            }

            // 2. Get Analysis from OpenAI (Vision)
            const result = await analyzeInvitationLayout(imageToAnalyze);

            // 3. Clear old manual elements
            const newElements: DesignElement[] = [];

            // 4. Apply AI Suggestions
            result.fields.forEach(field => {
                const id = Date.now().toString() + Math.random().toString().substr(2, 5);

                if (field.type === 'text') {
                    newElements.push({
                        id: id,
                        type: 'text',
                        text: '{name}',
                        x: field.x,
                        y: field.y,
                        fontSize: field.height ? field.height * 0.8 : 40,
                        color: field.suggestedColor || '#000000',
                        align: 'center',
                        fontWeight: 'bold',
                        fontFamily: 'Arial'
                    });
                } else if (field.type === 'qr') {
                    newElements.push({
                        id: id,
                        type: 'qr',
                        x: field.x,
                        y: field.y,
                        size: field.width || 200
                    });
                }
            });

            if (newElements.length > 0) {
                setElements(newElements);
                setSelectedId(newElements[0].id);
            } else {
                alert('لم يتمكن الذكاء الاصطناعي من تحديد أماكن واضحة. يرجى التعديل يدوياً.');
            }

        } catch (error: any) {
            console.error(error);
            alert(`حدث خطأ: ${error.message || 'فشل الاتصال بـ OpenAI'}`);
        } finally {
            setAnalyzing(false);
        }
    };

    // Helper to resize image for DALL-E
    const resizeImage = (base64: string, w: number, h: number): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/png'));
            };
        });
    };

    const urlToBase64 = async (url: string): Promise<string> => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    };

    // --- Actions ---
    const addText = () => {
        const id = Date.now().toString();
        setElements([...elements, { id, type: 'text', text: 'نص جديد', x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, fontSize: 50, color: '#000', align: 'center', fontWeight: 'bold' }]);
        setSelectedId(id);
    };

    const addQRCode = () => {
        const id = Date.now().toString();
        // DEFAULT TO NETLIFY URL EVEN ON LOCALHOST
        const defaultNetlifyUrl = 'https://lonyinvite.netlify.app/check-in.html?token={token}';
        setElements([...elements, {
            id,
            type: 'qr',
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            size: 250,
            qrUrl: defaultNetlifyUrl
        }]);
        setSelectedId(id);
    };

    const updateElement = (key: keyof DesignElement, value: any) => {
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
    };

    const deleteElement = () => {
        if (!selectedId) return;
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
    };

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) setBackgroundImage(ev.target.result as string);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    // --- Save Logic ---
    const saveDesign = async () => {
        if (!selectedEventId) return alert("اختر حدثاً أولاً لحفظ التصميم له");

        setSaving(true);
        try {
            const designConfig = {
                elements: elements,
                backgroundUrl: backgroundImage
            };

            const { data: currentEvent, error: fetchError } = await supabase
                .from('events')
                .select('features')
                .eq('id', selectedEventId)
                .single();

            if (fetchError) throw fetchError;

            const updatedFeatures = {
                ...(currentEvent?.features || {}),
                design_config: designConfig
            };

            const { error } = await supabase
                .from('events')
                .update({ features: updatedFeatures })
                .eq('id', selectedEventId);

            if (error) throw error;
            alert("تم حفظ قالب التصميم بنجاح! سيتم استخدامه لجميع الضيوف.");

        } catch (e: any) {
            console.error(e);
            alert("فشل الحفظ: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // --- Bulk Generation Logic ---
    const generateAllCards = async () => {
        if (!selectedEventId) return;
        if (guests.length === 0) return alert("لا يوجد ضيوف لتوليد بطاقات لهم");

        const confirm = window.confirm(`هل أنت متأكد من توليد ${guests.length} بطاقة؟ سيتم استبدال أي بطاقات قديمة.`);
        if (!confirm) return;

        setGenerating(true);
        setProgress({ current: 0, total: guests.length, failed: 0, lastError: "جاري إنشاء المعاينة..." });

        // Helper to convert canvas to blob
        const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
            return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png', 0.8));
        };

        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            // Check storage bucket
            const { data: buckets } = await supabase.storage.listBuckets();
            if (!buckets?.find(b => b.name === 'invitations')) {
                await supabase.storage.createBucket('invitations', { public: true });
            }

            for (let i = 0; i < guests.length; i++) {
                const guest = guests[i];

                // 1. Force Render Canvas for this Guest
                // We manually call the render logic passing this specific guest
                // NOTE: We need to pass 'guest' explicitly to renderCanvas for this to work synchronously in loop,
                // or update state and wait. Updating state is async and tricky in loop.
                // BEST APPROACH: Refactor renderCanvas to accept optional guest param.
                await renderCanvas(guest);

                // 2. Generate Blob
                const blob = await getCanvasBlob(canvas);

                // 3. Upload to Supabase
                const fileName = `${selectedEventId}/${guest.qr_token}.png`;
                const { error: uploadError } = await supabase.storage
                    .from('invitations')
                    .upload(fileName, blob, { upsert: true, contentType: 'image/png' });

                if (uploadError) {
                    console.error(`Failed to upload for ${guest.name}`, uploadError);
                    setProgress(p => ({ ...p, failed: p.failed + 1 }));
                    continue;
                }

                // 4. Get Public URL
                const { data: { publicUrl: pUrl } } = supabase.storage.from('invitations').getPublicUrl(fileName);

                // 5. Update Guest Record
                const { error: upErr } = await supabase.from('guests').update({
                    status: 'card_generated', // Custom status or keep existing
                    card_image_url: pUrl
                }).eq('id', guest.id);

                setProgress(p => ({
                    ...p,
                    current: p.current + 1,
                    logs: [`تم توليد بطاقة ${guest.name}`, ...p.logs].slice(0, 50)
                }));
            }

            alert(`تمت العملية! تم توليد ${guests.length - progress.failed} بطاقة بنجاح.`);

        } catch (error: any) {
            console.error("Bulk Generation Error:", error);
            alert("حدث خطأ أثناء التوليد: " + error.message);
        } finally {
            setGenerating(false);
            // Restore view to current guest
            renderCanvas();
        }
    };




    // --- Publish to Database (WhatsApp Ready) ---
    const publishToDatabase = async () => {
        if (!selectedEventId) return;

        // FILTER: Exclude "Future Guest"
        const validGuests = guests.filter(g => (g.name || '').trim().toLowerCase() !== 'future guest');

        if (validGuests.length === 0) return alert("لا يوجد ضيوف صالحين لتحديث بياناتهم");

        const confirm = window.confirm(`سيتم توليد ${validGuests.length} بطاقة (تم استبعاد "ضيف مستقبلي") ورفعها لقاعدة البيانات. هل أنت متأكد؟`);
        if (!confirm) return;

        setSaving(true);
        // Step Diagnostics
        setProgress({
            current: 0,
            total: validGuests.length,
            failed: 0,
            lastError: "جاري البدء...",
            logs: ["بدأ تحديث قاعدة البيانات..."]
        });
        isCancelled.current = false;

        // PRE-FLIGHT CHECK: Tainted Canvas Check
        const canvas = canvasRef.current;
        if (canvas) {
            try {
                // Try to generate a tiny blob to see if CORS blocks us
                await new Promise<void>((resolve, reject) => {
                    try {
                        canvas.toBlob((b) => {
                            if (b) resolve();
                            else reject(new Error("Canvas returned null blob - potentially tainted by image CORS"));
                        });
                    } catch (e) { reject(e); }
                });
            } catch (e: any) {
                setSaving(false);
                return alert("⚠️ خطأ أمني (CORS): لا يمكن معالجة الصور لأن الخلفية أو شعار QR محملين من مصدر خارجي لا يسمح بالربط. \n\nالحل: تأكد من رفع الخلفية في Supabase Storage وضبط إعدادات CORS للسماح بـ localhost.");
            }
        }

        // (getCanvasBlob moved to component scope)


        try {
            // REMOVED bucket check as it requires high privileges (listBuckets fails with anon key)
            // We will just try to upload and catch error if bucket doesn't exist

            for (let i = 0; i < validGuests.length; i++) {
                if (isCancelled.current) break;

                const guest = validGuests[i];
                try {
                    // Update Processed Count (Current index in loop)
                    setProgress(p => ({ ...p, current: i + 1, lastError: `[${i + 1}/${validGuests.length}] جاري معالجة: ${guest.name}...` }));

                    // CRITICAL: Ensure token exists
                    let tokenToUse = guest.qr_token;
                    if (!tokenToUse) {
                        tokenToUse = uuidv4();
                        const { error: tErr } = await supabase.from('guests').update({ qr_token: tokenToUse }).eq('id', guest.id);
                        if (tErr) throw new Error("فشل إنشاء رمز QR للضيف: " + tErr.message);
                        guest.qr_token = tokenToUse;
                    }
                    const qrToken = tokenToUse;

                    // 1. Render Clean Card
                    const canvas = canvasRef.current;
                    if (!canvas) throw new Error("لا يمكن العثور على الكانفاس (Canvas not found).");

                    setProgress(p => ({ ...p, lastError: `جاري رسم البطاقة...`, logs: [`جاري رسم البطاقة لـ ${guest.name}`, ...p.logs].slice(0, 50) }));
                    await renderCanvas(guest, true, i + 1);
                    await waitForRender(150); // ← wait for canvas paint to complete

                    // 2. Generate Blob
                    setProgress(p => ({ ...p, lastError: `جاري التجهيز...`, logs: [`جاري استخراج الصورة لـ ${guest.name}`, ...p.logs].slice(0, 50) }));
                    const blob = await getCanvasBlob(canvas);
                    if (!blob) throw new Error('فشل تحويل البطاقة لصورة — Canvas فارغ أو يوجد خطأ CORS في الصورة الخلفية');

                    // 3. Upload to Supabase (bucket: invitation-cards)
                    setProgress(p => ({ ...p, lastError: `جاري الرفع...`, logs: [`جاري رفع صورة ${guest.name} لـ Supabase...`, ...p.logs].slice(0, 50) }));
                    const fileName = `${selectedEventId}/${qrToken}.jpg`;
                    const { error: uploadError } = await supabase.storage
                        .from('invitation-cards')
                        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });

                    if (uploadError) {
                        console.error('Upload Error Details:', uploadError);
                        // Try fallback bucket name
                        const { error: uploadError2 } = await supabase.storage
                            .from('invitations')
                            .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
                        if (uploadError2) {
                            throw new Error(`خطأ في الرفع: ${uploadError.message} — تأكد من وجود Bucket اسمه 'invitation-cards' في Supabase Storage`);
                        }
                    }

                    // 4. Get Public URL
                    let publicUrl = supabase.storage.from('invitation-cards').getPublicUrl(fileName).data.publicUrl;
                    // Validate URL is accessible (quick check)
                    if (!publicUrl || publicUrl.includes('undefined')) {
                        publicUrl = supabase.storage.from('invitations').getPublicUrl(fileName).data.publicUrl;
                    }

                    // 5. Update Guest Record
                    setProgress(p => ({ ...p, lastError: `جاري الحفظ...`, logs: [`جاري تحديث بيانات الضيف ${guest.name} في قاعدة البيانات...`, ...p.logs].slice(0, 50) }));
                    const { error: updateError } = await supabase.from('guests').update({
                        status: 'ready_to_send',
                        card_image_url: publicUrl
                    }).eq('id', guest.id);

                    if (updateError) {
                        console.error('DB update error:', updateError);
                        throw new Error('خطأ في تحديث قاعدة البيانات: ' + updateError.message);
                    }

                    console.log(`✅ Card saved for ${guest.name} → ${publicUrl}`);

                    setProgress(p => ({
                        ...p,
                        lastError: `تم بنجاح: ${guest.name}`,
                        logs: [`[${i + 1}] تم رفع بطاقة ${guest.name}`, ...p.logs].slice(0, 50)
                    }));

                } catch (err: any) {
                    console.error(`Failed for ${guest.name}:`, err);
                    setProgress(p => ({
                        ...p,
                        failed: p.failed + 1,
                        lastError: `خطأ عند ${guest.name}: ${err.message || 'Unknown'}`,
                        logs: [`[${i + 1}] فشل لـ ${guest.name}: ${err.message}`, ...p.logs].slice(0, 50)
                    }));
                    // Don't stop the loop for one failure
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            }

        } catch (error: any) {
            console.error("Publish Error:", error);
            setProgress(p => ({ ...p, lastError: `فشل حرج: ${error.message}` }));
            alert("حدث خطأ أثناء التحديث: " + error.message);
        } finally {
            setSaving(false);
            renderCanvas();
        }
    };


    const handleBulkDownload = async () => {
        // FILTER: Exclude "Future Guest"
        const validGuests = guests.filter(g => (g.name || '').trim().toLowerCase() !== 'future guest');

        if (!validGuests.length) return;

        setGenerating(true);
        const zip = new JSZip();
        let successCount = 0;
        let failCount = 0;
        // Reset progress with no error
        setProgress({
            current: 0,
            total: validGuests.length,
            failed: 0,
            lastError: "جاري البدء...",
            logs: ["بدأ إنشاء ملف ZIP..."]
        });
        isCancelled.current = false;

        try {
            for (let i = 0; i < validGuests.length; i++) {
                if (isCancelled.current) break;

                const guest = validGuests[i];

                // Update Current Index
                setProgress(p => ({
                    ...p,
                    current: i + 1,
                    lastError: `[${i + 1}/${validGuests.length}] جاري معالجة: ${guest.name}...`,
                    logs: [`جاري معالجة: ${guest.name}`, ...p.logs].slice(0, 50)
                }));

                // CRITICAL: Ensure token exists
                if (!guest.qr_token) {
                    guest.qr_token = uuidv4();
                }

                try {
                    // 1. Render canvas
                    const canvas = canvasRef.current;
                    if (!canvas) throw new Error('لا يمكن العثور على الكانفاس.');

                    setProgress(p => ({ ...p, lastError: `جاري الرسم...`, logs: [`جاري رسم البطاقة لـ ${guest.name}`, ...p.logs].slice(0, 50) }));
                    await renderCanvas(guest, true, i + 1);
                    await waitForRender(150); // ← wait for canvas paint

                    // 2. Convert to Blob
                    setProgress(p => ({ ...p, lastError: `جاري التجهيز...`, logs: [`جاري استخراج الصورة لـ ${guest.name}`, ...p.logs].slice(0, 50) }));
                    const blob = await getCanvasBlob(canvas);
                    if (!blob) throw new Error('فشل توليد صورة — Canvas فارغ أو يوجد مشكلة في رسم الخلفية');

                    const safeName = (guest.name || 'guest').replace(/[^a-z0-9\u0600-\u06FF\s-_]/gi, '_');
                    const serial = guest.card_number || (i + 1).toString().padStart(3, '0');
                    zip.file(`${serial}-${safeName}.png`, blob);

                    successCount++;
                    setProgress(p => ({
                        ...p,
                        lastError: `تمت الإضافة: ${guest.name}`,
                        logs: [`[${i + 1}] تمت إضافة ${guest.name} للملف بنجاح`, ...p.logs].slice(0, 50)
                    }));

                } catch (err: any) {
                    console.error(`Error processing ${guest.name}:`, err);
                    failCount++;
                    setProgress(p => ({
                        ...p,
                        failed: p.failed + 1,
                        lastError: `خطأ عند ${guest.name}: ${err.message}`,
                        logs: [`[${i + 1}] فشل لـ ${guest.name}: ${err.message}`, ...p.logs].slice(0, 50)
                    }));
                }

                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (successCount > 0) {
                setProgress(p => ({ ...p, lastError: "جاري ضغط الملفات وتحميل الـ ZIP..." }));
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `invitations_bulk_${new Date().toISOString().slice(0, 10)}.zip`);
                setProgress(p => ({ ...p, lastError: "اكتمل التحميل بنجاح!" }));
            } else {
                alert("لم يتم توليد أي بطاقات بنجاح.");
            }

        } catch (error: any) {
            console.error("Bulk Download Error", error);
            setProgress(p => ({ ...p, lastError: `Critical: ${error.message}` }));
            alert("فشل التحميل الجماعي.");
        } finally {
            setGenerating(false);
            renderCanvas(); // Restore view
        }
    };

    // --- Generate Previews for Export ---
    const generatePreviews = async () => {
        if (!guests?.length) return;

        setGenerating(true);
        const samples: string[] = [];
        const count = Math.min(6, guests.length);
        const indices = new Set<number>();

        // Pick 6 random unique indices
        while (indices.size < count) {
            indices.add(Math.floor(Math.random() * guests.length));
        }

        try {
            for (const idx of Array.from(indices)) {
                await renderCanvas(guests[idx], true);
                const blob = await new Promise<Blob | null>(resolve =>
                    canvasRef.current!.toBlob(resolve, 'image/png')
                );
                if (blob) {
                    samples.push(URL.createObjectURL(blob));
                }
            }
            setPreviewImages(samples);
        } catch (error) {
            console.error("Preview Generation Error", error);
        } finally {
            setGenerating(false);
            // Restore current view
            renderCanvas();
        }
    };

    // --- Canvas Rendering ---
    // --- Helper for Text Replacement ---
    const replacePlaceholders = (text: string, guest: any) => {
        if (!text || !guest) return text;

        return text.replace(/\{([^}]+)\}/g, (match, key) => {
            // Handle nested keys like custom_data.Seat
            if (key.includes('.')) {
                const parts = key.split('.');
                let value = guest;
                for (const part of parts) {
                    value = value ? value[part] : undefined;
                }
                return value !== undefined ? value : match; // Keep placeholder if value missing
            }
            // Handle standard keys
            return guest[key] !== undefined ? guest[key] : match;
        });
    };

    // --- Canvas Rendering ---
    useEffect(() => {
        renderCanvas();
    }, [elements, currentGuestIndex, backgroundImage, guests]);

    const renderCanvas = async (overrideGuest?: Guest, isExport: boolean = false, overrideSerial?: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const targetGuest = overrideGuest || currentGuest;

        // Clear
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Helper to load image safely (CORS-aware)
        const loadImage = async (url: string): Promise<HTMLImageElement | null> => {
            try {
                // If it's already a data URL or blob URL, loading it normally is fine
                if (url.startsWith('data:') || url.startsWith('blob:')) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = url;
                    return new Promise((resolve) => {
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                    });
                }

                // For external URLs, use fetch to ensure we hit CORS headers properly
                const response = await fetch(url, { mode: 'cors' });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);

                const img = new Image();
                img.src = objectUrl;
                return new Promise((resolve) => {
                    img.onload = () => {
                        // Clean up object URL after load
                        // Note: Don't revoke immediately if you need to draw it later, 
                        // but for canvas drawImage it's fine once onload triggers.
                        resolve(img);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve(null);
                    };
                });
            } catch (err) {
                console.error("loadImage failed", url, err);
                return null;
            }
        };

        // Draw Background
        if (backgroundImage) {
            const loadedImg = await loadImage(backgroundImage);
            if (loadedImg) {
                ctx.drawImage(loadedImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            } else {
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
        } else {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // Draw Elements
        for (const el of elements) {
            if (el.type === 'text') {
                let text = el.text || '';
                // Use helper if available, otherwise fallback to basic replace
                if (targetGuest) {
                    if (typeof replacePlaceholders === 'function') {
                        text = replacePlaceholders(text, targetGuest);
                    }
                    // Force string replacement
                    text = text.replace('{name}', targetGuest.name || '')
                        .replace('{table}', targetGuest.table_no || targetGuest.table || '')
                        .replace('{category}', targetGuest.category || '')
                        .replace('{companions}', (targetGuest.companions_count || 0).toString())
                        .replace('{companions_count}', (targetGuest.companions_count || 0).toString());

                    if (el.text && el.text.includes('{serial}')) {
                        let serial = targetGuest.card_number;
                        if (!serial) {
                            if (overrideSerial !== undefined) {
                                serial = overrideSerial.toString().padStart(3, '0');
                            } else {
                                const index = guests.findIndex(g => g.id === targetGuest.id);
                                serial = index >= 0 ? (index + 1).toString().padStart(3, '0') : '001';
                            }
                        }
                        text = text.replace('{serial}', serial);
                    }
                } else {
                    // No guest selected (Design Mode) - Show Sample
                    text = text.replace('{name}', 'الاسم هنا')
                        .replace('{table}', 'طاولة 1')
                        .replace('{category}', 'VIP')
                        .replace('{companions}', '2')
                        .replace('{companions_count}', '2')
                        .replace('{serial}', '001');
                }

                // ADD PREFIX & SUFFIX
                if (el.prefix) {
                    text = el.prefix + " " + text;
                }
                if (el.suffix) {
                    text = text + " " + el.suffix;
                }

                ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize}px ${el.fontFamily || 'Arial'}`;
                ctx.fillStyle = el.color || '#000';
                ctx.textAlign = el.align as CanvasTextAlign || 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, el.x, el.y);

                // Selection Box (Only if not exporting)
                // STRICT CHECK: isExport must be false
                if (el.id === selectedId && isExport === false && !overrideGuest) {
                    const metrics = ctx.measureText(text);
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(el.x - metrics.width / 2 - 10, el.y - (el.fontSize || 40) / 2 - 10, metrics.width + 20, (el.fontSize || 40) + 20);
                }

            } else if (el.type === 'qr') {
                const size = el.size || 200;
                // Default colors
                const colorDark = (el as any).colorDark || '#000000';
                const colorLight = (el as any).colorLight || '#00000000'; // Transparent default

                if (targetGuest) {
                    // LINKING QR TO NETLIFY
                    // Use custom URL pattern or default
                    // Build verify URL
                    // USE OFFICIAL STATIC CHECK-IN PAGE: This has the specific countdown and states agreed on.
                    const defaultUrl = 'https://lonyinvite.netlify.app/check-in.html?token={token}';
                    const baseUrl = (el as any).qrUrl && (el as any).qrUrl.trim() ? (el as any).qrUrl : defaultUrl;
                    const qrContent = baseUrl.replace('{token}', targetGuest.qr_token || targetGuest.id || '');

                    try {
                        const qrDataUrl = await QRCode.toDataURL(qrContent, {
                            margin: 1,
                            width: size,
                            errorCorrectionLevel: (el as any).qrCenterImage ? 'H' : 'M',
                            color: { dark: colorDark, light: colorLight }
                        });
                        const qrImg = new Image();
                        qrImg.crossOrigin = 'anonymous'; // CRITICAL
                        qrImg.src = qrDataUrl;
                        const loadedQr = await loadImage(qrDataUrl);
                        if (loadedQr) {
                            ctx.drawImage(loadedQr, el.x - size / 2, el.y - size / 2, size, size);
                        }

                        // Draw Center Image if exists
                        if ((el as any).qrCenterImage) {
                            const logoSize = size * 0.25; // 25% of QR size
                            const logoUrl = (el as any).qrCenterImage;
                            const loadedLogo = await loadImage(logoUrl);

                            if (loadedLogo) {
                                // Draw rounded styling or just image
                                const lx = el.x - logoSize / 2;
                                const ly = el.y - logoSize / 2;

                                // Optional: White background behind logo for better readability
                                ctx.fillStyle = colorLight !== '#00000000' ? colorLight : '#ffffff';
                                ctx.fillRect(lx - 2, ly - 2, logoSize + 4, logoSize + 4);

                                ctx.drawImage(loadedLogo, lx, ly, logoSize, logoSize);
                            }
                        }

                    } catch (error) {
                        console.error("QR Error", error);
                    }
                } else {
                    // Placeholder with custom colors
                    ctx.fillStyle = colorLight !== '#00000000' ? colorLight : 'rgba(255,255,255,0.8)';
                    ctx.fillRect(el.x - size / 2, el.y - size / 2, size, size);

                    // Draw a fake QR code pattern
                    ctx.fillStyle = colorDark;
                    const cellSize = size / 5;
                    ctx.fillRect(el.x - size / 2 + cellSize, el.y - size / 2 + cellSize, cellSize * 3, cellSize * 3); // Center block

                    // Corners
                    ctx.fillRect(el.x - size / 2, el.y - size / 2, cellSize, cellSize);
                    ctx.fillRect(el.x + size / 2 - cellSize, el.y - size / 2, cellSize, cellSize);
                    ctx.fillRect(el.x - size / 2, el.y + size / 2 - cellSize, cellSize, cellSize);
                }

                // STRICT CHECK: isExport must be false
                if (el.id === selectedId && isExport === false && !overrideGuest) {
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(el.x - size / 2 - 5, el.y - size / 2 - 5, size + 10, size + 10);
                }
            }
        }
    };

    // --- Interactions ---
    // --- Interactions ---
    const handlePointerDown = (e: React.PointerEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Hit Testing (Reverse order to select top-most element)
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let clickedId: string | null = null;

        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];

            if (el.type === 'text') {
                ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize}px ${el.fontFamily || 'Arial'}`;
                const metrics = ctx.measureText(el.text || '');
                const height = el.fontSize || 40;
                const width = metrics.width;

                // Simple bounding box check (centering handled)
                // Text is drawn centered at x,y? No, renderCanvas says:
                // ctx.textAlign = el.align ...
                // If align is center (default for new items might be left/center?)
                // Actually renderCanvas says: ctx.textAlign = el.align ... || 'left'
                // Wait, in my previous edit I saw: ctx.textAlign = el.align as CanvasTextAlign || 'left';
                // And ctx.textBaseline = 'middle';

                // Let's assume center align for hit testing simplicity or check align
                // For now, let's just do a rough box around x,y

                // BETTER: re-measure exactly as renderCanvas does
                // text = replacePlaceholders(el.text...) -> but for selection we might just use raw text width or placeholder width?
                // Let's use raw text for selecting in studio

                const halfWidth = width / 2;
                const halfHeight = height / 2;

                // Bounding box approximation
                if (
                    clickX >= el.x - halfWidth - 20 &&
                    clickX <= el.x + halfWidth + 20 &&
                    clickY >= el.y - halfHeight - 20 &&
                    clickY <= el.y + halfHeight + 20
                ) {
                    clickedId = el.id;
                    break;
                }

            } else if (el.type === 'qr') {
                const size = el.size || 200;
                const half = size / 2;
                if (
                    clickX >= el.x - half &&
                    clickX <= el.x + half &&
                    clickY >= el.y - half &&
                    clickY <= el.y + half
                ) {
                    clickedId = el.id;
                    break;
                }
            }
        }

        if (clickedId) {
            setSelectedId(clickedId);
            isDragging.current = true;
            // setDragOffset logic if needed
        } else {
            setSelectedId(null);
            isDragging.current = false;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !selectedId || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = CANVAS_WIDTH / rect.width;
        const scaleY = CANVAS_HEIGHT / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Snap to grid or just free move? Free move for now
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, x, y } : el));
    };

    const handlePointerUp = () => {
        isDragging.current = false;
    };

    const downloadCard = () => {
        const link = document.createElement('a');
        link.download = `invite_${currentGuest?.name || 'card'}.png`;
        link.href = canvasRef.current!.toDataURL();
        link.click();
    };

    return (
        <div className="flex h-screen bg-gray-100 p-4 gap-4" dir="rtl">

            {/* 1. Sidebar */}
            <div className="w-[350px] flex flex-col gap-4 h-full">

                {/* Header & Event Select */}
                <Card className="shadow-md border-l-4 border-lony-gold">
                    <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-lg flex justify-between items-center">
                            <span>استوديو التصميم</span>
                            {saving && <span className="text-xs text-blue-500 animate-pulse">جاري الحفظ...</span>}
                        </CardTitle>
                        <select
                            className="w-full mt-2 p-2 text-sm border rounded bg-white"
                            onChange={(e) => handleEventSelect(e.target.value)}
                            value={selectedEventId || ''}
                        >
                            {eventsList.map(ev => <option key={ev.id} value={ev.id}>{ev.name} ({ev.date})</option>)}
                        </select>
                    </CardHeader>
                    <CardContent className="space-y-3 pb-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={addText} variant="outline" className="text-xs h-10 border-amber-200 bg-amber-50/30 hover:bg-amber-50">
                                <Type className="w-3.5 h-3.5 ml-1.5 text-amber-600" /> إضافة نص
                            </Button>
                            <Button onClick={addQRCode} variant="outline" className="text-xs h-10 border-purple-200 bg-purple-50/30 hover:bg-purple-50">
                                <QrCodeIcon className="w-3.5 h-3.5 ml-1.5 text-purple-600" /> إضافة باركود
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="relative">
                                <input type="file" onChange={handleBackgroundUpload} className="hidden" id="bg-upload" />
                                <Button variant="outline" className="w-full text-xs text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100 h-10" onClick={() => document.getElementById('bg-upload')?.click()}>
                                    <ImageIcon className="w-3.5 h-3.5 ml-1.5" /> تغيير خلفية الكرت
                                </Button>
                            </div>
                        </div>
                        <Button onClick={saveDesign} disabled={!selectedEventId} className="w-full bg-lony-navy hover:bg-lony-navy/90 text-white">
                            <Save className="w-4 h-4 ml-2" /> حفظ التصميم للجميع
                        </Button>

                        {/* BULK GENERATE BUTTON */}
                        <hr className="my-2" />
                        <div className="space-y-2">
                            <Button
                                onClick={generateAllCards}
                                disabled={!selectedEventId || generating || guests.length === 0}
                                className={`w-full text-white ${generating ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {generating ? `جاري التوليد (${progress.current}/${progress.total})` : <><CheckCircle className="w-4 h-4 ml-2" /> توليد {guests.length} بطاقة</>}
                            </Button>

                            {generating && (
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-green-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* TABS CONTROL */}
                <div className="flex p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <button
                        onClick={() => setMode('fields')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'fields' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Settings2 size={16} /> خصائص
                    </button>
                    <button
                        onClick={() => setMode('creative')}
                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'creative' ? 'bg-amber-50 text-amber-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Sparkles size={16} /> ذكاء
                    </button>
                    <button
                        onClick={() => { setMode('export'); generatePreviews(); }}
                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'export' ? 'bg-green-50 text-green-600 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
                    >
                        <Download size={16} /> تصدير
                    </button>
                </div>

                {/* --- PANELS --- */}

                {mode === 'export' && (
                    <Card className="animate-in slide-in-from-left flex-1 overflow-auto">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b pb-2">
                            <CardTitle className="text-sm font-bold text-green-800 flex items-center gap-2">
                                <Download size={16} /> تصدير ومعاينة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                            {/* Stats */}
                            <div className="flex justify-between items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                <span>عدد المدعوين: <strong>{guests.length}</strong></span>
                                <span>جاهز للتصدير</span>
                            </div>

                            {/* Bulk Button */}
                            <div className="space-y-2">
                                <Button
                                    onClick={handleBulkDownload}
                                    disabled={!selectedEventId || generating || guests.length === 0}
                                    className={`w-full text-white h-12 text-sm font-bold ${generating ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 shadow-md transform hover:-translate-y-0.5 transition-all'}`}
                                >
                                    {generating ? `جاري المعالجة...` : <><FileDown className="w-5 h-5 ml-2" /> تحميل الكل (ZIP)</>}
                                </Button>
                                {generating && (
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-green-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                                        <div className="text-center text-[10px] text-gray-500 mt-1">{progress.current} / {progress.total}</div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* Samples Grid */}
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                                        <ImageIcon size={14} className="text-green-600" /> عينات عشوائية
                                    </span>
                                    <button onClick={generatePreviews} className="text-[10px] text-blue-600 hover:underline flex items-center gap-1">
                                        <RefreshCw size={10} /> تحديث
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {previewImages.length > 0 ? previewImages.map((src, i) => (
                                        <div key={i} className="relative aspect-[9/16] bg-gray-100 rounded overflow-hidden border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition-transform group">
                                            <img src={src} className="w-full h-full object-cover" alt={`sample-${i}`} />
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                            <span className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] px-1 rounded">{i + 1}</span>
                                        </div>
                                    )) : (
                                        <div className="col-span-2 text-center py-8 text-gray-400 text-xs bg-gray-50 rounded border border-dashed">
                                            جاري تحميل العينات...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {mode === 'creative' && (
                    <Card className="animate-in slide-in-from-left flex-1 overflow-auto">
                        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b pb-2">
                            <CardTitle className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                <Palette size={16} /> تعديل ذكي (AI)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                            {/* Cleaning */}
                            <div className="p-3 bg-white rounded border shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                                        <Eraser size={14} className="text-red-500" /> إزالة الباركود القديم
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={cleanQRCode}
                                        onChange={(e) => setCleanQRCode(e.target.checked)}
                                        className="cursor-pointer"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 mb-2">سيتم مسح منطقة الباركود أوتوماتيكياً قبل التحليل</p>
                                <Button
                                    onClick={handleAIAnalysis}
                                    disabled={analyzing || !backgroundImage}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                                    size="sm"
                                >
                                    {analyzing ? <Sparkles className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />} تحليل وتوزيع العناصر
                                </Button>
                            </div>

                            <hr className="border-dashed" />

                            <p className="text-xs text-gray-500">تعديل التصميم بالأوامر (DALL-E):</p>
                            <div className="relative">
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder='أدخل وصفك.. مثال: "اجعل الخلفية أكثر فخامة"'
                                    className="w-full h-20 p-2 bg-gray-50 rounded border text-sm resize-none focus:border-amber-400 focus:outline-none"
                                />
                                <button
                                    onClick={toggleListening}
                                    className={`absolute bottom-2 left-2 p-1.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-400 hover:text-amber-600 shadow-sm'}`}
                                >
                                    {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                                </button>
                            </div>
                            <Button
                                onClick={() => handleCreativeEdit()}
                                disabled={analyzing || !customPrompt.trim()}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                                size="sm"
                            >
                                <Wand2 className="w-3 h-3 mr-1" /> تنفيذ التعديل (قريباً)
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {mode === 'fields' && (
                    <Card className="flex-1 animate-in slide-in-from-left overflow-auto border-0 shadow-none bg-transparent">
                        <CardHeader className="px-4 py-2">
                            <CardTitle className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-amber-500" />
                                أدوات التصميم
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="space-y-3 px-4">
                            {/* Tips */}
                            {!selectedElement && (
                                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                                    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Move className="w-6 h-6 text-amber-500 opacity-50" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-600">حدد عنصراً لتعديله</p>
                                    <p className="text-xs text-gray-400 mt-1">اضغط على النص أو الباركود في التصميم</p>
                                </div>
                            )}

                            {selectedElement && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                                            {selectedElement.type === 'text' ? <Type size={14} /> : <QrCodeIcon size={14} />}
                                            {selectedElement.type === 'text' ? 'النص الرئيسي' : 'الباركود الرئيسي'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {/* Visibility Toggle (Mock) */}
                                            <div className="w-8 h-4 bg-amber-500 rounded-full relative cursor-pointer opacity-90">
                                                <div className="w-3 h-3 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm"></div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={deleteElement} className="text-red-400 hover:text-red-600 h-6 w-6 p-0 hover:bg-red-50 rounded-full">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {selectedElement.type === 'text' && (
                                            <>
                                                {/* Prefix & Suffix */}
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block tracking-wider">بادئة</label>
                                                        <input
                                                            type="text"
                                                            value={(selectedElement as any).prefix || ''}
                                                            onChange={(e) => updateElement('prefix', e.target.value)}
                                                            placeholder="مثال: السيد"
                                                            className="w-full p-2.5 bg-gray-50 border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 outline-none transition-all placeholder:text-gray-300"
                                                            dir="auto"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block tracking-wider">لاحقة</label>
                                                        <input
                                                            type="text"
                                                            value={(selectedElement as any).suffix || ''}
                                                            onChange={(e) => updateElement('suffix', e.target.value)}
                                                            placeholder="مثال: المحترم"
                                                            className="w-full p-2.5 bg-gray-50 border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 outline-none transition-all placeholder:text-gray-300"
                                                            dir="auto"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div>
                                                    <div className="flex justify-between items-end mb-1.5">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">المحتوى المتغير</label>
                                                        <select
                                                            className="text-[10px] border border-amber-200 rounded-md bg-amber-50 text-amber-800 px-2 py-1 outline-none cursor-pointer hover:bg-amber-100 transition-colors font-bold"
                                                            onChange={(e) => {
                                                                if (e.target.value) updateElement('text', (selectedElement.text || '') + ` {${e.target.value}}`);
                                                            }}
                                                            value=""
                                                        >
                                                            <option value="">+ إدراج حقل (مثل الاسم أو الرقم)</option>
                                                            {['name', 'table', 'category', 'serial', 'companions_count'].map(f => (
                                                                <option key={f} value={f}>{f === 'serial' ? 'الرقم التسلسلي {serial}' : f}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <textarea
                                                        value={selectedElement.text}
                                                        onChange={(e) => updateElement('text', e.target.value)}
                                                        className="w-full p-3 bg-gray-50 border-gray-200 rounded-lg text-right min-h-[80px] text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 outline-none transition-all"
                                                        dir="auto"
                                                    />
                                                </div>

                                                {/* Font Family */}
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block tracking-wider">نوع الخط</label>
                                                    <select
                                                        value={selectedElement.fontFamily || 'Arial'}
                                                        onChange={(e) => updateElement('fontFamily', e.target.value)}
                                                        className="w-full p-2.5 bg-gray-50 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-100 focus:border-amber-400 outline-none transition-all"
                                                        style={{ fontFamily: selectedElement.fontFamily || 'Arial' }}
                                                    >
                                                        {AVAILABLE_FONTS.map(font => (
                                                            <option key={font.name} value={font.name} style={{ fontFamily: font.name }}>{font.label}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Style Controls */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">الحجم</label>
                                                        <input
                                                            type="number"
                                                            value={selectedElement.fontSize}
                                                            onChange={(e) => updateElement('fontSize', Number(e.target.value))}
                                                            className="w-full p-2 bg-gray-50 border-gray-200 rounded-lg text-sm focus:border-amber-400 outline-none text-center font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">اللون</label>
                                                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 border border-gray-200 rounded-lg">
                                                            <input
                                                                type="color"
                                                                value={selectedElement.color}
                                                                onChange={(e) => updateElement('color', e.target.value)}
                                                                className="w-6 h-6 rounded cursor-pointer border-none bg-transparent p-0"
                                                            />
                                                            <span className="text-xs text-gray-500 font-mono tracking-tighter">{selectedElement.color}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Align & Weight */}
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">التنسيق</label>
                                                    <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
                                                        {['left', 'center', 'right'].map((align) => (
                                                            <button
                                                                key={align}
                                                                className={`flex-1 p-1.5 rounded-md transition-all ${selectedElement.align === align ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                                onClick={() => updateElement('align', align)}
                                                            >
                                                                {align === 'left' ? <AlignLeft size={16} className="mx-auto" /> : align === 'center' ? <AlignCenter size={16} className="mx-auto" /> : <AlignRight size={16} className="mx-auto" />}
                                                            </button>
                                                        ))}
                                                        <div className="w-px bg-gray-200 mx-1 my-1"></div>
                                                        <button
                                                            onClick={() => updateElement('fontWeight', selectedElement.fontWeight === 'bold' ? 'normal' : 'bold')}
                                                            className={`px-3 rounded-md transition-all ${selectedElement.fontWeight === 'bold' ? 'bg-white text-amber-600 shadow-sm font-bold' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            B
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {selectedElement.type === 'qr' && (
                                            <div className="space-y-5">
                                                {/* Size Slider */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">حجم الباركود</label>
                                                        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{selectedElement.size}px</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="100" max="600" step="10"
                                                        value={selectedElement.size}
                                                        onChange={(e) => updateElement('size', Number(e.target.value))}
                                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">لون النقاط</label>
                                                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 border border-gray-200 rounded-lg">
                                                            <input
                                                                type="color"
                                                                value={(selectedElement as any).colorDark || '#000000'}
                                                                onChange={(e) => updateElement('colorDark', e.target.value)}
                                                                className="w-6 h-6 rounded-full cursor-pointer border-none p-0 overflow-hidden"
                                                            />
                                                            <span className="text-xs text-gray-500 font-mono tracking-tighter">{(selectedElement as any).colorDark || '#000'}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 block">الخلفية</label>
                                                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 border border-gray-200 rounded-lg">
                                                            <input
                                                                type="color"
                                                                value={(selectedElement as any).colorLight || '#ffffff'}
                                                                onChange={(e) => updateElement('colorLight', e.target.value)}
                                                                className="w-6 h-6 rounded-full cursor-pointer border-none p-0 overflow-hidden"
                                                            />
                                                            <span className="text-xs text-gray-500 font-mono tracking-tighter">{(selectedElement as any).colorLight || '#fff'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                                                    <div className="flex gap-2 mb-2">
                                                        <div className="mt-0.5 text-blue-500"><Settings2 size={14} /></div>
                                                        <div className="flex-1">
                                                            <h4 className="text-xs font-bold text-blue-700 mb-0.5">رابط التوجيه (Redirect URL)</h4>
                                                            <p className="text-[10px] text-blue-600/80 leading-tight mb-2">
                                                                استخدم <code>{'{token}'}</code> لاستبدال رمز القارئ تلقائياً.
                                                            </p>
                                                            <input
                                                                type="text"
                                                                value={(selectedElement as any).qrUrl || 'https://lonyinvite.netlify.app/check-in.html?token={token}'}
                                                                onChange={(e) => updateElement('qrUrl', e.target.value)}
                                                                className="w-full p-2 text-[10px] bg-white border border-blue-200 rounded font-mono text-gray-600 outline-none focus:border-blue-400"
                                                                dir="ltr"
                                                            />
                                                        </div>
                                                    </div>

                                                    <hr className="border-blue-100/50 my-2" />

                                                    {/* Center Image Upload */}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold text-blue-700">صورة في المنتصف (Logo)</span>
                                                        <div className="relative">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                id="qr-logo-upload"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        const reader = new FileReader();
                                                                        reader.onload = (ev) => {
                                                                            updateElement('qrCenterImage', ev.target?.result as string);
                                                                        };
                                                                        reader.readAsDataURL(file);
                                                                    }
                                                                }}
                                                            />
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => document.getElementById('qr-logo-upload')?.click()}
                                                                    className="h-6 text-[10px] px-2 bg-white hover:bg-blue-50 text-blue-600 border-blue-200"
                                                                >
                                                                    <ImageIcon className="w-3 h-3 ml-1" /> رفع
                                                                </Button>
                                                                {(selectedElement as any).qrCenterImage && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => updateElement('qrCenterImage', undefined)}
                                                                        className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

            </div>

            {/* 2. Main Canvas */}
            <div className="flex-1 flex flex-col items-center justify-center relative bg-gray-200 rounded-xl overflow-hidden shadow-inner">

                {/* Canvas Controls Overlay */}
                <div className="absolute top-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-white/20">
                    <Button size="icon" variant="ghost" onClick={() => setCurrentGuestIndex(Math.max(0, currentGuestIndex - 1))}>
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                    <span className="text-sm font-bold min-w-[100px] text-center">
                        {currentGuest ? currentGuest.name : 'الاسم هنا'}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => setCurrentGuestIndex(Math.min(guests.length - 1, currentGuestIndex + 1))}>
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-px h-6 bg-gray-300 mx-2"></div>
                    <Button size="sm" onClick={downloadCard} className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4">
                        <Download className="w-4 h-4 mr-2" /> تحميل {currentGuest?.name}
                    </Button>
                </div>

                <div
                    className="relative shadow-2xl"
                    style={{ width: CANVAS_WIDTH / 3, height: CANVAS_HEIGHT / 3 }} // Preview Scale
                >
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        className="w-full h-full cursor-crosshair bg-white"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />
                </div>

                <p className="mt-4 text-xs text-gray-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    الباركود فعال ويرتبط بـ: check-in.html?token={currentGuest?.qr_token?.substr(0, 8)}...
                </p>
            </div>


            {/* Export Panel - Floating Right */}
            {
                mode === 'export' && (
                    <div className="absolute top-20 right-80 w-96 bg-white/95 backdrop-blur shadow-2xl rounded-2xl border border-white/20 p-6 overflow-y-auto max-h-[85vh] z-50 animate-in slide-in-from-right-10 duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                                <FileDown className="w-6 h-6 text-purple-600" />
                                التصدير والتحميل
                            </h3>
                            {/* Close button that switches mode back to fields/design */}
                            <Button variant="ghost" size="sm" onClick={() => setMode('fields')} className="h-8 w-8 p-0 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {/* Info Box */}
                            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 shadow-sm">
                                <h4 className="font-bold text-blue-900 text-sm mb-1 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-blue-500" />
                                    التحقق الذكي:
                                </h4>
                                <ul className="text-xs text-blue-800/80 space-y-1 list-disc list-inside">
                                    <li>يتم تجاهل "الضيف المستقبلي" تلقائياً.</li>
                                    <li>يتم إخفاء حدود التحديد الزرقاء.</li>
                                    <li>توليد أسماء الملفات بالتسلسل (001-Guest.png).</li>
                                </ul>
                            </div>


                            {/* Step 0: Guest Simulation (New) */}
                            <div className="mb-4">
                                <h4 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-2">
                                    <Smartphone className="w-4 h-4 text-blue-600" />
                                    محاكاة تجربة الضيف (Demo):
                                </h4>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open('/guest/sim-before', '_blank')}
                                        className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700"
                                    >
                                        قبل الحفل
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open('/guest/sim-during', '_blank')}
                                        className="text-xs border-green-200 hover:bg-green-50 text-green-700"
                                    >
                                        أثناء الحفل
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open('/guest/sim-after', '_blank')}
                                        className="text-xs border-gray-200 hover:bg-gray-50 text-gray-700"
                                    >
                                        بعد الحفل
                                    </Button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    * هذه المحاكاة تستخدم بيانات وهمية لتجربة المراحل الثلاث
                                </p>
                            </div>

                            <hr className="border-gray-100 mb-4" />

                            {/* Step 1: Verify */}
                            <div>
                                <h4 className="font-bold text-gray-700 text-sm mb-2">1. التحقق من العينات (قبل التحميل):</h4>
                                <Button
                                    onClick={generatePreviews}
                                    disabled={generating}
                                    className="w-full bg-white border-2 border-purple-100 hover:border-purple-300 hover:bg-purple-50 text-purple-700 transition-all shadow-sm"
                                >
                                    {generating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    {previewImages.length > 0 ? 'تحديث العينات العشوائية' : 'عرض 6 عينات عشوائية'}
                                </Button>

                                {/* Preview Grid */}
                                {previewImages.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        {previewImages.map((src, i) => (
                                            <div key={i} className="group relative aspect-[9/16] bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition-all cursor-zoom-in" onClick={() => window.open(src, '_blank')}>
                                                <img src={src} className="w-full h-full object-cover" alt="Preview" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                    <span className="bg-white/90 text-[10px] px-2 py-1 rounded-full shadow-sm text-gray-800">تكيبر</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <hr className="border-gray-100" />

                            {/* Step 2: Download */}
                            <div>
                                <h4 className="font-bold text-gray-700 text-sm mb-2">2. التحميل النهائي:</h4>
                                <Button
                                    onClick={handleBulkDownload}
                                    disabled={generating || guests.length === 0}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-12 shadow-lg shadow-green-200"
                                >
                                    {generating ? 'جاري المعالجة...' : `تحميل الكل (${guests.filter(g => (g.name || '').trim().toLowerCase() !== 'future guest').length} بطاقة) ZIP`}
                                    <FileDown className="w-5 h-5 mr-2" />
                                </Button>
                            </div>

                            <div className="pt-2">
                                <Button
                                    onClick={publishToDatabase}
                                    disabled={saving}
                                    variant="outline"
                                    className="w-full border-green-200 text-green-700 hover:bg-green-50"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4 mr-2" />}
                                    تحديث قاعدة البيانات (واتساب)
                                </Button>
                                <p className="text-[10px] text-center text-gray-400 mt-1">
                                    يربط الصور بجهات الاتصال لإرسالها عبر البوت
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* Generating Modal Overlay */}
            {
                (generating || saving) && (
                    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center text-white backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-gray-800/80 p-8 rounded-2xl border border-gray-700 shadow-2xl max-w-md w-full text-center backdrop-blur-md">
                            <div className="mb-6 relative w-20 h-20 mx-auto">
                                <div className="w-full h-full border-4 border-blue-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold font-mono">{Math.round((progress.current / progress.total) * 100) || 0}%</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-bold mb-2 text-emerald-400">
                                {saving ? 'جاري التحديث والرفع...' : 'جاري إنشاء البطاقات...'}
                            </h3>
                            <p className="text-gray-300 text-sm mb-6 px-4">
                                يرجى الانتظار، يتم الآن معالجة {progress.total} بطاقة.
                                <br />
                                <span className="text-xs text-gray-400 mt-1 block opacity-75">لا تغلق الصفحة حتى تكتمل العملية.</span>
                            </p>

                            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden mb-3 ring-1 ring-white/10">
                                <div
                                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs font-mono text-gray-400 px-1">
                                <span>تم إنجاز: <span className="text-emerald-300">{progress.current}</span></span>
                                <span>فشل: <span className="text-red-300">{progress.failed}</span></span>
                            </div>
                            {/* Logs Display */}
                            {(progress.lastError || (progress.logs && progress.logs.length > 0)) && (
                                <div
                                    className="mt-4 bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-gray-200 text-right overflow-y-auto max-h-32 scrollbar-thin flex flex-col-reverse"
                                    dir="rtl"
                                    style={{ fontFamily: 'monospace' }}
                                >
                                    {progress.logs?.map((log, idx) => (
                                        <div key={idx} className={log.includes('فشل') || log.includes('خطأ') ? 'text-red-400' : 'text-gray-300'}>
                                            • {log}
                                        </div>
                                    ))}
                                    {progress.lastError && (
                                        <div className="text-emerald-400 font-bold mb-1 border-b border-white/10 pb-1">
                                            الحالة الحالية: {progress.lastError}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Stop Button */}
                            <button
                                onClick={cancelOperation}
                                className="mt-4 text-xs text-red-400 hover:text-red-300 underline decoration-red-400/50 hover:decoration-red-300"
                            >
                                إيقاف العملية
                            </button>
                        </div>
                    </div>
                )
            }
            {/* Bulk Add Dialog */}
            {showBulkAddDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <Card className="w-full max-w-md animate-in zoom-in-95 duration-200 border border-purple-100 shadow-2xl">
                        <CardHeader className="bg-purple-50/50">
                            <CardTitle className="flex items-center gap-2 text-purple-900">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                إنشاء كروت مرقمة (تلقائي)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">كم عدد الكروت التي تريد إنشاءها؟</label>
                                <input
                                    type="number"
                                    value={bulkAddCount}
                                    onChange={(e) => setBulkAddCount(parseInt(e.target.value) || 1)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all text-center text-xl font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">بادئة (Prefix)</label>
                                    <input
                                        type="text"
                                        value={bulkPrefix}
                                        onChange={(e) => setBulkPrefix(e.target.value)}
                                        placeholder="مثلاً: INV-"
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">بدءاً من</label>
                                    <input
                                        type="number"
                                        value={bulkStart}
                                        onChange={(e) => setBulkStart(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">تصفير (000)</label>
                                    <input
                                        type="number"
                                        value={bulkPadding}
                                        min="1"
                                        max="6"
                                        value={bulkPadding}
                                        onChange={(e) => setBulkPadding(parseInt(e.target.value) || 1)}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center font-mono"
                                    />
                                </div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-xs text-purple-800 leading-relaxed shadow-sm">
                                <div className="font-bold mb-1 flex items-center gap-1">
                                    <Info className="w-3 h-3" /> معاينة التنسيق:
                                </div>
                                سيتم إنشاء {bulkAddCount} كرت. الأول سيكون:
                                <span className="font-mono bg-white px-2 py-0.5 rounded mx-1 font-bold border border-purple-200">
                                    {bulkPrefix}{String(bulkStart).padStart(bulkPadding, '0')}
                                </span>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <Button
                                    variant="ghost"
                                    className="flex-1 h-12 rounded-xl text-gray-500 hover:bg-gray-100"
                                    onClick={() => setShowBulkAddDialog(false)}
                                >
                                    إلغاء
                                </Button>
                                <Button
                                    className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-200 font-bold"
                                    disabled={saving}
                                    onClick={async () => {
                                        if (!selectedEventId) return;
                                        setSaving(true);
                                        try {
                                            const newBatch = Array.from({ length: bulkAddCount }).map((_, i) => {
                                                const num = bulkStart + i;
                                                const serial = `${bulkPrefix}${String(num).padStart(bulkPadding, '0')}`;
                                                return {
                                                    id: uuidv4(),
                                                    event_id: selectedEventId,
                                                    name: `بطاقة رقم ${serial}`,
                                                    card_number: serial,
                                                    status: 'confirmed',
                                                    qr_token: uuidv4(),
                                                    qr_payload: uuidv4(),
                                                    companions_count: 0
                                                };
                                            });

                                            const { error } = await supabase.from('guests').insert(newBatch);
                                            if (error) throw error;

                                            setShowBulkAddDialog(false);
                                            // Trigger refresh via setGuests if local or re-fetch
                                            if (typeof handleEventSelect === 'function') {
                                                handleEventSelect(selectedEventId);
                                            } else {
                                                window.location.reload();
                                            }
                                        } catch (err: any) {
                                            alert("حدث خطأ أثناء الإنشاء: " + err.message);
                                        } finally {
                                            setSaving(true); // Keep spinner while reloading
                                            setTimeout(() => setSaving(false), 2000);
                                        }
                                    }}
                                >
                                    {saving ? <RefreshCw className="animate-spin" /> : 'إنشاء البطاقات الآن'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div >
    );
}

export default function UnifiedInvitationStudio() {
    return (
        <ErrorBoundary>
            <UnifiedInvitationStudioContent />
        </ErrorBoundary>
    );
}
