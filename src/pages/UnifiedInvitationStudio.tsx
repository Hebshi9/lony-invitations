import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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
    Globe,
    Hash, // Added Hash icon
    Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Event, Guest, StudioStep } from '../types';
import CanvasEditor, { CanvasElement } from '../components/CanvasEditorEnhanced';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCodeLib from 'qrcode';
import geminiService from '../services/gemini-service';
import imageCompression from 'browser-image-compression';
import jsQR from 'jsqr';

interface UnifiedInvitationStudioProps {
    eventId?: string;
}

type ExportFormat = 'zip' | 'pdf';

const UnifiedInvitationStudio: React.FC<UnifiedInvitationStudioProps> = ({ eventId }) => {
    // Pipeline State
    const [currentStep, setCurrentStep] = useState<StudioStep>('data');
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>(eventId || '');
    const [guests, setGuests] = useState<Guest[]>([]);

    // Data Input State (Simplified)
    const [inputMethod, setInputMethod] = useState<'existing' | 'excel' | 'api' | 'manual' | 'serial'>('existing');
    const [serialStart, setSerialStart] = useState<string>('1');
    const [serialCount, setSerialCount] = useState<string>('100');
    const [serialPadding, setSerialPadding] = useState<string>('3');
    const [serialPrefix, setSerialPrefix] = useState<string>('');
    const [excelFile, setExcelFile] = useState<any[]>([]);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [excelMapping, setExcelMapping] = useState({ name: '', phone: '', table: '', companions: '', category: '' });

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
    const [exportScope, setExportScope] = useState<'all' | 'range'>('all');
    const [exportRange, setExportRange] = useState({ start: 1, end: 100 });

    // UI Feedback
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

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

    const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // --- STEP 1: DATA HANDLERS ---
    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

            if (data.length > 0) {
                const headers = Object.keys(data[0] as object);
                setExcelHeaders(headers);
                setExcelFile(data);

                // 🤖 Try Gemini AI first
                if (geminiService.isConfigured()) {
                    try {
                        showMessage('success', `🤖 الذكاء الاصطناعي يحلل ${headers.length} عمود...`);
                        const aiMapping = await geminiService.mapExcelColumns(headers);
                        setExcelMapping(aiMapping);

                        const detected = Object.keys(aiMapping)
                            .filter(k => aiMapping[k as keyof typeof aiMapping])
                            .map(k => `${k}`)
                            .join(', ');

                        showMessage('success', `✅ تم التعرف على: ${detected}`);
                    } catch (error) {
                        console.error('Gemini failed, using fallback:', error);
                        // Fallback to smart mapping
                        const smartMapping = {
                            name: headers.find(h => /name|اسم|الاسم|guest|ضيف/i.test(h)) || '',
                            phone: headers.find(h => /phone|mobile|جوال|هاتف|موبايل/i.test(h)) || '',
                            table: headers.find(h => /table|طاولة|رقم الطاولة/i.test(h)) || '',
                            companions: headers.find(h => /companions|مرافقين|عدد/i.test(h)) || '',
                            category: headers.find(h => /category|فئة|نوع/i.test(h)) || ''
                        };
                        setExcelMapping(smartMapping);
                        showMessage('success', `تم قراءة ${data.length} صف`);
                    }
                } else {
                    // No Gemini, use smart mapping
                    const smartMapping = {
                        name: headers.find(h => /name|اسم|الاسم|guest|ضيف/i.test(h)) || '',
                        phone: headers.find(h => /phone|mobile|جوال|هاتف|موبايل/i.test(h)) || '',
                        table: headers.find(h => /table|طاولة|رقم الطاولة/i.test(h)) || '',
                        companions: headers.find(h => /companions|مرافقين|عدد/i.test(h)) || '',
                        category: headers.find(h => /category|فئة|نوع/i.test(h)) || ''
                    };
                    setExcelMapping(smartMapping);
                    showMessage('success', `تم قراءة ${data.length} صف`);
                }
            }
            setLoading(false);
        };

        reader.readAsBinaryString(file);
    };

    const saveExcelGuests = async () => {
        if (!selectedEventId || !excelMapping.name) return showMessage('error', 'حدد الحدث وعمود الاسم');
        setLoading(true);
        try {
            const newGuests = excelFile.map((row: any, idx) => {
                // Extract standard fields
                const name = row[excelMapping.name];
                const phone = excelMapping.phone ? row[excelMapping.phone] : null;
                const table_no = excelMapping.table ? row[excelMapping.table] : null;
                const companions_count = excelMapping.companions ? parseInt(row[excelMapping.companions] || '0') : 0;
                const category = excelMapping.category ? row[excelMapping.category] : null;

                // Extract custom fields (everything else)
                const custom_fields: any = {};
                const standardKeys = Object.values(excelMapping).filter(Boolean);

                Object.keys(row).forEach(key => {
                    if (!standardKeys.includes(key) && key !== '__rowNum__') {
                        custom_fields[key] = row[key];
                    }
                });

                return {
                    event_id: selectedEventId,
                    name,
                    phone,
                    table_no,
                    companions_count,
                    category,
                    custom_fields,
                    serial: String(guests.length + idx + 1).padStart(3, '0'),
                    qr_token: uuidv4(),
                    status: 'pending'
                };
            });

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

    const generateSerialGuests = async () => {
        if (!selectedEventId) return showMessage('error', 'حدد الحدث أولاً');

        const start = parseInt(serialStart) || 1;
        const count = parseInt(serialCount) || 100;
        const padding = parseInt(serialPadding) || 3;

        setLoading(true);
        try {
            const newGuests: any[] = [];
            for (let i = 0; i < count; i++) {
                const currentNum = start + i;
                const paddedNum = String(currentNum).padStart(padding, '0');
                const serialStr = `${serialPrefix}${paddedNum}`;

                newGuests.push({
                    event_id: selectedEventId,
                    name: `Serial ${serialStr}`, // Placeholder name
                    serial: serialStr,
                    card_number: serialStr,
                    qr_token: uuidv4(),
                    status: 'pending'
                });
            }

            const { error } = await supabase.from('guests').insert(newGuests);
            if (error) throw error;

            showMessage('success', `تم توليد ${count} كرت تسلسلي بنجاح`);
            fetchExistingGuests();
            setInputMethod('existing');
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- STEP 2: DESIGN HANDLERS ---
    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setBackgroundUrl(url);

            // 🤖 Smart AI Analysis
            if (geminiService.isConfigured()) {
                setLoading(true);
                showMessage('success', '🤖 الذكاء الاصطناعي يحلل التصميم الآن لإقتراح أفضل توزيع...');

                try {
                    // Convert file to base64
                    const reader = new FileReader();
                    reader.onload = async () => {
                        const base64 = (reader.result as string).split(',')[1];
                        const suggestedElements = await geminiService.analyzeDesign(base64);

                        if (suggestedElements && suggestedElements.length > 0) {
                            // Map AI elements to our internal format
                            const formattedElements: CanvasElement[] = suggestedElements.map((el: any, index: number) => ({
                                id: `ai-${index}-${Date.now()}`,
                                type: el.type,
                                label: el.label,
                                x: el.x,
                                y: el.y,
                                fontSize: el.fontSize || (el.type === 'qr' ? 120 : 36),
                                color: el.color || '#000000',
                                fontWeight: el.fontWeight || 'normal',
                                fontFamily: 'Adobe Arabic', // Default luxury font
                                textAlign: 'center' as const,
                                qrColor: '#000000',
                                qrBgColor: 'transparent'
                            }));

                            setCanvasElements(formattedElements);
                            showMessage('success', '✅ تم توزيع العناصر ذكياً بواسطة AI!');
                        }
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('AI Analysis failed:', error);
                    showMessage('info', 'يمكنك توزيع العناصر يدوياً');
                } finally {
                    setLoading(false);
                }
            }
        }
    };

    // --- STEP 3: PREVIEW/EXPORT CORE LOGIC ---

    // --- HELPERS ---
    const drawCanvasElements = async (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, bgImg: HTMLImageElement, elements: CanvasElement[], guest: Guest) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

        for (const el of elements) {
            const x = (el.x / 100) * canvas.width;
            const y = (el.y / 100) * canvas.height;

            ctx.save();
            ctx.globalAlpha = (el.opacity ?? 100) / 100;

            if (el.type === 'qr') {
                const qrUrl = `https://lony-invites.com/v/${guest.qr_token || guest.id}`;
                const size = el.width || el.fontSize || 150;

                // For simplified export, we use basic QR square shapes
                const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
                    width: size, margin: 0,
                    color: {
                        dark: el.qrColor || '#000000',
                        light: el.qrBgColor === 'transparent' ? '#00000000' : (el.qrBgColor || '#ffffff')
                    }
                });
                const qrImg = new Image();
                qrImg.src = qrDataUrl;
                await new Promise(r => qrImg.onload = r);

                ctx.globalAlpha = ((el.opacity ?? 100) / 100) * ((el.qrOpacity ?? 100) / 100);
                ctx.drawImage(qrImg, x - (size / 2), y - (size / 2), size, size);
            } else if (el.type === 'text') {
                ctx.fillStyle = el.color;
                const fontSize = el.fontSize || 30;
                const weight = el.fontWeight || 'normal';
                const family = el.fontFamily || 'Arial';
                ctx.font = `${weight} ${fontSize}px ${family}`;

                ctx.textAlign = 'center' as const;
                ctx.textBaseline = 'middle' as const;

                // Shadow support
                if (el.textShadow) {
                    const match = el.textShadow.match(/(-?\d+)px (-?\d+)px (-?\d+)px (rgba?\(.+?\)|#.+)/);
                    if (match) {
                        ctx.shadowOffsetX = parseInt(match[1]);
                        ctx.shadowOffsetY = parseInt(match[2]);
                        ctx.shadowBlur = parseInt(match[3]);
                        ctx.shadowColor = match[4];
                    }
                }

                let text = el.content || '';

                // Smart Variable Replacement (supports "Welcome {name}" and legacy label binding)
                const replaceVar = (tmpl: string) => {
                    return tmpl.replace(/{(\w+)}/g, (_, key) => {
                        // 1. Check direct properties
                        if (key === 'name') return guest.name || '';
                        if (key === 'table') return guest.table_no || '';
                        if (key === 'phone') return guest.phone || '';
                        if (key === 'category') return guest.category || '';
                        if (key === 'companions') return String(guest.companions_count || 0);
                        if (key === 'card_number') return guest.card_number || '';
                        if (key === 'serial') return guest.serial || '';

                        // 2. Check custom_fields
                        if (guest.custom_fields && guest.custom_fields[key]) {
                            return String(guest.custom_fields[key]);
                        }

                        return ''; // Return empty validity
                    });
                };

                // If content has {variable}, use replacement
                if (text.includes('{')) {
                    text = replaceVar(text);
                } else {
                    // Backward compatibility for label-based binding
                    if (el.label && el.label !== 'نص جديد' && el.label !== 'QR Code') {
                        // Map Arabic labels to English keys for compatibility
                        let key = el.label;
                        if (el.label === 'اسم الضيف' || el.label === 'الاسم') key = 'name';
                        if (el.label === 'رقم الطاولة') key = 'table';
                        if (el.label === 'الجوال') key = 'phone';

                        text = replaceVar(`{${key}}`);
                    }
                }

                if (el.prefix) text = `${el.prefix} ${text}`;

                // Stroke/Outline Support
                if (el.textOutline) {
                    ctx.lineWidth = el.textOutline.width;
                    ctx.strokeStyle = el.textOutline.color;
                    ctx.strokeText(text, x, y);
                }

                ctx.fillText(text, x, y);
            }
            ctx.restore();
        }
    };

    const generateCards = async (guestList: Guest[]): Promise<string[]> => {
        const img = new Image();
        img.src = backgroundUrl;
        await new Promise(r => img.onload = r);

        const canvas = document.createElement('canvas');
        canvas.width = cardDimensions ? cardDimensions.width : img.width;
        canvas.height = cardDimensions ? cardDimensions.height : img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        const results: string[] = [];
        for (const guest of guestList) {
            await drawCanvasElements(ctx, canvas, img, canvasElements, guest);
            results.push(canvas.toDataURL('image/jpeg', 0.8));
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

    const runQualityCheck = async () => {
        if (!backgroundUrl || canvasElements.length === 0) return;
        setLoading(true);
        showMessage('info', 'جاري فحص جودة بطاقات الدعوة...');

        try {
            // Check 3 random cards
            const sampleGuests = guests.slice(0, 3);
            let passed = 0;
            let total = sampleGuests.length;
            let errors: string[] = [];

            const img = new Image();
            img.src = backgroundUrl;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = cardDimensions ? cardDimensions.width : img.width;
            canvas.height = cardDimensions ? cardDimensions.height : img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas init failed");

            for (const guest of sampleGuests) {
                await drawCanvasElements(ctx, canvas, img, canvasElements, guest);

                // Get Image Data for QR scanning
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);

                if (code) {
                    // Check if URL is valid
                    if (code.data.includes(guest.qr_token || guest.id)) {
                        passed++;
                    } else {
                        errors.push(`بيانات QR غير صحيحة للضيف ${guest.name}`);
                    }
                } else {
                    errors.push(`تعذر قراءة QR للضيف ${guest.name}. تأكد من التباين والحجم.`);
                }
            }

            if (passed === total) {
                showMessage('success', '✅ الفحص ممتاز! جميع الأكواد مقروءة بوضوح.');
            } else {
                showMessage('error', `⚠️ تنبيه: نجح ${passed}/${total}. ${errors[0]}`);
            }

        } catch (e: any) {
            console.error(e);
            showMessage('error', 'فشل الفحص: ' + e.message);
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

            // Scope Logic
            let guestsToExport = guests;
            if (exportScope === 'range') {
                const start = Math.max(0, exportRange.start - 1);
                const end = Math.min(guests.length, exportRange.end);
                guestsToExport = guests.slice(start, end);
            }

            for (let i = 0; i < guestsToExport.length; i++) {
                const guest = guestsToExport[i];
                await drawCanvasElements(ctx, canvas, img, canvasElements, guest);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const fileName = `invite_${guest.serial || i + 1}.jpg`;
                zip.file(fileName, dataUrl.split(',')[1], { base64: true });
                setProgress(Math.round(((i + 1) / guestsToExport.length) * 100));
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `invitations_${guestsToExport.length}.zip`);
            showMessage('success', 'تم التحميل بنجاح');

        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setGenerating(false);
            setProgress(0);
        }
    };

    // 📤 Upload Cards to Supabase Storage
    const uploadCardsToSupabase = async () => {
        if (!selectedEventId || guests.length === 0) {
            showMessage('error', 'لا يوجد ضيوف لرفع كروتهم');
            return;
        }

        if (!backgroundUrl || canvasElements.length === 0) {
            showMessage('error', 'يجب إكمال التصميم أولاً');
            return;
        }

        setGenerating(true);
        setProgress(0);

        try {
            const img = new Image();
            img.src = backgroundUrl;
            await new Promise(r => img.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = cardDimensions?.width || img.width;
            canvas.height = cardDimensions?.height || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas error');

            let uploadedCount = 0;

            for (let i = 0; i < guests.length; i++) {
                const guest = guests[i];
                await drawCanvasElements(ctx, canvas, img, canvasElements, guest);

                // Convert to Blob
                const blob = await new Promise<Blob>((resolve) =>
                    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
                );

                // Convert Blob to File for compression
                const file = new File([blob], `card-${guest.id}.jpg`, { type: 'image/jpeg' });

                // 🚀 Compress Image
                const compressedBlob = await imageCompression(file, {
                    maxSizeMB: 0.5, // Max 500KB
                    maxWidthOrHeight: 1200,
                    useWebWorker: true
                });

                // Upload to Supabase
                const fileName = `${selectedEventId}/${guest.id}.jpg`;
                const { error: uploadError } = await supabase.storage
                    .from('invitation-cards')
                    .upload(fileName, compressedBlob, { upsert: true });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('invitation-cards')
                        .getPublicUrl(fileName);

                    const { error: updateError } = await supabase
                        .from('guests')
                        .update({
                            card_image_url: publicUrl,
                            card_number: String(i + 1).padStart(3, '0'),
                            card_generated_at: new Date().toISOString()
                        })
                        .eq('id', guest.id);

                    if (!updateError) uploadedCount++;
                }

                setProgress(Math.round(((i + 1) / guests.length) * 100));
            }

            showMessage('success', `✅ تم رفع ${uploadedCount} كرت بنجاح!`);
        } catch (error: any) {
            showMessage('error', error.message);
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
                                    <Button variant={inputMethod === 'api' ? 'default' : 'outline'} onClick={() => setInputMethod('api')} className="flex-1">
                                        <Globe className="w-4 h-4 mr-2" /> API
                                    </Button>
                                    <Button variant={inputMethod === 'serial' ? 'default' : 'outline'} onClick={() => setInputMethod('serial')} className="flex-1">
                                        <Hash className="w-4 h-4 mr-2" /> أرقام فقط
                                    </Button>
                                </div>

                                {inputMethod === 'serial' && (
                                    <div className="space-y-4 bg-gray-50 p-4 rounded border">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium block mb-1">بداية الترقيم</label>
                                                <input type="number" className="w-full p-2 border rounded" value={serialStart} onChange={e => setSerialStart(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1">عدد الكروت</label>
                                                <input type="number" className="w-full p-2 border rounded" value={serialCount} onChange={e => setSerialCount(e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1">طول الرقم (Zeros)</label>
                                                <input type="number" className="w-full p-2 border rounded" value={serialPadding} onChange={e => setSerialPadding(e.target.value)} />
                                                <span className="text-xs text-gray-500">مثال: 3 بتصير 001</span>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium block mb-1">بادئة (Prefix)</label>
                                                <input type="text" className="w-full p-2 border rounded" placeholder="مثال: A-" value={serialPrefix} onChange={e => setSerialPrefix(e.target.value)} />
                                            </div>
                                        </div>
                                        <Button onClick={generateSerialGuests} disabled={loading} className="w-full">
                                            {loading ? <Loader2 className="animate-spin" /> : 'توليد الأرقام'}
                                        </Button>
                                    </div>
                                )}

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
                                    {/* Overlay Elements Preview (Simplified) */}
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

                                    {(() => {
                                        // Determine available fields for binding
                                        let fields = ['name', 'phone', 'table', 'companions', 'category', 'serial', 'card_number', 'qr_token'];
                                        if (guests.length > 0 && guests[0].custom_fields) {
                                            fields = [...fields, ...Object.keys(guests[0].custom_fields)];
                                        }
                                        if (excelHeaders.length > 0) {
                                            // If we just uploaded excel, maybe merge headers? 
                                            // But usually we save to DB first. So looking at guests is better.
                                        }

                                        return (
                                            <>
                                                {showEditor && (
                                                    <CanvasEditor
                                                        template={{ background_url: backgroundUrl } as any}
                                                        backgroundUrl={backgroundUrl}
                                                        initialElements={canvasElements}
                                                        onClose={() => setShowEditor(false)}
                                                        onSave={(els) => { setCanvasElements(els); setShowEditor(false); }}
                                                        cardDimensions={cardDimensions}
                                                        availableFields={fields}
                                                    />
                                                )}
                                            </>
                                        );
                                    })()}

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

                                    {previewCards.length > 0 && (
                                        <div className="mt-8 pt-8 border-t flex justify-center gap-4">
                                            <Button variant="outline" onClick={runQualityCheck} disabled={loading} className="border-lony-gold text-lony-gold hover:bg-yellow-50">
                                                <CheckCircle className="ml-2 w-4 h-4" />
                                                فحص الجودة (Quality Guard)
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {previewCards.map((src, i) => (
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
                                    <label className="font-bold block">نطاق التصدير:</label>
                                    <div className="flex gap-4">
                                        <div onClick={() => setExportScope('all')} className={`flex-1 p-4 border rounded-xl cursor-pointer text-center ${exportScope === 'all' ? 'bg-blue-50 border-blue-500' : ''}`}>
                                            الكل ({guests.length})
                                        </div>
                                        <div onClick={() => setExportScope('range')} className={`flex-1 p-4 border rounded-xl cursor-pointer text-center ${exportScope === 'range' ? 'bg-blue-50 border-blue-500' : ''}`}>
                                            نطاق محدد
                                        </div>
                                    </div>
                                    {exportScope === 'range' && (
                                        <div className="flex gap-4 items-center">
                                            <input type="number" value={exportRange.start} onChange={e => setExportRange(prev => ({ ...prev, start: parseInt(e.target.value) }))} className="border p-2 rounded w-20" placeholder="من" />
                                            <span>إلى</span>
                                            <input type="number" value={exportRange.end} onChange={e => setExportRange(prev => ({ ...prev, end: parseInt(e.target.value) }))} className="border p-2 rounded w-20" placeholder="إلى" />
                                        </div>
                                    )}
                                </div>

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

                                <div className="grid grid-cols-2 gap-4">
                                    <Button
                                        size="lg"
                                        className="py-8 text-xl font-bold bg-green-600 hover:bg-green-700 text-white shadow-xl"
                                        onClick={uploadCardsToSupabase}
                                        disabled={generating}
                                    >
                                        {generating ? <Loader2 className="animate-spin w-6 h-6" /> : '📤 رفع للواتساب'}
                                    </Button>

                                    <Button
                                        size="lg"
                                        className="py-8 text-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl"
                                        onClick={handleExport}
                                        disabled={generating}
                                    >
                                        {generating ? <Loader2 className="animate-spin w-6 h-6" /> : '💾 تنزيل ZIP'}
                                    </Button>
                                </div>

                                <p className="text-xs text-center text-gray-500">
                                    💡 رفع للواتساب: يرفع الكروت ويربطها بالضيوف تلقائياً
                                </p>
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
                    availableFields={['name', 'phone', 'table', 'companions', 'category', 'card_number', 'qr_code']}
                />
            )}
        </div>
    );
};

export default UnifiedInvitationStudio;
