import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Order, Guest, CardTemplate } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ArrowRight, CheckCircle, Image as ImageIcon, Loader2, Play } from 'lucide-react';
import html2canvas from 'html2canvas';
import QRCodeLib from 'qrcode';

const OrderDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [order, setOrder] = useState<any>(null);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [templates, setTemplates] = useState<CardTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Hidden ref for generation
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // 1. Fetch Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select(`*, clients (*), events (*)`)
                .eq('id', id)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            // 2. Fetch Guests
            if (orderData.event_id) {
                const { data: guestsData, error: guestsError } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('event_id', orderData.event_id);

                if (guestsError) throw guestsError;
                setGuests(guestsData || []);
            }

            // 3. Fetch Templates
            const { data: templatesData, error: templatesError } = await supabase
                .from('card_templates')
                .select('*')
                .eq('is_active', true);

            if (templatesError) throw templatesError;
            setTemplates(templatesData || []);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateCardForGuest = async (guest: Guest, template: CardTemplate) => {
        if (!cardRef.current) return null;

        // 1. Render content (React state update is async, so we might need a different approach for batching)
        // For simplicity in this version, we will assume the cardRef is capable of rendering dynamic content via props or context if we were using a component.
        // However, since we are inside a loop, we can't easily wait for React render cycles.
        // STRATEGY: We will manually manipulate the DOM of the hidden ref for speed and reliability in the loop.

        const container = cardRef.current;

        // Clear previous
        container.innerHTML = '';

        // Set Background
        container.style.width = '1080px'; // High res width
        container.style.height = '1920px'; // High res height
        container.style.backgroundImage = `url(${template.background_url})`;
        container.style.backgroundSize = 'cover';
        container.style.position = 'relative';

        // Add Elements
        if (template.canvas_data) {
            for (const el of template.canvas_data as any[]) {
                const div = document.createElement('div');
                div.style.position = 'absolute';
                div.style.left = `${el.x}%`;
                div.style.top = `${el.y}%`;
                div.style.transform = 'translate(-50%, -50%)';
                div.style.fontSize = `${el.fontSize * 3}px`; // Scale up for high res
                div.style.color = el.color;
                div.style.fontFamily = el.fontFamily;
                div.style.whiteSpace = 'nowrap';

                if (el.type === 'text') {
                    if (el.label === 'اسم الضيف') div.innerText = guest.name;
                    else if (el.label === 'رقم الطاولة') div.innerText = guest.custom_fields?.table || '';
                    else if (el.label === 'عدد المرافقين') div.innerText = `+${guest.companions_count}`;
                    else if (el.label === 'الفئة') div.innerText = guest.category || '';
                    else div.innerText = el.content || '';
                } else if (el.type === 'qr') {
                    // Custom QR Rendering Logic to match Editor
                    const size = el.fontSize * 3; // Scale up for high res
                    const padding = (el.qrPadding || 0) * 3; // Scale padding
                    const opacity = (el.qrOpacity || 100) / 100;
                    const dotShape = el.qrDotShape || 'square';
                    const color = el.qrColor || '#000000';
                    const bgColor = el.qrBgColor || '#ffffff';
                    const value = `https://lony-invites.com/v/${guest.qr_token}`;

                    // Create off-screen canvas for QR
                    const qrCanvas = document.createElement('canvas');
                    qrCanvas.width = size;
                    qrCanvas.height = size;
                    const ctx = qrCanvas.getContext('2d');

                    if (ctx) {
                        // Generate QR Data
                        // We need to await this, but we are in a loop. Ideally we should use Promise.all or await inside loop.
                        // Since generateCardForGuest is async, we can await here.
                        const qrData = await QRCodeLib.create(value, { errorCorrectionLevel: 'M' });
                        const modules = qrData.modules;
                        const moduleCount = modules.size;
                        const moduleSize = (size - (padding * 2)) / moduleCount;

                        // Clear and set background
                        ctx.clearRect(0, 0, size, size);
                        if (bgColor !== 'transparent') {
                            ctx.fillStyle = bgColor;
                            ctx.fillRect(0, 0, size, size);
                        }

                        // Draw Modules
                        ctx.fillStyle = color;
                        ctx.globalAlpha = opacity;

                        modules.data.forEach((isDark, index) => {
                            if (isDark) {
                                const row = Math.floor(index / moduleCount);
                                const col = index % moduleCount;
                                const x = padding + col * moduleSize;
                                const y = padding + row * moduleSize;

                                if (dotShape === 'rounded') {
                                    ctx.beginPath();
                                    ctx.arc(x + moduleSize / 2, y + moduleSize / 2, moduleSize / 2, 0, Math.PI * 2);
                                    ctx.fill();
                                } else {
                                    ctx.fillRect(x, y, moduleSize + 0.5, moduleSize + 0.5);
                                }
                            }
                        });

                        ctx.globalAlpha = 1.0;

                        // Convert to Image
                        const img = document.createElement('img');
                        img.src = qrCanvas.toDataURL();
                        img.style.width = `${size}px`;
                        img.style.height = `${size}px`;
                        div.appendChild(img);
                    }
                }

                container.appendChild(div);
            }
        }

        // Wait for images to load (simple timeout for MVP)
        await new Promise(r => setTimeout(r, 500));

        // 2. Capture
        const canvas = await html2canvas(container, {
            useCORS: true,
            scale: 1, // Already scaled via CSS
        });

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (!blob) throw new Error('Failed to generate blob');

        // 3. Upload
        const fileName = `${order.id}/${guest.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
            .from('generated_cards')
            .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('generated_cards')
            .getPublicUrl(fileName);

        // 4. Update Guest
        await supabase
            .from('guests')
            .update({ card_url: publicUrl })
            .eq('id', guest.id);
    };

    const handleGenerateAll = async () => {
        if (!selectedTemplate) return;
        setGenerating(true);
        setProgress({ current: 0, total: guests.length });

        try {
            for (let i = 0; i < guests.length; i++) {
                await generateCardForGuest(guests[i], selectedTemplate);
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }
            alert('تم إنشاء جميع البطاقات بنجاح!');
            fetchData(); // Refresh to see new URLs
        } catch (error) {
            console.error('Generation failed:', error);
            alert('حدث خطأ أثناء الإنشاء');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
    if (!order) return <div className="p-8 text-center">الطلب غير موجود</div>;

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                    <ArrowRight className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-lony-navy">تفاصيل الطلب #{order.id.slice(0, 8)}</h1>
                    <p className="text-gray-500">{order.clients?.name} - {order.events?.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Order Info */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>معلومات الطلب</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-500">الحالة</label>
                                <div className="font-bold">{order.status}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">مرحلة العمل</label>
                                <div className="font-bold">{order.workflow_stage}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">عدد الضيوف</label>
                                <div className="font-bold">{guests.length}</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-500">التاريخ</label>
                                <div className="font-bold">{new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>إجراءات</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">اختر القالب</label>
                            <div className="grid grid-cols-2 gap-2">
                                {templates.map(t => (
                                    <div
                                        key={t.id}
                                        className={`border rounded-lg p-1 cursor-pointer transition-all ${selectedTemplate?.id === t.id ? 'ring-2 ring-lony-gold border-transparent' : 'hover:border-gray-400'}`}
                                        onClick={() => setSelectedTemplate(t)}
                                    >
                                        <div className="aspect-[9/16] bg-gray-100 rounded overflow-hidden relative">
                                            {t.background_url ? (
                                                <img src={t.background_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400" />
                                            )}
                                        </div>
                                        <p className="text-xs text-center mt-1 truncate">{t.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button
                            className="w-full bg-lony-gold text-white hover:bg-lony-gold/90"
                            disabled={!selectedTemplate || generating || guests.length === 0}
                            onClick={handleGenerateAll}
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                    جاري الإنشاء ({progress.current}/{progress.total})
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 ml-2" />
                                    إنشاء البطاقات
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Guest List Preview */}
            <Card>
                <CardHeader>
                    <CardTitle>قائمة الضيوف والبطاقات</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-sm text-gray-600">
                                <tr>
                                    <th className="p-3">الاسم</th>
                                    <th className="p-3">الجوال</th>
                                    <th className="p-3">البطاقة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {guests.map(guest => (
                                    <tr key={guest.id}>
                                        <td className="p-3 font-bold">{guest.name}</td>
                                        <td className="p-3 text-gray-500">{guest.phone}</td>
                                        <td className="p-3">
                                            {guest.card_url ? (
                                                <a href={guest.card_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" />
                                                    عرض البطاقة
                                                </a>
                                            ) : (
                                                <span className="text-gray-400 text-sm">لم يتم الإنشاء</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Hidden Generation Container */}
            <div
                style={{
                    position: 'fixed',
                    top: '-10000px',
                    left: '-10000px',
                    width: '1080px',
                    height: '1920px',
                    overflow: 'hidden'
                }}
            >
                <div ref={cardRef}></div>
            </div>
        </div>
    );
};

export default OrderDetails;
