import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Copy, QrCode, ExternalLink, Lock, Eye, Users,
    BarChart3, Calendar, MapPin, Clock, CheckCircle
} from 'lucide-react';
import { hasFeature, EventFeatures } from '../lib/features';
import QRCodeStyling from 'qr-code-styling';

interface Event {
    id: string;
    name: string;
    token: string;
    date: string;
    venue: string;
    host_pin?: string;
    features: Partial<EventFeatures>;
}

const EventSummary: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);
    const [guestsCount, setGuestsCount] = useState(0);
    const [demoGuests, setDemoGuests] = useState<any[]>([]);
    const [currentDemoIndex, setCurrentDemoIndex] = useState(0);

    useEffect(() => {
        loadEvent();
    }, [eventId]);

    const loadEvent = async () => {
        try {
            const { data: eventData, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (error) throw error;
            setEvent(eventData);

            // Get guests count
            const { count } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);

            setGuestsCount(count || 0);

            // Get demo guests
            const { data: demos } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', eventId)
                .eq('is_demo', true)
                .order('demo_state');

            setDemoGuests(demos || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const downloadQR = (url: string, filename: string) => {
        const qrCode = new QRCodeStyling({
            width: 512,
            height: 512,
            data: url,
            dotsOptions: {
                color: '#1a365d',
                type: 'rounded'
            },
            backgroundOptions: {
                color: '#ffffff',
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 10
            }
        });

        qrCode.download({ name: filename, extension: 'png' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lony-navy mx-auto mb-4"></div>
                    <p className="text-gray-600">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card>
                    <CardContent className="p-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">الحدث غير موجود</h2>
                        <Button onClick={() => navigate('/dashboard')}>العودة للرئيسية</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const baseUrl = 'https://lonyinvit.netlify.app';
    const inspectorUrl = `${baseUrl}/scanner/${event.token}`;
    const clientDashboardUrl = `${baseUrl}/client-dashboard/${event.id}`;
    const analyticsUrl = `${baseUrl}/analytics`;

    return (
        <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-lony-navy to-blue-900 text-white rounded-xl p-8 shadow-xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
                            <div className="flex items-center gap-4 text-blue-200">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>{new Date(event.date).toLocaleDateString('ar-SA')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    <span>{event.venue}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="bg-lony-gold text-lony-navy px-4 py-2 rounded-lg font-bold text-lg">
                                {event.token}
                            </div>
                            <p className="text-xs text-blue-200 mt-1">رمز الحدث</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/10 rounded-lg p-4 text-center">
                            <Users className="w-6 h-6 mx-auto mb-2" />
                            <div className="text-2xl font-bold">{guestsCount}</div>
                            <div className="text-sm text-blue-200">ضيف</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 text-center">
                            <CheckCircle className="w-6 h-6 mx-auto mb-2" />
                            <div className="text-2xl font-bold">
                                {Object.values(event.features).filter(Boolean).length}
                            </div>
                            <div className="text-sm text-blue-200">ميزة مفعلة</div>
                        </div>
                        <div className="bg-white/10 rounded-lg p-4 text-center">
                            <Clock className="w-6 h-6 mx-auto mb-2" />
                            <div className="text-sm font-bold">
                                {new Date(event.date) > new Date() ? 'قادم' : 'منتهي'}
                            </div>
                            <div className="text-sm text-blue-200">الحالة</div>
                        </div>
                    </div>
                </div>

                {/* Inspector Link - الأهم */}
                {hasFeature(event, 'require_inspector_app') && (
                    <Card className="border-2 border-lony-gold shadow-xl">
                        <CardHeader className="bg-gradient-to-r from-lony-gold/10 to-yellow-50">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Lock className="w-6 h-6 text-lony-gold" />
                                رابط المشرفين (خاص)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {/* Host PIN if enabled */}
                            {hasFeature(event, 'enable_host_pin') && event.host_pin && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Lock className="w-5 h-5 text-red-600" />
                                        <h4 className="font-bold text-red-900">الرقم السري للمشرفين</h4>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <code className="text-3xl font-bold text-red-600 tracking-widest">
                                            {event.host_pin}
                                        </code>
                                    </div>
                                    <p className="text-sm text-red-700 mt-2">
                                        ⚠️ لا تشارك هذا الرقم مع الضيوف - خاص بالمشرفين فقط
                                    </p>
                                </div>
                            )}

                            {/* Inspector URL */}
                            <div>
                                <label className="text-sm font-bold text-gray-700 mb-2 block">
                                    الرابط الكامل:
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inspectorUrl}
                                        readOnly
                                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm"
                                    />
                                    <Button
                                        onClick={() => copyToClipboard(inspectorUrl, 'inspector')}
                                        className="bg-lony-navy"
                                    >
                                        {copied === 'inspector' ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>

                            {/* QR Code */}
                            <div className="flex gap-4">
                                <Button
                                    onClick={() => downloadQR(inspectorUrl, `inspector-${event.token}`)}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <QrCode className="w-5 h-5 ml-2" />
                                    تحميل QR للمشرفين
                                </Button>
                                <Button
                                    onClick={() => window.open(inspectorUrl, '_blank')}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <ExternalLink className="w-5 h-5 ml-2" />
                                    فتح الرابط
                                </Button>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4">
                                <h4 className="font-bold text-blue-900 mb-2">📱 استخدام المشرف:</h4>
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>✅ مسح QR codes وتسجيل الحضور</li>
                                    <li>✅ بحث يدوي عن الضيوف</li>
                                    <li>✅ معالجة الحالات الطارئة</li>
                                    {hasFeature(event, 'offline_mode') && (
                                        <li>✅ يعمل بدون إنترنت</li>
                                    )}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Client Dashboard */}
                {hasFeature(event, 'client_dashboard') && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-blue-600" />
                                لوحة العميل المباشرة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={clientDashboardUrl}
                                    readOnly
                                    className="flex-1 px-4 py-2 bg-gray-50 border rounded-lg font-mono text-sm"
                                />
                                <Button
                                    onClick={() => copyToClipboard(clientDashboardUrl, 'client')}
                                    size="sm"
                                >
                                    {copied === 'client' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-sm text-gray-600">
                                💡 شارك هذا الرابط مع العميل لمتابعة الحضور مباشرة
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Guest Preview Notice */}
                {hasFeature(event, 'enable_simple_scan') ? (
                    <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-3">
                                <Eye className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-green-900 mb-2">
                                        معاينة الضيوف مفعلة
                                    </h4>
                                    <p className="text-sm text-green-800">
                                        الضيوف يقدرون يشوفون بطاقاتهم عن طريق مسح QR code بكاميرتهم.
                                        <br />
                                        <span className="font-bold">ملاحظة:</span> المعاينة فقط - لا يتم تسجيل الحضور.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-orange-200 bg-orange-50">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-3">
                                <Lock className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-bold text-orange-900 mb-2">
                                        معاينة الضيوف معطلة
                                    </h4>
                                    <p className="text-sm text-orange-800">
                                        الضيوف لا يقدرون يفتحون البطاقات بأنفسهم.
                                        <br />
                                        <span className="font-bold">يجب</span> على الضيف إظهار QR code للمشرف عند الدخول.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Demo Cards Carousel - عينات تلقائية */}
                {demoGuests.length > 0 && (
                    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <QrCode className="w-6 h-6" />
                                عينات البطاقات للعميل
                            </CardTitle>
                            <p className="text-sm text-indigo-100 mt-2">
                                3 عينات تلقائية توضح شكل البطاقات في جميع المراحل
                            </p>
                        </CardHeader>
                        <CardContent className="p-6">
                            {/* Carousel */}
                            <div className="relative">
                                {/* Current Card Display */}
                                <div className="bg-white rounded-xl p-6 shadow-lg min-h-[300px] flex flex-col items-center justify-center">
                                    {demoGuests[currentDemoIndex] ? (
                                        <div className="text-center space-y-4">
                                            {/* Demo State Badge */}
                                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-full font-bold text-lg">
                                                {currentDemoIndex === 0 && '1️⃣ قبل المناسبة'}
                                                {currentDemoIndex === 1 && '2️⃣ أثناء المناسبة'}
                                                {currentDemoIndex === 2 && '3️⃣ بعد المناسبة'}
                                            </div>

                                            {/* Card Preview Placeholder */}
                                            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl p-8 w-full max-w-md mx-auto border-4 border-dashed border-gray-300">
                                                <div className="aspect-[3/4] flex items-center justify-center">
                                                    <div className="text-center space-y-3">
                                                        <div className="text-6xl mb-4">
                                                            {currentDemoIndex === 0 && '📅'}
                                                            {currentDemoIndex === 1 && '🎉'}
                                                            {currentDemoIndex === 2 && '✅'}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-gray-800">
                                                            {demoGuests[currentDemoIndex].name}
                                                        </h3>
                                                        <p className="text-sm text-gray-600">
                                                            الطاولة: {demoGuests[currentDemoIndex].table_no}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            مرافقين: {demoGuests[currentDemoIndex].companions_count}
                                                        </p>
                                                        <div className="mt-4 pt-4 border-t border-gray-300">
                                                            <p className="text-xs text-gray-500">
                                                                💡 البطاقة الفعلية ستحتوي على التصميم الخاص بك
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scenario Description */}
                                            <div className="bg-blue-50 rounded-lg p-4 text-right">
                                                <h4 className="font-bold text-blue-900 mb-2">
                                                    {currentDemoIndex === 0 && '📖 السيناريو:'}
                                                    {currentDemoIndex === 1 && '📖 السيناريو:'}
                                                    {currentDemoIndex === 2 && '📖 السيناريو:'}
                                                </h4>
                                                <p className="text-sm text-blue-800">
                                                    {currentDemoIndex === 0 && hasFeature(event, 'enable_simple_scan') &&
                                                        'الضيف يقدر يمسح QR ويشوف بطاقته ومعلومات المناسبة (معاينة فقط - لا تسجيل)'}
                                                    {currentDemoIndex === 0 && !hasFeature(event, 'enable_simple_scan') &&
                                                        'الضيف لا يقدر يفتح البطاقة - يظهر له رسالة "انتظر يوم المناسبة"'}
                                                    {currentDemoIndex === 1 && hasFeature(event, 'require_inspector_app') &&
                                                        'المشرف يمسح QR ويسجل الحضور رسمياً - الضيف إذا فتحها يشوف معاينة فقط'}
                                                    {currentDemoIndex === 1 && !hasFeature(event, 'require_inspector_app') &&
                                                        'الضيف يقدر يسجل حضوره بنفسه عن طريق مسح QR'}
                                                    {currentDemoIndex === 2 && hasFeature(event, 'client_dashboard') &&
                                                        'العميل يشوف إحصائيات كاملة + الضيف يقدر يشوف بطاقته كذكرى'}
                                                    {currentDemoIndex === 2 && !hasFeature(event, 'client_dashboard') &&
                                                        'العميل يستلم تقرير نهائي بالإيميل - الضيف يحتفظ بالبطاقة كذكرى'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500">
                                            <p>لا توجد عينات متاحة</p>
                                        </div>
                                    )}
                                </div>

                                {/* Carousel Navigation */}
                                <div className="flex items-center justify-center gap-4 mt-6">
                                    <Button
                                        onClick={() => setCurrentDemoIndex(Math.max(0, currentDemoIndex - 1))}
                                        disabled={currentDemoIndex === 0}
                                        variant="outline"
                                        className="px-6"
                                    >
                                        السابق
                                    </Button>

                                    {/* Dots Navigation */}
                                    <div className="flex gap-2">
                                        {demoGuests.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentDemoIndex(index)}
                                                className={`w-3 h-3 rounded-full transition-all ${index === currentDemoIndex
                                                    ? 'bg-indigo-600 w-8'
                                                    : 'bg-gray-300 hover:bg-gray-400'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    <Button
                                        onClick={() => setCurrentDemoIndex(Math.min(demoGuests.length - 1, currentDemoIndex + 1))}
                                        disabled={currentDemoIndex === demoGuests.length - 1}
                                        variant="outline"
                                        className="px-6"
                                    >
                                        التالي
                                    </Button>
                                </div>

                                {/* Info */}
                                <div className="mt-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                    <p className="text-sm text-yellow-800 text-center">
                                        💡 <strong>ملاحظة:</strong> هذه عينات تلقائية للعرض على العميل - لا تؤثر على الدعوات الحقيقية
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Client Preview Samples - نصوص توضيحية */}
                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
                    <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Eye className="w-6 h-6" />
                            عينات للعميل - جميع الحالات
                        </CardTitle>
                        <p className="text-sm text-purple-100 mt-2">
                            استخدم هذه العينات لإطمئنان العميل على شكل النظام في جميع المراحل
                        </p>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {/* Before Event */}
                        <div className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                    1
                                </div>
                                <h3 className="text-lg font-bold text-blue-900">قبل المناسبة</h3>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">للضيف:</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'enable_simple_scan')
                                                ? '✅ يقدر يمسح QR ويشوف بطاقته ومعلومات المناسبة (معاينة فقط)'
                                                : '🔒 لا يقدر يفتح البطاقة - يظهر رسالة "انتظر المناسبة"'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">للمشرف:</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'qr_time_restricted')
                                                ? '⏰ لا يقدر يسجل دخول قبل الوقت المحدد'
                                                : '✅ يقدر يسجل دخول في أي وقت'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* During Event */}
                        <div className="bg-white rounded-xl p-5 border-2 border-green-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                    2
                                </div>
                                <h3 className="text-lg font-bold text-green-900">أثناء المناسبة</h3>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <QrCode className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">سيناريو 1: الضيف يمسح بكاميرته</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'enable_simple_scan')
                                                ? '👁️ يشوف بطاقته فقط (معاينة) - لا يتم تسجيل حضور'
                                                : '🚫 يظهر له: "يرجى إظهار البطاقة للمشرف"'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Users className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">سيناريو 2: المشرف يمسح</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'require_inspector_app')
                                                ? '✅ يسجل الحضور رسمياً + يشوف معلومات الضيف كاملة'
                                                : '⚠️ غير متاح (الميزة معطلة)'
                                            }
                                        </p>
                                    </div>
                                </div>
                                {hasFeature(event, 'enable_host_pin') && (
                                    <div className="flex items-start gap-2">
                                        <Lock className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-gray-800">الحماية:</p>
                                            <p className="text-gray-600">
                                                🔐 المشرف يحتاج الرقم السري (<code className="bg-gray-100 px-1 rounded">{event.host_pin}</code>) للدخول
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* After Event */}
                        <div className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-gray-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                    3
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">بعد المناسبة</h3>
                            </div>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-2">
                                    <BarChart3 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">للعميل:</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'client_dashboard')
                                                ? '📊 يشوف إحصائيات كاملة: عدد الحضور، المتأخرين، إلخ'
                                                : '📧 يستلم تقرير نهائي بالإيميل'
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Eye className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-gray-800">للضيف:</p>
                                        <p className="text-gray-600">
                                            {hasFeature(event, 'enable_simple_scan')
                                                ? '✅ يقدر يشوف بطاقته كذكرى'
                                                : '🔒 لا يقدر يفتح البطاقة'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary for Client */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl p-5">
                            <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                <CheckCircle className="w-6 h-6" />
                                ملخص للعميل
                            </h4>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-start gap-2">
                                    <span>✅</span>
                                    <span>نظام متكامل لإدارة الضيوف من البداية للنهاية</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>🔒</span>
                                    <span>
                                        {hasFeature(event, 'require_inspector_app')
                                            ? 'تحكم كامل - المشرفين فقط يسجلون الحضور'
                                            : 'مرونة - الضيوف يقدرون يسجلون بأنفسهم'
                                        }
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>📊</span>
                                    <span>
                                        {hasFeature(event, 'live_analytics')
                                            ? 'متابعة مباشرة - شوف الحضور لحظة بلحظة'
                                            : 'تقارير كاملة بعد المناسبة'
                                        }
                                    </span>
                                </li>
                                {hasFeature(event, 'offline_mode') && (
                                    <li className="flex items-start gap-2">
                                        <span>📱</span>
                                        <span>يشتغل بدون إنترنت - ضمان 100%</span>
                                    </li>
                                )}
                            </ul>
                        </div>

                        {/* Download Preview PDF Button */}
                        <Button
                            onClick={() => {
                                // TODO: Generate PDF with all scenarios
                                alert('سيتم إنشاء ملف PDF بجميع السيناريوهات قريباً');
                            }}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        >
                            📄 تحميل عينات PDF للعميل
                        </Button>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <Button
                        onClick={() => navigate(`/studio?event=${event.id}`)}
                        className="py-6 bg-lony-navy"
                    >
                        🎨 فتح الاستوديو
                    </Button>
                    <Button
                        onClick={() => navigate(`/upload-guests?event=${event.id}`)}
                        variant="outline"
                        className="py-6"
                    >
                        📤 إضافة ضيوف
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EventSummary;
