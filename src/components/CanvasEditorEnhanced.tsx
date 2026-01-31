import React, { useState, useRef, useEffect } from 'react';
import { CardTemplate } from '../types';
import { Button } from './ui/Button';
import { Save, Type, QrCode, X, Trash2, Grid3x3, Move, Maximize2, AlignCenter, AlignLeft, AlignRight, Bold, Type as TypeIcon, Palette, Pipette } from 'lucide-react';
import QRCodeLib from 'qrcode';

export interface CanvasElement {
    id: string;
    type: 'text' | 'qr';
    label: string;
    x: number; // percentage
    y: number; // percentage
    width?: number; // pixels
    height?: number; // pixels
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'left' | 'center' | 'right';
    content?: string;
    prefix?: string;
    qrColor?: string;
    qrBgColor?: string;
    qrPadding?: number;
    qrOpacity?: number;
    qrDotShape?: 'square' | 'rounded' | 'dots' | 'fluid';
    qrEyeColor?: string;
    qrEyeShape?: 'square' | 'rounded' | 'fluid';
    // Text effects
    opacity?: number; // 0-100
    textShadow?: string; // CSS shadow
    textOutline?: { width: number; color: string; };
}

interface CanvasEditorProps {
    template?: CardTemplate;
    backgroundUrl?: string;
    initialElements?: CanvasElement[];
    onClose: () => void;
    onSave: (elements: CanvasElement[], dimensions?: { width: number; height: number }) => void;
    availableFields?: string[];
    cardDimensions?: { width: number; height: number };
}

// Preset sizes
const PRESET_SIZES = [
    { name: 'مخصص', width: 1080, height: 1920 },
    { name: 'A4 Portrait', width: 2480, height: 3508 },
    { name: 'A4 Landscape', width: 3508, height: 2480 },
    { name: 'Instagram Post', width: 1080, height: 1080 },
    { name: 'Instagram Story', width: 1080, height: 1920 },
    { name: 'قصة واتساب', width: 1080, height: 1920 },
];

const FONTS = [
    { name: 'Amiri', label: 'أميري (Amiri)' },
    { name: 'Cairo', label: 'كايرو (Cairo)' },
    { name: 'Tajawal', label: 'تجوال (Tajawal)' },
    { name: 'Arial', label: 'Arial' },
    { name: 'Times New Roman', label: 'Times New Roman' },
];

