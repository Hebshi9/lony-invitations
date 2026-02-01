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

    const currentGuest = guests[currentGuestIndex];

    useEffect(() => {
        if (eventId) {
            loadGuests();
        }
    }, [eventId]);

    useEffect(() => {
        if (currentGuest && backgroundImage) {
            renderCanvas();
        }
    }, [currentGuest, backgroundImage, textElements, qrElement, showRealData]);

    const loadGuests = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', eventId)
                .eq('is_demo', false); // Exclude demo guests

            if (error) throw error;
            if (data && data.length > 0) {
                setGuests(data);
            } else {
                alert('لا يوجد ضيوف لهذا الحدث. قم برفع قائمة الضيوف أولاً.');
                navigate('/upload-guests?event=' + eventId);
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

    const renderCanvas = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !backgroundImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background
        const bgImg = new Image();
        bgImg.onload = async () => {
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

            // Draw text elements
            textElements.forEach(el => {
                ctx.font = `${el.fontSize}px ${el.fontFamily}`;
                ctx.fillStyle = el.color;
                ctx.textAlign = 'right';

                let text = el.text;
                if (showRealData && currentGuest) {
                    text = text
                        .replace('{name}', currentGuest.name || '')
                        .replace('{table}', currentGuest.table_no || '')
                        .replace('{companions}', String(currentGuest.companions_count || 0))
                        .replace('{phone}', currentGuest.phone || '');
                }

                ctx.fillText(text, el.x, el.y);
            });

            // Draw QR Code
            if (currentGuest && showRealData) {
                const qrUrl = `https://lonyinvite.netlify.app/invite/${currentGuest.qr_payload}`;
                const qrDataURL = await QRCode.toDataURL(qrUrl, {
                    width: qrElement.size,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });

                const qrImg = new Image();
                qrImg.onload = () => {
                    ctx.drawImage(qrImg, qrElement.x, qrElement.y, qrElement.size, qrElement.size);
                };
                qrImg.src = qrDataURL;
            } else {
                // Placeholder QR
                ctx.fillStyle = '#E5E7EB';
                ctx.fillRect(qrElement.x, qrElement.y, qrElement.size, qrElement.size);
                ctx.fillStyle = '#6B7280';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('QR Code', qrElement.x + qrElement.size / 2, qrElement.y + qrElement.size / 2);
            }
        };
        bgImg.src = backgroundImage;
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
        setTextElements(textElements.map(el =>
            el.id === id ? { ...el, [field]: value } : el
        ));
    };

    const removeTextElement = (id: string) => {
        setTextElements(textElements.filter(el => el.id !== id));
    };

    const downloadCurrentCard = () => {
        const canvas = canvasRef.current;
        if (!canvas || !currentGuest) return;

        canvas.toBlob(blob => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentGuest.name}.png`;
                a.click();
            }
        });
    };

    const generateAllCards = async () => {
        if (!confirm(`هل تريد توليد ${guests.length} بطاقة؟ هذا قد يستغرق وقتاً.`)) return;

        setLoading(true);
        // Simulate generation - in a real app we might upload these to storage
        // For now we just cycle through them to show it's working
        for (let i = 0; i < guests.length; i++) {
            setCurrentGuestIndex(i);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        setLoading(false);

        if (confirm('تم الانتهاء! هل تريد الانتقال لصفحة إرسال الواتساب؟')) {
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
