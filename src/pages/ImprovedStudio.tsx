import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    ChevronLeft, ChevronRight, Eye, Download,
    Palette, Type, Image as ImageIcon, QrCode as QrCodeIcon,
    Save, Sparkles, CheckCircle
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

const ImprovedStudio: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const eventId = searchParams.get('event');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [guests, setGuests] = useState<Guest[]>([]);
    const [currentGuestIndex, setCurrentGuestIndex] = useState(0);
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [textElements, setTextElements] = useState<TextElement[]>([]);
    const [qrElement, setQRElement] = useState<QRElement>({ x: 50, y: 800, size: 200 });
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
                navigate('/upload-guests-new?event=' + eventId);
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
        if (!confirm(`هل تريد توليد ${guests.length} بطاقة؟`)) return;

        setLoading(true);
        for (let i = 0; i < guests.length; i++) {
            setCurrentGuestIndex(i);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        setLoading(false);
        alert('تم توليد جميع البطاقات!');
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
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl p-6">
                    <h1 className="text-3xl font-bold mb-2">استوديو البطاقات المحسّن</h1>
                    <p className="text-purple-100">معاينة فورية مع QR حقيقي</p>
                </div>

                {/* Guest Navigator */}
                {guests.length > 0 && currentGuest && (
                    <Card className="sticky top-4 z-10 shadow-lg">
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
                <div className="grid grid-cols-2 gap-6">
                    {/* Editor Side */}
                    <div className="space-y-4">
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
                                    💡 استخدم: <code className="bg-white px-1 rounded">{'{name}'}</code>,{' '}
                                    <code className="bg-white px-1 rounded">{'{table}'}</code>,{' '}
                                    <code className="bg-white px-1 rounded">{'{companions}'}</code>
                                </div>

                                {textElements.map((el) => (
                                    <div key={el.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                        <input
                                            type="text"
                                            value={el.text}
                                            onChange={(e) => updateTextElement(el.id, 'text', e.target.value)}
                                            placeholder="النص"
                                            className="w-full px-2 py-1 border rounded"
                                        />
                                        <div className="grid grid-cols-4 gap-2">
                                            <input
                                                type="number"
                                                value={el.x}
                                                onChange={(e) => updateTextElement(el.id, 'x', parseInt(e.target.value))}
                                                placeholder="X"
                                                className="px-2 py-1 border rounded text-sm"
                                            />
                                            <input
                                                type="number"
                                                value={el.y}
                                                onChange={(e) => updateTextElement(el.id, 'y', parseInt(e.target.value))}
                                                placeholder="Y"
                                                className="px-2 py-1 border rounded text-sm"
                                            />
                                            <input
                                                type="number"
                                                value={el.fontSize}
                                                onChange={(e) => updateTextElement(el.id, 'fontSize', parseInt(e.target.value))}
                                                placeholder="الحجم"
                                                className="px-2 py-1 border rounded text-sm"
                                            />
                                            <input
                                                type="color"
                                                value={el.color}
                                                onChange={(e) => updateTextElement(el.id, 'color', e.target.value)}
                                                className="w-full h-8 rounded"
                                            />
                                        </div>
                                        <Button
                                            onClick={() => removeTextElement(el.id)}
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-red-600 border-red-300"
                                        >
                                            حذف
                                        </Button>
                                    </div>
                                ))}

                                <Button onClick={addTextElement} className="w-full">
                                    + إضافة نص
                                </Button>
                            </CardContent>
                        </Card>

                        {/* QR Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <QrCodeIcon className="w-5 h-5" />
                                    QR Code
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="number"
                                        value={qrElement.x}
                                        onChange={(e) => setQRElement({ ...qrElement, x: parseInt(e.target.value) })}
                                        placeholder="X"
                                        className="px-2 py-1 border rounded"
                                    />
                                    <input
                                        type="number"
                                        value={qrElement.y}
                                        onChange={(e) => setQRElement({ ...qrElement, y: parseInt(e.target.value) })}
                                        placeholder="Y"
                                        className="px-2 py-1 border rounded"
                                    />
                                    <input
                                        type="number"
                                        value={qrElement.size}
                                        onChange={(e) => setQRElement({ ...qrElement, size: parseInt(e.target.value) })}
                                        placeholder="الحجم"
                                        className="px-2 py-1 border rounded"
                                    />
                                </div>
                                {showRealData && currentGuest && (
                                    <div className="text-xs text-green-600 bg-green-50 rounded p-2">
                                        ✅ QR حقيقي للضيف: {currentGuest.name}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preview Side */}
                    <div className="sticky top-32">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Eye className="w-5 h-5" />
                                    المعاينة الفورية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-gray-100 rounded-lg p-4">
                                    <canvas
                                        ref={canvasRef}
                                        width={800}
                                        height={1200}
                                        className="w-full border-2 border-gray-300 rounded shadow-lg bg-white"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        onClick={downloadCurrentCard}
                                        disabled={!backgroundImage || !currentGuest}
                                        className="w-full"
                                    >
                                        <Download className="w-4 h-4 ml-1" />
                                        تحميل البطاقة
                                    </Button>
                                    <Button
                                        onClick={generateAllCards}
                                        disabled={!backgroundImage || loading}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Sparkles className="w-4 h-4 ml-1" />
                                        تصدير الكل
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

export default ImprovedStudio;