const CustomQR: React.FC<{
    value: string;
    size: number;
    color: string;
    bgColor: string;
    padding: number;
    opacity: number;
    dotShape: 'square' | 'rounded' | 'dots' | 'fluid';
    eyeColor?: string;
    eyeShape?: 'square' | 'rounded' | 'fluid';
}> = ({ value, size, color, bgColor, padding, opacity, dotShape, eyeColor, eyeShape }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const renderQR = async () => {
            if (!canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const qrData = await QRCodeLib.create(value, { errorCorrectionLevel: 'M' });
            const modules = qrData.modules;
            const moduleCount = modules.size;
            const moduleSize = (size - (padding * 2)) / moduleCount;

            canvas.width = size;
            canvas.height = size;
            ctx.clearRect(0, 0, size, size);

            if (bgColor && bgColor !== 'transparent') {
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, size, size);
            }

            // Helper to check if a module is part of the 3 positioning patterns (Eyes)
            const isEye = (r: number, c: number) => {
                // Top-Left
                if (r < 7 && c < 7) return true;
                // Top-Right
                if (r < 7 && c >= moduleCount - 7) return true;
                // Bottom-Left
                if (r >= moduleCount - 7 && c < 7) return true;
                return false;
            };

            ctx.globalAlpha = opacity / 100;

            modules.data.forEach((isDark, index) => {
                if (isDark) {
                    const row = Math.floor(index / moduleCount);
                    const col = index % moduleCount;
                    const x = padding + col * moduleSize;
                    const y = padding + row * moduleSize;

                    // Determine color and shape
                    const isEyeModule = isEye(row, col);
                    ctx.fillStyle = isEyeModule && eyeColor ? eyeColor : color;

                    // Eye shape override (optional, for now use standard square for eyes to ensure readability)
                    // or implement eyeShape later. For now, keep eyes usually square or rounded.
                    const currentShape = isEyeModule && eyeShape ? eyeShape : dotShape;

                    if (currentShape === 'rounded') {
                        ctx.beginPath();
                        ctx.arc(x + moduleSize / 2, y + moduleSize / 2, moduleSize / 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (currentShape === 'dots') {
                        ctx.beginPath();
                        ctx.arc(x + moduleSize / 2, y + moduleSize / 2, moduleSize / 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (currentShape === 'fluid') {
                        ctx.beginPath();
                        // Improved fluid look: connected circles
                        ctx.arc(x + moduleSize / 2, y + moduleSize / 2, moduleSize / 1.8, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Square
                        ctx.fillRect(x, y, moduleSize + 0.5, moduleSize + 0.5);
                    }
                }
            });

            ctx.globalAlpha = 1.0;
        };

        renderQR();
    }, [value, size, color, bgColor, padding, opacity, dotShape, eyeColor, eyeShape]);

    return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
};

const CanvasEditor: React.FC<CanvasEditorProps> = ({
    template,
    backgroundUrl: externalBgUrl,
    initialElements = [],
    onClose,
    onSave,
    availableFields = [],
    cardDimensions: initialDimensions
}) => {
    const [elements, setElements] = useState<CanvasElement[]>(initialElements);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [bgUrl, setBgUrl] = useState<string>(externalBgUrl || template?.background_url || '');

    const [canvasDimensions, setCanvasDimensions] = useState(initialDimensions || { width: 1080, height: 1920 });
    const [selectedPreset, setSelectedPreset] = useState(0);

    const [snapToGrid, setSnapToGrid] = useState(true);
    const GRID_SIZE = 5;

    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<any>(null);
    const resizeRef = useRef<any>(null);

    const selectedElement = elements.find(el => el.id === selectedElementId);

    const snap = (value: number): number => {
        if (!snapToGrid) return value;
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    };

    const addElement = (type: 'text' | 'qr') => {
        const newElement: CanvasElement = {
            id: crypto.randomUUID(),
            type,
            label: type === 'text' ? 'نص جديد' : 'QR Code',
            x: snap(50),
            y: snap(50),
            width: type === 'qr' ? 150 : undefined,
            height: type === 'qr' ? 150 : undefined,
            fontSize: type === 'text' ? 50 : 150,
            color: '#000000',
            fontFamily: 'Amiri',
            fontWeight: 'bold',
            textAlign: 'center',
            content: type === 'qr' ? 'https://example.com' : 'نص تجريبي',
            qrColor: '#000000',
            qrBgColor: 'transparent',
            qrPadding: 10,
            qrOpacity: 100,
            qrDotShape: 'square',
            qrEyeColor: '#000000',
            qrEyeShape: 'square'
        };
        setElements([...elements, newElement]);
        setSelectedElementId(newElement.id);
    };

    const updateElement = (id: string, updates: Partial<CanvasElement>) => {
        setElements(elements.map(el =>
            el.id === id ? { ...el, ...updates } : el
        ));
    };

    const deleteElement = (id: string) => {
        setElements(elements.filter(el => el.id !== id));
        if (selectedElementId === id) {
            setSelectedElementId(null);
        }
    };

    const handleMouseDown = (e: React.MouseEvent, id: string, handle?: string) => {
        e.stopPropagation();
        setSelectedElementId(id);

        const element = elements.find(el => el.id === id);
        if (!element || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();

        if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            resizeRef.current = {
                id,
                startX: e.clientX,
                startY: e.clientY,
                initialWidth: element.width || element.fontSize,
                initialHeight: element.height || element.fontSize,
                containerWidth: rect.width,
                containerHeight: rect.height
            };
        } else {
            dragRef.current = {
                id,
                startX: e.clientX,
                startY: e.clientY,
                initialLeft: element.x,
                initialTop: element.y,
                containerWidth: rect.width,
                containerHeight: rect.height
            };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing && resizeRef.current) {
                const { id, startX, startY, initialWidth, containerWidth } = resizeRef.current;
                const deltaX = e.clientX - startX;
                // const deltaY = e.clientY - startY;
                const pixelDelta = (deltaX / containerWidth) * canvasDimensions.width;

                // Simple uniform scaling for now based on X movement
                let newSize = Math.max(20, initialWidth + pixelDelta);

                updateElement(id, {
                    width: newSize,
                    height: newSize,
                    fontSize: newSize
                });

            } else if (dragRef.current) {
                const { id, startX, startY, initialLeft, initialTop, containerWidth, containerHeight } = dragRef.current;
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                const newX = initialLeft + (deltaX / containerWidth) * 100;
                const newY = initialTop + (deltaY / containerHeight) * 100;

                updateElement(id, {
                    x: snap(Math.max(0, Math.min(100, newX))),
                    y: snap(Math.max(0, Math.min(100, newY)))
                });
            }
        };

        const handleMouseUp = () => {
            dragRef.current = null;
            resizeRef.current = null;
            setIsResizing(false);
            setResizeHandle(null);
        };

        if (dragRef.current || resizeRef.current) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragRef.current, resizeRef.current, isResizing, snapToGrid]);

    const handleSave = async () => {
        setSaving(true);
        await onSave(elements, canvasDimensions);
        setSaving(false);
    };

    // Scale calculation
    const maxDisplayHeight = 600;
    const scale = maxDisplayHeight / canvasDimensions.height;
    const displayWidth = canvasDimensions.width * scale;
    const displayHeight = canvasDimensions.height * scale;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex" dir="rtl">
            <div className="w-80 bg-white flex flex-col h-full shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between bg-lony-navy text-white">
                    <h2 className="text-xl font-bold">🎨 محرر التصميم</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Controls Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* 1. Global Settings */}
                    <div className="p-4 border-b bg-gray-50 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">مقاس البطاقة</label>
                            <select
                                className="w-full p-2 border rounded text-sm mb-2"
                                value={selectedPreset}
                                onChange={(e) => {
                                    const idx = Number(e.target.value);
                                    setSelectedPreset(idx);
                                    setCanvasDimensions(PRESET_SIZES[idx]);
                                }}
                            >
                                {PRESET_SIZES.map((preset, idx) => (
                                    <option key={idx} value={idx}>{preset.name}</option>
                                ))}
                            </select>
                        </div>

                        <label className="flex items-center cursor-pointer text-sm">
                            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="mr-2 rounded text-lony-navy form-checkbox" />
                            <Grid3x3 className="w-4 h-4 ml-1 text-gray-500" /> Snap to Grid
                        </label>
                    </div>

                    {/* 2. Add Elements */}
                    <div className="p-4 border-b">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">إضافة عناصر</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" className="flex items-center justify-center gap-2 h-10 border-dashed border-2 hover:bg-blue-50 hover:border-blue-300" onClick={() => addElement('text')}>
                                <Type className="w-4 h-4 text-blue-600" />
                                <span>نص</span>
                            </Button>
                            <Button variant="outline" className="flex items-center justify-center gap-2 h-10 border-dashed border-2 hover:bg-purple-50 hover:border-purple-300" onClick={() => addElement('qr')}>
                                <QrCode className="w-4 h-4 text-purple-600" />
                                <span>QR</span>
                            </Button>
                        </div>
                    </div>

                    {/* 3. Properties Panel */}
                    <div className="p-4">
                        {selectedElement ? (
                            <div className="space-y-4 animate-in slide-in-from-right-2">
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <span className="font-bold text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        {selectedElement.type === 'text' ? 'خصائص النص' : 'خصائص QR'}
                                    </span>
                                    <Button variant="ghost" size="sm" onClick={() => deleteElement(selectedElement.id)} className="text-red-500 hover:bg-red-50 p-1 h-auto">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Common: Postion */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-1 text-xs font-medium text-gray-500"><Move className="w-3 h-3" /> الموضع (X, Y)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <input type="number" className="w-full pl-8 pr-2 py-1 border rounded text-sm text-center" value={selectedElement.x} onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })} />
                                            <span className="absolute left-2 top-1.5 text-xs text-gray-400">X%</span>
                                        </div>
                                        <div className="relative">
                                            <input type="number" className="w-full pl-8 pr-2 py-1 border rounded text-sm text-center" value={selectedElement.y} onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })} />
                                            <span className="absolute left-2 top-1.5 text-xs text-gray-400">Y%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Text Specific */}
                                {selectedElement.type === 'text' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-gray-500">المحتوى</label>
                                            <input className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200" value={selectedElement.content || ''} onChange={(e) => updateElement(selectedElement.id, { content: e.target.value })} placeholder="أدخل النص هنا..." />

                                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto mb-2 p-1 border rounded bg-gray-50">
                                                {availableFields?.map(field => (
                                                    <button key={field} onClick={() => {
                                                        const current = selectedElement.content || '';
                                                        updateElement(selectedElement.id, { content: current + ` {${field}}` })
                                                    }}
                                                        className="text-[10px] bg-white border hover:bg-lony-gold hover:text-white px-2 py-1 rounded shadow-sm transition-colors">
                                                        +{field}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="flex items-center gap-1 text-xs font-medium text-gray-500"><TypeIcon className="w-3 h-3" /> الخط</label>
                                            <select className="w-full p-2 border rounded text-sm font-sans" value={selectedElement.fontFamily} onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}>
                                                {FONTS.map(f => <option key={f.name} value={f.name}>{f.label}</option>)}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <label className="text-xs font-medium text-gray-500">نص ثابت قبل القيمة (Prefix)</label>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded text-sm text-right"
                                                placeholder="مثال: الضيف الكريم"
                                                value={selectedElement.prefix || ''}
                                                onChange={(e) => updateElement(selectedElement.id, { prefix: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium text-gray-500">الحجم (px)</label>
                                                <input type="number" className="w-full p-2 border rounded text-sm" value={selectedElement.fontSize} onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500">اللون</label>
                                                <div className="flex items-center border rounded p-1">
                                                    <input type="color" className="w-6 h-6 border-none" value={selectedElement.color} onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })} />
                                                    <span className="text-xs ml-2 text-gray-500">{selectedElement.color}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex bg-gray-100 rounded p-1 gap-1 justify-center">
                                            <button className={`p-1 rounded ${selectedElement.fontWeight === 'bold' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => updateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}>
                                                <Bold className="w-4 h-4" />
                                            </button>
                                            <div className="w-px bg-gray-300 mx-1"></div>
                                            <button className={`p-1 rounded ${selectedElement.textAlign === 'right' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => updateElement(selectedElement.id, { textAlign: 'right' })}>
                                                <AlignRight className="w-4 h-4" />
                                            </button>
                                            <button className={`p-1 rounded ${selectedElement.textAlign === 'center' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => updateElement(selectedElement.id, { textAlign: 'center' })}>
                                                <AlignCenter className="w-4 h-4" />
                                            </button>
                                            <button className={`p-1 rounded ${selectedElement.textAlign === 'left' ? 'bg-white shadow' : 'text-gray-500'}`} onClick={() => updateElement(selectedElement.id, { textAlign: 'left' })}>
                                                <AlignLeft className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                className="flex items-center gap-2 text-xs bg-gray-100 hover:bg-gray-200 p-2 rounded w-full justify-center"
                                                onClick={async () => {
                                                    if (!window.EyeDropper) {
                                                        alert('متصفحك لا يدعم هذه الخاصية');
                                                        return;
                                                    }
                                                    try {
                                                        const eyeDropper = new window.EyeDropper();
                                                        const result = await eyeDropper.open();
                                                        updateElement(selectedElement.id, { color: result.sRGBHex });
                                                    } catch (e) {
                                                        console.log('User canceled color selection');
                                                    }
                                                }}
                                            >
                                                <Pipette className="w-4 h-4" />
                                                <span>استخدام القطارة (Pick Color)</span>
                                            </button>
                                        </div>

                                        <div className="space-y-4 pt-2 border-t">
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-xs font-medium text-gray-500">الشفافية</label>
                                                    <span className="text-xs font-bold">{selectedElement.opacity ?? 100}%</span>
                                                </div>
                                                <input type="range" min="0" max="100" className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" value={selectedElement.opacity ?? 100} onChange={(e) => updateElement(selectedElement.id, { opacity: Number(e.target.value) })} />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-500">ظل النص</label>
                                                <div className="flex gap-2 bg-gray-50 p-2 rounded border">
                                                    <button className={`flex-1 text-[10px] p-1 rounded ${!selectedElement.textShadow ? 'bg-white shadow border' : 'bg-transparent'}`} onClick={() => updateElement(selectedElement.id, { textShadow: undefined })}>لا يوجد</button>
                                                    <button className={`flex-1 text-[10px] p-1 rounded ${selectedElement.textShadow === '2px 2px 4px rgba(0,0,0,0.5)' ? 'bg-white shadow border' : 'bg-transparent'}`} onClick={() => updateElement(selectedElement.id, { textShadow: '2px 2px 4px rgba(0,0,0,0.5)' })}>ناعم</button>
                                                    <button className={`flex-1 text-[10px] p-1 rounded ${selectedElement.textShadow === '3px 3px 0px rgba(0,0,0,0.3)' ? 'bg-white shadow border' : 'bg-transparent'}`} onClick={() => updateElement(selectedElement.id, { textShadow: '3px 3px 0px rgba(0,0,0,0.3)' })}>حاد</button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-xs font-medium text-gray-500">حدود النص (Outline)</label>
                                                    <input type="checkbox" checked={!!selectedElement.textOutline} onChange={(e) => updateElement(selectedElement.id, { textOutline: e.target.checked ? { width: 2, color: '#ffffff' } : undefined })} />
                                                </div>
                                                {selectedElement.textOutline && (
                                                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border">
                                                        <div>
                                                            <label className="text-[10px] text-gray-400 block mb-1">السمك</label>
                                                            <input type="number" min="0" max="10" className="w-full text-xs p-1 border rounded" value={selectedElement.textOutline.width} onChange={(e) => updateElement(selectedElement.id, { textOutline: { ...selectedElement.textOutline!, width: Number(e.target.value) } })} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-400 block mb-1">اللون</label>
                                                            <input type="color" className="w-full h-6 border rounded" value={selectedElement.textOutline.color} onChange={(e) => updateElement(selectedElement.id, { textOutline: { ...selectedElement.textOutline!, color: e.target.value } })} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* QR Specific */}
                                {selectedElement.type === 'qr' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-1 text-xs font-medium text-gray-500"><Maximize2 className="w-3 h-3" /> الحجم (px)</label>
                                            <input type="range" min="50" max="600" className="w-full" value={selectedElement.width || selectedElement.fontSize}
                                                onChange={(e) => {
                                                    const s = Number(e.target.value);
                                                    updateElement(selectedElement.id, { width: s, height: s, fontSize: s });
                                                }} />
                                            <div className="text-right text-xs font-bold">{selectedElement.width || selectedElement.fontSize}px</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium text-gray-500">لون QR</label>
                                                <input type="color" className="w-full h-8 border rounded" value={selectedElement.qrColor || '#000000'} onChange={(e) => updateElement(selectedElement.id, { qrColor: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500">لون العيون (الأركان)</label>
                                                <input type="color" className="w-full h-8 border rounded" value={selectedElement.qrEyeColor || selectedElement.qrColor || '#000000'} onChange={(e) => updateElement(selectedElement.id, { qrEyeColor: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-500">الخلفية</label>
                                                <input type="color" className="w-full h-8 border rounded" value={selectedElement.qrBgColor === 'transparent' ? '#ffffff' : selectedElement.qrBgColor}
                                                    onChange={(e) => updateElement(selectedElement.id, { qrBgColor: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={selectedElement.qrBgColor === 'transparent'}
                                                onChange={(e) => updateElement(selectedElement.id, { qrBgColor: e.target.checked ? 'transparent' : '#ffffff' })} />
                                            <span className="text-xs">خلفية شفافة</span>
                                        </div>

                                        <div className="space-y-4 pt-2 border-t">
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <label className="text-xs font-medium text-gray-500">الشفافية</label>
                                                    <span className="text-xs font-bold">{selectedElement.qrOpacity ?? 100}%</span>
                                                </div>
                                                <input type="range" min="0" max="100" className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" value={selectedElement.qrOpacity ?? 100} onChange={(e) => updateElement(selectedElement.id, { qrOpacity: Number(e.target.value) })} />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-gray-500">نط نمط النقاط</label>
                                                <div className="grid grid-cols-2 gap-1 bg-gray-50 p-1 rounded border">
                                                    {[
                                                        { id: 'square', label: 'مربع' },
                                                        { id: 'rounded', label: 'دائري' },
                                                        { id: 'dots', label: 'نقاط' },
                                                        { id: 'fluid', label: 'سائل' }
                                                    ].map(shape => (
                                                        <button
                                                            key={shape.id}
                                                            className={`text-[10px] p-1.5 rounded ${selectedElement.qrDotShape === shape.id || (!selectedElement.qrDotShape && shape.id === 'square') ? 'bg-white shadow border border-blue-200 text-blue-700' : 'bg-transparent text-gray-500'}`}
                                                            onClick={() => updateElement(selectedElement.id, { qrDotShape: shape.id as any })}
                                                        >
                                                            {shape.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <Palette className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">حدد عنصراً لتعديله</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer / Save */}
                <div className="p-4 border-t bg-gray-50">
                    <Button className="w-full bg-lony-gold text-lony-navy font-bold hover:bg-yellow-500 shadow-lg" onClick={handleSave} disabled={saving}>
                        {saving ? 'جاري الحفظ...' : 'حفظ وإغلاق'}
                    </Button>
                </div>
            </div>

            {/* Editing Area */}
            <div className="flex-1 bg-gray-800 p-8 flex items-center justify-center overflow-auto relative">
                {/* Canvas Container */}
                <div
                    ref={containerRef}
                    className="relative bg-white shadow-2xl transition-all duration-300"
                    style={{
                        width: `${displayWidth}px`,
                        height: `${displayHeight}px`,
                        backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                    onClick={() => setSelectedElementId(null)}
                >
                    {/* Grid Overlay */}
                    {snapToGrid && (
                        <div className="absolute inset-0 pointer-events-none opacity-50" style={{
                            backgroundImage: `
                                repeating-linear-gradient(0deg, transparent, transparent ${displayHeight * GRID_SIZE / 100 - 1}px, rgba(0,0,0,0.1) ${displayHeight * GRID_SIZE / 100 - 1}px, rgba(0,0,0,0.1) ${displayHeight * GRID_SIZE / 100}px),
                                repeating-linear-gradient(90deg, transparent, transparent ${displayWidth * GRID_SIZE / 100 - 1}px, rgba(0,0,0,0.1) ${displayWidth * GRID_SIZE / 100 - 1}px, rgba(0,0,0,0.1) ${displayWidth * GRID_SIZE / 100}px)
                            `
                        }} />
                    )}

                    {/* Elements */}
                    {elements.map((el) => (
                        <div
                            key={el.id}
                            className={`absolute flex items-center justify-center group select-none ${selectedElementId === el.id ? 'z-20' : 'z-10'}`}
                            style={{
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                transform: 'translate(-50%, -50%)', // Centering anchor
                                width: el.type === 'qr' ? `${(el.width || el.fontSize) * scale}px` : 'auto',
                                height: el.type === 'qr' ? `${(el.height || el.fontSize) * scale}px` : 'auto',
                            }}
                            onMouseDown={(e) => handleMouseDown(e, el.id)}
                        >
                            {/* Inner Content with Styling */}
                            <div className={`${selectedElementId === el.id ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-1 hover:ring-blue-300'}`}
                                style={{
                                    fontSize: el.type === 'text' ? `${el.fontSize * scale}px` : undefined,
                                    color: el.color,
                                    fontFamily: el.fontFamily,
                                    fontWeight: el.fontWeight || 'normal',
                                    whiteSpace: 'nowrap',
                                    textShadow: el.textShadow || 'none',
                                    opacity: (el.opacity ?? 100) / 100,
                                    cursor: 'move',
                                    WebkitTextStroke: el.textOutline ? `${el.textOutline.width}px ${el.textOutline.color}` : '0px',
                                }}
                            >
                                {el.type === 'text' ? (
                                    <span>{el.prefix ? `${el.prefix} ` : ''}{el.content || el.label}</span>
                                ) : (
                                    <CustomQR
                                        value={el.content || 'http://example.com'}
                                        size={(el.width || el.fontSize) * scale}
                                        color={el.qrColor || '#000000'}
                                        bgColor={el.qrBgColor || 'transparent'}
                                        padding={0}
                                        opacity={el.qrOpacity || 100}
                                        dotShape={el.qrDotShape || 'square'}
                                        eyeColor={el.qrEyeColor}
                                        eyeShape={el.qrEyeShape}
                                    />
                                )}
                            </div>

                            {/* Resize Handle only for QR currently */}
                            {selectedElementId === el.id && el.type === 'qr' && (
                                <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize shadow border-2 border-white"
                                    onMouseDown={(e) => handleMouseDown(e, el.id, 'se')} />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CanvasEditor;
