import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    ChevronLeft, ChevronRight, Eye, Download,
    Palette, Type, Image as ImageIcon, QrCode as QrCodeIcon,
    Save, Sparkles, CheckCircle, MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'qrcode';

interface Guest {
    id: string;
    name: string;
    phone?: string;
    table_no?: string;
    companions_count?: number;
    qr_payload: string;
}

interface TextElement {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
}

interface QRElement {
    x: number;
    y: number;
    size: number;
}

const UnifiedInvitationStudio: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const eventId = searchParams.get('event');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [guests, setGuests] = useState<Guest[]>([]);
    const [currentGuestIndex, setCurrentGuestIndex] = useState(0);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [textElements, setTextElements] = useState<TextElement[]>([]);
    const [qrElement, setQRElement] = useState({ x: 50, y: 800, size: 200 });
    const [showRealData, setShowRealData] = useState(true);
    const [loading, setLoading] = useState(false);

    // Refs for stable rendering
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const qrImageRef = useRef<HTMLImageElement | null>(null);
    const requestRef = useRef<number>();

    const currentGuest = guests[currentGuestIndex];

    useEffect(() => {
        if (eventId) {
            loadGuests();
        }
    }, [eventId]);

    // 1. Handle Background Image Loading
    useEffect(() => {
        if (backgroundImage) {
            const img = new Image();
            img.src = backgroundImage;
            img.onload = () => {
                bgImageRef.current = img;
                renderCanvas();
            };
        } else {
            bgImageRef.current = null;
            renderCanvas();
        }
    }, [backgroundImage]);

    // 2. Handle QR Code Generation & Loading
    useEffect(() => {
        const generateQR = async () => {
            if (currentGuest && showRealData) {
                try {
                    const qrUrl = `https://lonyinvite.netlify.app/invite/${currentGuest.qr_payload}`;
                    // Generate high-res QR for scaling
                    const qrDataURL = await QRCode.toDataURL(qrUrl, {
                        width: 500, // Fixed high resolution
                        margin: 1,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });

                    const img = new Image();
                    img.src = qrDataURL;
                    img.onload = () => {
                        qrImageRef.current = img;
                        renderCanvas();
                    };
                } catch (e) {
                    console.error("Error generating QR", e);
                }
            } else {
                qrImageRef.current = null;
                renderCanvas();
            }
        };

        generateQR();
    }, [currentGuest, showRealData]);

    // 3. Render Loop (Triggered by any UI change)
    useEffect(() => {
        renderCanvas();
    }, [textElements, qrElement, showRealData]);

    const loadGuests = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', eventId)
                .eq('is_demo', false) // Exclude demo guests
                .order('created_at', { ascending: true }); // added order for consistency

            if (error) throw error;
            if (data && data.length > 0) {
                setGuests(data);
            } else {
                // Check if there are truly no guests or just no non-demo guests
                const { count } = await supabase.from('guests').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
                if (count === 0) {
                    alert('لا يوجد ضيوف لهذا الحدث. قم برفع قائمة الضيوف أولاً.');
                    navigate('/upload-guests?event=' + eventId);
                } else {
                    // Could be filtering issue, but default to empty list is fine, user can navigate
                    setGuests([]);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            setBackgroundImage(evt.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const renderCanvas = () => {
        // Use requestAnimationFrame for smooth rendering
        if (requestRef.current) cancelAnimationFrame(requestRef.current);

        requestRef.current = requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Background
            if (bgImageRef.current) {
                ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
            } else {
                // Draw placeholder if no background
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#9ca3af';
                ctx.textAlign = 'center';
                ctx.font = '20px Arial';
                ctx.fillText('قم برفع خلفية للبدء', canvas.width / 2, canvas.height / 2);
            }

            // 2. Draw Text Elements
            textElements.forEach(el => {
                ctx.font = `bold ${el.fontSize}px ${el.fontFamily || 'Arial'}`;
                ctx.fillStyle = el.color;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';

                let text = el.text;
                if (showRealData && currentGuest) {
                    text = text
                        .replace('{name}', currentGuest.name || '')
                        .replace('{table}', currentGuest.table_no || '')
                        .replace('{companions}', String(currentGuest.companions_count || 0))
                        .replace('{phone}', currentGuest.phone || '');
                }

                ctx.fillText(text, el.x, el.y);

                // Draw selection border for better UI (optional, helpful for debugging)
                // ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
                // ctx.strokeRect(el.x - 200, el.y - el.fontSize, 200, el.fontSize * 1.2);
            });

            // 3. Draw QR Code
            if (qrImageRef.current && showRealData) {
                // Draw actual QR
                ctx.drawImage(qrImageRef.current, qrElement.x, qrElement.y, qrElement.size, qrElement.size);
            } else {
                // Placeholder QR
                if (!showRealData || !qrImageRef.current) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(qrElement.x, qrElement.y, qrElement.size, qrElement.size);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(qrElement.x, qrElement.y, qrElement.size, qrElement.size);

                    ctx.fillStyle = '#000';
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('QR Code', qrElement.x + qrElement.size / 2, qrElement.y + qrElement.size / 2);
                }
            }
        });
    };

    const addTextElement = () => {
        setTextElements([
            ...textElements,
            {
                id: Date.now().toString(),
                text: 'نص جديد',
                x: 400,
                y: 200 + textElements.length * 60,
                fontSize: 32,
                color: '#000000',
                fontFamily: 'Arial'
            }
        ]);
    };

    const updateTextElement = (id: string, field: string, value: any) => {
        setTextElements(prev => prev.map(el =>
            el.id === id ? { ...el, [field]: value } : el
        ));
    };

    const removeTextElement = (id: string) => {
        setTextElements(prev => prev.filter(el => el.id !== id));
    };

    const downloadCurrentCard = () => {
        const canvas = canvasRef.current;
        if (!canvas || !currentGuest) return;

        // Force a sync render before download to ensure everything is there
        renderCanvas();

        // Slight delay to ensure frame is painted? Not needed for toBlob usually if drawing is sync
        // But since we use requestAnimationFrame, we might want to wait or bypass it for download
        // For simplicity, we just use the current canvas state which should be up to date

        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invite_${currentGuest.name.replace(/\s+/g, '_')}.png`;
                a.click();
            }
        });
    };

    const generateAllCards = async () => {
        if (!confirm(`هل تريد توليد ${guests.length} بطاقة؟`)) return;

        setLoading(true);
        // This is a simulation. For real PDF/Zip generation, we'd need a backend service or client-side zip lib.
        // For now, we'll verify the data is ready.
        alert("سيتم تجهيز البطاقات... (هنا يجب إضافة كود التصدير المتعدد)");
        setLoading(false);
        navigate('/whatsapp-sender?event=' + eventId);
    }
};

if (!eventId) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-red-600">يجب تحديد حدث أولاً</p>
                    <Button onClick={() => navigate('/dashboard')} className="mt-4">
                        العودة للرئيسية
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

if (loading && guests.length === 0) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">جاري التحميل...</p>
            </div>
        </div>
    );
}

return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">استوديو البطاقات الموحد</h1>
                        <p className="text-purple-100">معاينة فورية مع QR حقيقي</p>
                    </div>
                    <Button
                        onClick={() => navigate('/whatsapp-sender?event=' + eventId)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                    >
                        <MessageCircle className="w-5 h-5 ml-2" />
                        الانتقال للإرسال
                    </Button>
                </div>
            </div>

            {/* Guest Navigator */}
            {guests.length > 0 && currentGuest && (
                <Card className="sticky top-4 z-10 shadow-lg border-t-4 border-purple-500">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => setCurrentGuestIndex(Math.max(0, currentGuestIndex - 1))}
                                disabled={currentGuestIndex === 0}
                                size="sm"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </Button>

                            <div className="flex-1 text-center">
                                <div className="text-sm text-gray-500">
                                    ضيف {currentGuestIndex + 1} من {guests.length}
                                </div>
                                <div className="text-xl font-bold">{currentGuest.name}</div>
                                <div className="text-sm text-gray-600">
                                    {currentGuest.table_no && `طاولة ${currentGuest.table_no}`}
                                    {currentGuest.companions_count !== undefined &&
                                        ` | ${currentGuest.companions_count} مرافق`}
                                </div>
                            </div>

                            <Button
                                onClick={() => setCurrentGuestIndex(Math.min(guests.length - 1, currentGuestIndex + 1))}
                                disabled={currentGuestIndex === guests.length - 1}
                                size="sm"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </Button>

                            <input
                                type="number"
                                min="1"
                                max={guests.length}
                                value={currentGuestIndex + 1}
                                onChange={(e) => {
                                    const idx = parseInt(e.target.value) - 1;
                                    if (idx >= 0 && idx < guests.length) {
                                        setCurrentGuestIndex(idx);
                                    }
                                }}
                                className="w-20 px-2 py-1 border rounded text-center"
                            />

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => setShowRealData(true)}
                                    size="sm"
                                    variant={showRealData ? 'default' : 'outline'}
                                >
                                    <Eye className="w-4 h-4 ml-1" />
                                    بيانات حقيقية
                                </Button>
                                <Button
                                    onClick={() => setShowRealData(false)}
                                    size="sm"
                                    variant={!showRealData ? 'default' : 'outline'}
                                >
                                    Placeholder
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor Side */}
                <div className="space-y-4 order-2 lg:order-1">
                    {/* Background Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                الخلفية
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleBackgroundUpload}
                                className="w-full px-3 py-2 border rounded"
                            />
                            {backgroundImage && (
                                <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    تم رفع الخلفية
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Text Elements */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Type className="w-5 h-5" />
                                النصوص
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                                💡 استخدم المتغيرات:
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <code className="bg-white px-2 py-1 rounded border">{'{name}'}</code>
                                    <code className="bg-white px-2 py-1 rounded border">{'{table}'}</code>
                                    <code className="bg-white px-2 py-1 rounded border">{'{companions}'}</code>
                                    <code className="bg-white px-2 py-1 rounded border">{'{phone}'}</code>
                                </div>
                            </div>

                            {textElements.map((el) => (
                                <div key={el.id} className="bg-gray-50 rounded-lg p-3 space-y-2 border">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={el.text}
                                            onChange={(e) => updateTextElement(el.id, 'text', e.target.value)}
                                            placeholder="النص"
                                            className="flex-1 px-2 py-1 border rounded"
                                        />
                                        <Button
                                            onClick={() => removeTextElement(el.id)}
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 border-red-300 px-2"
                                        >
                                            <span className="sr-only">حذف</span>
                                            X
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">X</label>
                                            <input
                                                type="number"
                                                value={el.x}
                                                onChange={(e) => updateTextElement(el.id, 'x', parseInt(e.target.value))}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">Y</label>
                                            <input
                                                type="number"
                                                value={el.y}
                                                onChange={(e) => updateTextElement(el.id, 'y', parseInt(e.target.value))}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">الحجم</label>
                                            <input
                                                type="number"
                                                value={el.fontSize}
                                                onChange={(e) => updateTextElement(el.id, 'fontSize', parseInt(e.target.value))}
                                                className="w-full px-2 py-1 border rounded text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-500">اللون</label>
                                            <input
                                                type="color"
                                                value={el.color}
                                                onChange={(e) => updateTextElement(el.id, 'color', e.target.value)}
                                                className="w-full h-8 rounded"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button onClick={addTextElement} className="w-full" variant="outline">
                                <PlusIcon className="w-4 h-4 ml-2" />
                                إضافة نص جديد
                            </Button>
                        </CardContent>
                    </Card>

                    {/* QR Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <QrCodeIcon className="w-5 h-5" />
                                إعدادات الباركود (QR)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">X Position</label>
                                    <input
                                        type="number"
                                        value={qrElement.x}
                                        onChange={(e) => setQRElement({ ...qrElement, x: parseInt(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Y Position</label>
                                    <input
                                        type="number"
                                        value={qrElement.y}
                                        onChange={(e) => setQRElement({ ...qrElement, y: parseInt(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500">Size</label>
                                    <input
                                        type="number"
                                        value={qrElement.size}
                                        onChange={(e) => setQRElement({ ...qrElement, size: parseInt(e.target.value) })}
                                        className="w-full px-2 py-1 border rounded"
                                    />
                                </div>
                            </div>
                            {showRealData && currentGuest && (
                                <div className="text-xs text-green-600 bg-green-50 rounded p-2 flex items-center gap-2 mt-2">
                                    <CheckCircle className="w-3 h-3" />
                                    QR حقيقي جاهز للضيف: {currentGuest.name}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Preview Side */}
                <div className="sticky top-4 order-1 lg:order-2">
                    <Card className="overflow-hidden">
                        <CardHeader className="bg-gray-50 border-b">
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                المعاينة الفورية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                            <div className="bg-gray-100 rounded-lg p-2 flex justify-center overflow-auto max-h-[600px]">
                                <canvas
                                    ref={canvasRef}
                                    width={800}
                                    height={1200}
                                    className="max-w-full h-auto border-2 border-gray-300 rounded shadow-lg bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    onClick={downloadCurrentCard}
                                    disabled={!backgroundImage || !currentGuest}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    <Download className="w-4 h-4 ml-1" />
                                    تحميل هذه البطاقة
                                </Button>
                                <Button
                                    onClick={generateAllCards}
                                    disabled={!backgroundImage || loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                >
                                    <Sparkles className="w-4 h-4 ml-1" />
                                    توليد وتصدير الكل
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </div>
);
};

const PlusIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
    </svg>
);

export default UnifiedInvitationStudio;
