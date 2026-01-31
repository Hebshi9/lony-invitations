import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, RefreshCw, Activity, AlertCircle, Clock, Lock } from 'lucide-react';
import { hasFeature, EventFeatures } from '../lib/features';

interface Event {
    id: string;
    token: string;
    name: string;
    date: string;
    activation_time?: string;
    features: Partial<EventFeatures>;
}

const EventScanner: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [processing, setProcessing] = useState(false);

    const [scanResult, setScanResult] = useState<{
        status: 'success' | 'error';
        title: string;
        message: string;
        guestName?: string;
        tableNo?: string;
        companions?: number;
        scanCount?: number;
    } | null>(null);

    // Load Event Data
    useEffect(() => {
        loadEvent();
    }, [token]);

    const loadEvent = async () => {
        if (!token) {
            setError('رمز الحدث مفقود');
            setLoading(false);
            return;
        }

        try {
            const { data, error: fetchError } = await supabase
                .from('events')
                .select('*')
                .eq('token', token)
                .single();

            if (fetchError || !data) {
                setError('الحدث غير موجود');
                setLoading(false);
                return;
            }

            setEvent(data);

            // Check if feature is enabled
            if (!hasFeature(data, 'require_inspector_app')) {
                setError('رابط المشرفين غير مفعل لهذا الحدث');
                setLoading(false);
                return;
            }

            // Feature enabled - start scanning
            setScanning(true);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError('خطأ في تحميل بيانات الحدث');
            setLoading(false);
        }
    };

    // Scanner Init
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (scanning && event) {
            scanner = new Html5QrcodeScanner(
                "event-reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            scanner.render(onScanSuccess, (err) => console.log(err));
        }
        return () => {
            if (scanner) scanner.clear().catch(console.error);
        };
    }, [scanning, event]);

    const extractIdFromUrl = (text: string): string => {
        try {
            if (text.includes('/v/')) return text.split('/v/')[1].split('?')[0];
            if (text.includes('/invite/')) return text.split('/invite/')[1].split('?')[0];
            return text;
        } catch {
            return text;
        }
    };

    const onScanSuccess = async (decodedText: string) => {
        setScanning(false);
        setProcessing(true);

        const qrToken = extractIdFromUrl(decodedText);

        try {
            // Check time restriction
            if (event && hasFeature(event, 'qr_time_restricted') && event.activation_time) {
                const now = new Date();
                const activationTime = new Date(event.activation_time);

                if (now < activationTime) {
                    setScanResult({
                        status: 'error',
                        title: 'الوقت غير مناسب',
                        message: `المسح غير متاح قبل ${activationTime.toLocaleString('ar-SA')}`
                    });
                    setProcessing(false);
                    return;
                }
            }

            // Fetch guest
            const { data: guest, error: guestError } = await supabase
                .from('guests')
                .select('*')
                .eq('qr_token', qrToken)
                .single();

            if (guestError || !guest) {
                setScanResult({
                    status: 'error',
                    title: 'غير موجود',
                    message: 'الضيف غير موجود في النظام'
                });
                setProcessing(false);
                return;
            }

            // Check if guest belongs to this event
            if (guest.event_id !== event?.id) {
                setScanResult({
                    status: 'error',
                    title: 'خطأ في الحدث',
                    message: 'هذا الضيف ينتمي لحدث آخر'
                });
                setProcessing(false);
                return;
            }

            // Check ticket availability
            const totalTickets = 1 + (guest.companions_count || 0);
            const usedTickets = guest.scan_count || 0;
            const remaining = totalTickets - usedTickets;

            if (remaining < 1) {
                setScanResult({
                    status: 'error',
                    title: 'مكتمل',
                    message: `تم استخدام جميع التذاكر (${usedTickets}/${totalTickets})`,
                    guestName: guest.name,
                    tableNo: guest.table_no
                });
                setProcessing(false);
                return;
            }

            // Register check-in
            const newCount = usedTickets + 1;
            const { error: updateError } = await supabase
                .from('guests')
                .update({ status: 'attended', scan_count: newCount })
                .eq('id', guest.id);

            if (updateError) throw updateError;

            // Log activity
            await supabase.from('guest_activity_logs').insert({
                event_id: event?.id,
                guest_id: guest.id,
                scan_type: 'entry',
                status: 'success',
                companions_admitted: 1
            });

            setScanResult({
                status: 'success',
                title: 'تم التسجيل بنجاح',
                message: `متبقي ${totalTickets - newCount} تذاكر`,
                guestName: guest.name,
                tableNo: guest.table_no,
                companions: guest.companions_count,
                scanCount: newCount
            });

        } catch (err) {
            console.error(err);
            setScanResult({
                status: 'error',
                title: 'خطأ',
                message: 'حدث خطأ أثناء التسجيل'
            });
        } finally {
            setProcessing(false);
        }
    };

    const resetScanner = () => {
        setScanResult(null);
        setScanning(true);
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-center">
                    <Activity className="w-12 h-12 animate-spin mx-auto mb-4" />
                    <p>جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !event) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-white">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">خطأ</h2>
                        <p className="text-gray-600 mb-6">{error}</p>
                        <Button onClick={() => navigate('/')} className="w-full">
                            العودة للرئيسية
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-4 font-kufi" dir="rtl">
            <div className="max-w-md mx-auto space-y-6">
                {/* Event Header */}
                <div className="bg-gradient-to-r from-lony-navy to-blue-900 rounded-xl p-6 text-white shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-lony-gold rounded-full flex items-center justify-center">
                            <Activity className="w-6 h-6 text-lony-navy" />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold">{event.name}</h1>
                            <p className="text-blue-200 text-sm">{event.token}</p>
                        </div>
                    </div>

                    {/* Features Indicators */}
                    <div className="flex gap-2 flex-wrap mt-4">
                        {hasFeature(event, 'qr_time_restricted') && (
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                مقيد بوقت
                            </span>
                        )}
                        {hasFeature(event, 'live_analytics') && (
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs flex items-center gap-1">
                                📊 تحليلات مباشرة
                            </span>
                        )}
                        {hasFeature(event, 'privacy_mode') && (
                            <span className="px-3 py-1 bg-white/20 rounded-full text-xs flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                وضع الخصوصية
                            </span>
                        )}
                    </div>
                </div>

                {/* Scanner Card */}
                <Card className="overflow-hidden shadow-2xl">
                    <CardContent className="p-0">
                        {scanning ? (
                            <div className="p-6 bg-gray-50">
                                <div id="event-reader" className="rounded-xl overflow-hidden mb-4"></div>
                                <p className="text-center text-gray-600 font-bold animate-pulse">
                                    وجه الكاميرا نحو الرمز...
                                </p>
                            </div>
                        ) : scanResult ? (
                            <div className="animate-in zoom-in duration-300">
                                {/* Result Header */}
                                <div className={`p-8 text-center ${scanResult.status === 'success'
                                    ? 'bg-green-600'
                                    : 'bg-red-600'
                                    } text-white`}>
                                    {scanResult.status === 'success' ? (
                                        <CheckCircle className="w-20 h-20 mx-auto mb-4" />
                                    ) : (
                                        <XCircle className="w-20 h-20 mx-auto mb-4" />
                                    )}
                                    <h2 className="text-3xl font-bold mb-2">{scanResult.title}</h2>
                                    <p className="text-white/90 text-lg">{scanResult.message}</p>
                                </div>

                                {/* Guest Details */}
                                {scanResult.guestName && (
                                    <div className="p-6 bg-white text-center space-y-3">
                                        <h3 className="text-2xl font-bold text-gray-800">
                                            {scanResult.guestName}
                                        </h3>
                                        {scanResult.tableNo && (
                                            <p className="text-lony-gold font-bold">
                                                طاولة {scanResult.tableNo}
                                            </p>
                                        )}
                                        {scanResult.companions !== undefined && (
                                            <p className="text-gray-600">
                                                مرافقين: {scanResult.companions}
                                            </p>
                                        )}
                                        {scanResult.scanCount !== undefined && (
                                            <div className="bg-gray-100 rounded-lg p-3">
                                                <p className="text-sm text-gray-600">عدد المسح</p>
                                                <p className="text-2xl font-bold text-lony-navy">
                                                    {scanResult.scanCount}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Reset Button */}
                                <div className="p-6 pt-0">
                                    <Button
                                        onClick={resetScanner}
                                        variant="outline"
                                        className="w-full py-6 text-lg font-bold"
                                    >
                                        <RefreshCw className="w-5 h-5 ml-2" />
                                        مسح ضيف آخر
                                    </Button>
                                </div>
                            </div>
                        ) : processing ? (
                            <div className="p-12 text-center">
                                <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-lony-navy" />
                                <p className="text-gray-600">جاري المعالجة...</p>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default EventScanner;
