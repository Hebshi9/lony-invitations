import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    ChevronLeft, ChevronRight, Eye, Download,
    Palette, Type, Image as ImageIcon, QrCode as QrCodeIcon,
    Save, Sparkles, CheckCircle, MessageCircle, Move, Trash2,
    AlignLeft, AlignCenter, AlignRight, Bold, Settings2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import QRCode from 'qrcode';

// --- Types ---
interface Guest {
    id: string;
    name: string;
    phone?: string;
    table_no?: string;
    companions_count?: number;
    qr_payload: string;
}

interface DesignElement {
    id: string;
    type: 'text' | 'qr';
    x: number;
    y: number;
    // Text Specific
    text?: string;
    fontSize?: number;
    color?: string;
    fontFamily?: string;
    fontWeight?: string;
    align?: 'left' | 'center' | 'right';
    // QR Specific
    size?: number;
}

// --- Constants ---
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const PREVIEW_SCALE = 0.4; // Scale down for UI

const UnifiedInvitationStudio: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const eventId = searchParams.get('event');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- State ---
    const [guests, setGuests] = useState<Guest[]>([]);
    const [currentGuestIndex, setCurrentGuestIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Design State
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [elements, setElements] = useState<DesignElement[]>([
        { id: 'qr', type: 'qr', x: 440, y: 1500, size: 200 } // Default QR
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showRealData, setShowRealData] = useState(true);

    // Refs for Dragging
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const draggedId = useRef<string | null>(null);

    // Refs for Rendering
    const bgImageRef = useRef<HTMLImageElement | null>(null);
    const qrImageRef = useRef<HTMLImageElement | null>(null);

    const currentGuest = guests[currentGuestIndex];
    const selectedElement = elements.find(el => el.id === selectedId);

    // --- Initialization ---
    useEffect(() => {
        if (eventId) {
            loadGuests();
            loadDesign();
        }
    }, [eventId]);

    const loadDesign = async () => {
        const { data } = await supabase.from('events').select('design_config').eq('id', eventId).single();
        if (data?.design_config) {
            const config = data.design_config;
            if (config.elements) setElements(config.elements);
            if (config.backgroundImage) setBackgroundImage(config.backgroundImage);
        }
    };

    const saveDesign = async () => {
        setSaving(true);
        try {
            const config = {
                elements,
                backgroundImage, // Note: storing full base64 in DB is bad practice for prod (use storage bucket), fine for MVP demo
                updatedAt: new Date().toISOString()
            };
            await supabase.from('events').update({ design_config: config }).eq('id', eventId);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // Auto-save (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (eventId && elements.length > 0) saveDesign();
        }, 3000);
        return () => clearTimeout(timer);
    }, [elements, backgroundImage]);


    // --- Drag & Drop Logic ---
    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const el = elements.find(item => item.id === id);
        if (!el) return;

        setSelectedId(id);
        isDragging.current = true;
        draggedId.current = id;

        // Calculate offset (Mouse Pos - Element Pos)
        // We need to account for the scale (PREVIEW_SCALE)
        const clientX = e.clientX;
        const clientY = e.clientY;
        const rect = (e.target as HTMLElement).getBoundingClientRect();

        dragOffset.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current || !draggedId.current || !containerRef.current) return;
        e.preventDefault();

        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate raw position relative to container
        const rawX = e.clientX - containerRect.left - dragOffset.current.x;
        const rawY = e.clientY - containerRect.top - dragOffset.current.y;

        // Convert back to canvas coordinates
        const canvasX = rawX / PREVIEW_SCALE;
        const canvasY = rawY / PREVIEW_SCALE;

        setElements(prev => prev.map(el =>
            el.id === draggedId.current ? { ...el, x: canvasX, y: canvasY } : el
        ));
    };

    const handlePointerUp = () => {
        isDragging.current = false;
        draggedId.current = null;
    };


    // --- Rendering Logic ---
    // 1. Load Background
    useEffect(() => {
        if (backgroundImage) {
            const img = new Image();
            img.src = backgroundImage;
            img.onload = () => { bgImageRef.current = img; renderCanvas(); };
        } else {
            bgImageRef.current = null;
            renderCanvas();
        }
    }, [backgroundImage]);

    // 2. Load QR
    useEffect(() => {
        const generateQR = async () => {
            if (currentGuest && showRealData) {
                try {
                    const qrUrl = `https://lonyinvite.netlify.app/invite/${currentGuest.qr_payload}`;
                    const qrDataURL = await QRCode.toDataURL(qrUrl, { width: 500, margin: 1, color: { dark: '#000000', light: '#FFFFFFFF' } });
                    const img = new Image();
                    img.src = qrDataURL;
                    img.onload = () => { qrImageRef.current = img; renderCanvas(); };
                } catch { /* ignore */ }
            } else {
                qrImageRef.current = null; // Use placeholder
                renderCanvas();
            }
        };
        generateQR();
    }, [currentGuest, showRealData]);

    // 3. Render Loop
    useEffect(() => {
        renderCanvas();
    }, [elements, showRealData]);

    const renderCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Reset
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Background
        if (bgImageRef.current) {
            ctx.drawImage(bgImageRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // Draw Elements (Only for Export/Canvas view, NOT for the interactive overlay)
        elements.forEach(el => {
            if (el.type === 'text') {
                ctx.font = `${el.fontWeight || 'normal'} ${el.fontSize}px ${el.fontFamily || 'Arial'}`;
                ctx.fillStyle = el.color || '#000';
                ctx.textAlign = (el.align as CanvasTextAlign) || 'center';
                ctx.textBaseline = 'top'; // Easier for HTML mapping

                let text = el.text || '';
                if (showRealData && currentGuest) {
                    text = text
                        .replace('{name}', currentGuest.name || '')
                        .replace('{table}', currentGuest.table_no || '')
                        .replace('{companions}', String(currentGuest.companions_count || 0));
                }
                ctx.fillText(text, el.x, el.y);
            } else if (el.type === 'qr') {
                const size = el.size || 200;
                if (qrImageRef.current && showRealData) {
                    ctx.drawImage(qrImageRef.current, el.x, el.y, size, size);
                } else {
                    // Placeholder
                    ctx.fillStyle = 'white';
                    ctx.fillRect(el.x, el.y, size, size);
                    ctx.fillStyle = 'black';
                    ctx.fillRect(el.x + 10, el.y + 10, size - 20, size - 20);
                }
            }
        });
    };

    // --- Element Helper ---
    const addText = () => {
        const newEl: DesignElement = {
            id: Date.now().toString(),
            type: 'text',
            text: 'نص جديد {name}',
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            fontSize: 40,
            color: '#000000',
            align: 'center',
            fontWeight: 'bold',
            fontFamily: 'Arial'
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
    };

    const updateElement = (key: keyof DesignElement, value: any) => {
        if (!selectedId) return;
        setElements(prev => prev.map(el => el.id === selectedId ? { ...el, [key]: value } : el));
    };

    const deleteElement = () => {
        if (!selectedId) return;
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
    };

    // --- Loading ---
    const loadGuests = async () => {
        setLoading(true);
        const { data } = await supabase.from('guests').select('*').eq('event_id', eventId).eq('is_demo', false);
        if (data) setGuests(data);
        setLoading(false);
    };

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setBackgroundImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const downloadCard = () => {
        const link = document.createElement('a');
        link.download = `invite_${currentGuest?.name || 'card'}.png`;
        link.href = canvasRef.current!.toDataURL();
        link.click();
    };

    // --- Event Selection Logic ---
    const [eventsList, setEventsList] = useState<{ id: string, name: string, date: string }[]>([]);

    useEffect(() => {
        if (!eventId) {
            const fetchEvents = async () => {
                const { data } = await supabase.from('events').select('id, name, date').order('created_at', { ascending: false });
                if (data) setEventsList(data);
            };
            fetchEvents();
        }
    }, [eventId]);

    if (!eventId) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6" dir="rtl">
                <div className="max-w-4xl w-full space-y-8">
                    <div className="text-center">
                        <Sparkles className="w-16 h-16 text-lony-gold mx-auto mb-4" />
                        <h1 className="text-3xl font-bold text-lony-navy">استوديو تصميم البطاقات</h1>
                        <p className="text-gray-600 mt-2">اختر المناسبة للبدء في تصميم بطاقة الدعوة</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {eventsList.map(event => (
                            <button
                                key={event.id}
                                onClick={() => navigate(`/studio?event=${event.id}`)}
                                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 text-right group"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                        <Palette className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{event.date}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">{event.name}</h3>
                                <p className="text-sm text-gray-500">انقر للبدء في التصميم</p>
                            </button>
                        ))}

                        {/* Empty State */}
                        {eventsList.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed">
                                <p className="text-gray-400">لا توجد مناسبات مسجلة</p>
                                <Button
                                    onClick={() => navigate('/event')}
                                    className="mt-4 bg-lony-navy text-white"
                                >
                                    إضافة مناسبة جديدة
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6 flex gap-6" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>

            {/* 1. Sidebar (Controls) */}
            <div className="w-[350px] flex flex-col gap-4 h-full">

                {/* Header Card */}
                <Card className="shadow-lg border-l-4 border-lony-gold">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl flex justify-between">
                            <span>استوديو التصميم</span>
                            {saving && <span className="text-xs text-gray-400 animate-pulse">جاري الحفظ...</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={addText} className="w-full bg-lony-navy hover:bg-lony-navy/90 text-white">
                            <Type className="w-4 h-4 ml-2" /> إضافة نص
                        </Button>
                        <div className="relative">
                            <input type="file" onChange={handleBackgroundUpload} className="hidden" id="bg-upload" />
                            <Button variant="outline" className="w-full border-dashed" onClick={() => document.getElementById('bg-upload')?.click()}>
                                <ImageIcon className="w-4 h-4 ml-2" /> تغيير الخلفية
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Properties Panel (Dynamic) */}
                {selectedElement ? (
                    <Card className="flex-1 animate-in slide-in-from-left">
                        <CardHeader className="bg-gray-50 border-b pb-2">
                            <CardTitle className="text-sm font-bold flex justify-between items-center">
                                <span>خصائص {selectedElement.type === 'text' ? 'النص' : 'الباركود'}</span>
                                <Button variant="ghost" size="sm" onClick={deleteElement} className="text-red-500 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                            {selectedElement.type === 'text' && (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">المحتوى</label>
                                        <textarea
                                            value={selectedElement.text}
                                            onChange={(e) => updateElement('text', e.target.value)}
                                            className="w-full p-2 border rounded text-right min-h-[80px]"
                                            dir="auto"
                                        />
                                        <p className="text-[10px] text-gray-400">المتغيرات: {'{name}, {table}'}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-500">الحجم</label>
                                            <input type="number" value={selectedElement.fontSize} onChange={(e) => updateElement('fontSize', Number(e.target.value))} className="w-full p-2 border rounded" />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">اللون</label>
                                            <div className="flex items-center gap-2 border rounded p-1">
                                                <input type="color" value={selectedElement.color} onChange={(e) => updateElement('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                                                <span className="text-xs text-gray-600">{selectedElement.color}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">المحاذاة</label>
                                        <div className="flex border rounded overflow-hidden">
                                            {['left', 'center', 'right'].map((align) => (
                                                <button
                                                    key={align}
                                                    className={`flex-1 p-2 hover:bg-gray-100 ${selectedElement.align === align ? 'bg-indigo-50 text-indigo-600' : ''}`}
                                                    onClick={() => updateElement('align', align)}
                                                >
                                                    {align === 'left' ? <AlignLeft className="w-4 h-4 mx-auto" /> : align === 'center' ? <AlignCenter className="w-4 h-4 mx-auto" /> : <AlignRight className="w-4 h-4 mx-auto" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedElement.type === 'qr' && (
                                <div>
                                    <label className="text-xs text-gray-500">الحجم (بكسل)</label>
                                    <input type="number" value={selectedElement.size} onChange={(e) => updateElement('size', Number(e.target.value))} className="w-full p-2 border rounded" />
                                </div>
                            )}

                            <div className="pt-4 border-t">
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                                    <span>X: {Math.round(selectedElement.x)}</span>
                                    <span>Y: {Math.round(selectedElement.y)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-white/50 rounded-xl border-2 border-dashed border-gray-200">
                        <Settings2 className="w-12 h-12 mb-2 opacity-20" />
                        <p>اضغط على أي عنصر لتعديله</p>
                    </div>
                )}
            </div>

            {/* 2. Main Canvas Area (Center) */}
            <div className="flex-1 flex flex-col items-center justify-center relative bg-gray-200/50 rounded-xl overflow-hidden"
                onPointerMove={handlePointerMove}
            >
                {/* The "Review" Controls */}
                <div className="absolute top-4 z-20 flex items-center gap-2 bg-white p-2 rounded-full shadow-lg">
                    <Button size="icon" variant="ghost" onClick={() => setCurrentGuestIndex(Math.max(0, currentGuestIndex - 1))}>
                        <ChevronRight />
                    </Button>
                    <span className="text-sm font-bold min-w-[100px] text-center">
                        {currentGuest ? currentGuest.name : 'ضيف افتراضي'}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => setCurrentGuestIndex(Math.min(guests.length - 1, currentGuestIndex + 1))}>
                        <ChevronLeft />
                    </Button>
                    <div className="h-6 w-px bg-gray-200 mx-2"></div>
                    <Button size="sm" onClick={downloadCard} className="bg-lony-gold text-lony-navy hover:bg-yellow-500">
                        <Download className="w-4 h-4 ml-1" /> تحميل
                    </Button>
                </div>

                {/* The EDITABLE Stage */}
                <div
                    ref={containerRef}
                    className="relative shadow-2xl bg-white transition-all origin-top"
                    style={{
                        width: CANVAS_WIDTH * PREVIEW_SCALE,
                        height: CANVAS_HEIGHT * PREVIEW_SCALE,
                        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                        backgroundSize: 'cover'
                    }}
                >
                    {/* Render all elements as HTML Overlays for Interaction */}
                    {elements.map(el => {
                        // Compute style based on props
                        let content = '';
                        if (el.type === 'text') {
                            content = el.text || '';
                            if (showRealData && currentGuest) {
                                content = content
                                    .replace('{name}', currentGuest.name || '')
                                    .replace('{table}', currentGuest.table_no || '')
                                    .replace('{companions}', String(currentGuest.companions_count || 0));
                            }
                        }

                        const isSelected = selectedId === el.id;

                        return (
                            <div
                                key={el.id}
                                onPointerDown={(e) => handlePointerDown(e, el.id)}
                                className={`absolute cursor-move select-none flex items-center justify-center group ${isSelected ? 'ring-2 ring-blue-500 z-50' : 'hover:ring-1 hover:ring-blue-300 z-10'}`}
                                style={{
                                    left: el.x * PREVIEW_SCALE,
                                    top: el.y * PREVIEW_SCALE,
                                    width: el.type === 'qr' ? (el.size || 200) * PREVIEW_SCALE : 'auto',
                                    height: el.type === 'qr' ? (el.size || 200) * PREVIEW_SCALE : 'auto',
                                    // Text Styles
                                    fontSize: (el.fontSize || 20) * PREVIEW_SCALE,
                                    color: el.color,
                                    fontFamily: el.fontFamily,
                                    fontWeight: 'bold', // force bold for visibility
                                    whiteSpace: 'nowrap',
                                    transform: 'translate(-50%, -50%)', // Center pivot
                                }}
                            >
                                {el.type === 'text' ? (
                                    <span>{content}</span>
                                ) : (
                                    <div className="w-full h-full bg-black/10 flex items-center justify-center border-2 border-dashed border-black/20">
                                        <QrCodeIcon className="w-1/2 h-1/2 opacity-50" />
                                    </div>
                                )}

                                {/* Resize Handle (Optional/Visual) */}
                                {isSelected && <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full shadow-lg" />}
                            </div>
                        );
                    })}
                </div>

                {/* The HIDDEN Canvas for Export */}
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="hidden" // Keep hidden, used only for export
                />

                <p className="mt-4 text-xs text-gray-400">
                    * الحجم النهائي للتصدير: {CANVAS_WIDTH}x{CANVAS_HEIGHT} بكسل
                </p>
            </div>
        </div>
    );
};

export default UnifiedInvitationStudio;
