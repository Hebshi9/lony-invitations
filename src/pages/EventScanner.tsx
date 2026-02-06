import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import {
    CheckCircle, XCircle, RefreshCw, Activity,
    AlertCircle, Clock, Lock, Users, PieChart,
    QrCode, Search, Menu, LogOut, ChevronRight
} from 'lucide-react';
import { hasFeature, EventFeatures } from '../lib/features';

// --- Types ---
interface Event {
    id: string;
    token: string;
    name: string;
    date: string;
    activation_time?: string;
    features: Partial<EventFeatures>;
}

interface Guest {
    id: string;
    event_id: string;
    name: string;
    phone?: string;
    qr_token: string;
    table_no?: string;
    companions_count: number;
    status: 'pending' | 'attended';
    scan_count: number;
    custom_fields?: Record<string, any>;
    events?: {
        name: string;
    };
}

// --- Components ---

// 1. Bottom Navigation
const BottomNav = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pb-4 shadow-lg z-50">
        <div className="flex justify-around items-center pt-3">
            <button
                onClick={() => setActiveTab('scanner')}
                className={`flex flex-col items-center gap-1 ${activeTab === 'scanner' ? 'text-lony-gold' : 'text-gray-400'}`}
            >
                <div className={`p-2 rounded-full ${activeTab === 'scanner' ? 'bg-lony-navy text-white shadow-lg -mt-6' : ''}`}>
                    <QrCode className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">المسح</span>
            </button>

            <button
                onClick={() => setActiveTab('guests')}
                className={`flex flex-col items-center gap-1 ${activeTab === 'guests' ? 'text-lony-navy font-bold' : 'text-gray-400'}`}
            >
                <Users className="w-6 h-6" />
                <span className="text-xs">الضيوف</span>
            </button>

            <button
                onClick={() => setActiveTab('stats')}
                className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? 'text-lony-navy font-bold' : 'text-gray-400'}`}
            >
                <PieChart className="w-6 h-6" />
                <span className="text-xs">الإحصائيات</span>
            </button>
        </div>
    </div>
);

// 2. Stats View
const StatsView = ({ guests }: { guests: Guest[] }) => {
    const total = guests.length;
    const attended = guests.filter(g => g.status === 'attended').length;
    const pending = total - attended;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;

    return (
        <div className="space-y-4 p-4 pb-24 animate-in fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-4">نظرة عامة على الحضور</h2>

            {/* Main Percentage */}
            <Card className="bg-lony-navy text-white border-none shadow-xl">
                <CardContent className="p-6 text-center">
                    <div className="text-5xl font-black text-lony-gold mb-2">{attendanceRate}%</div>
                    <div className="text-blue-200">نسبة الحضور</div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
                <Card className="bg-green-50 border-green-100">
                    <CardContent className="p-4 text-center">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-800">{attended}</div>
                        <div className="text-xs text-green-600">حضروا</div>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardContent className="p-4 text-center">
                        <Clock className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-orange-800">{pending}</div>
                        <div className="text-xs text-orange-600">لم يصلوا</div>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-4">
                <h3 className="font-bold text-gray-700 mb-2">تفاصيل إضافية</h3>
                <div className="bg-white rounded-lg p-4 shadow-sm space-y-3">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">مجموع المتوقع</span>
                        <span className="font-bold text-gray-900">{guests.reduce((acc, curr) => acc + 1 + (curr.companions_count || 0), 0)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500">حضور فعلي (مع مرافقين)</span>
                        <span className="font-bold text-gray-900">{guests.reduce((acc, curr) => acc + (curr.scan_count || 0), 0)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 3. Guests List View
const GuestsList = ({ guests, searchQuery, setSearchQuery, onManualCheckIn }: any) => {
    const filteredGuests = useMemo(() => {
        return guests.filter((g: Guest) =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.phone?.includes(searchQuery) ||
            g.table_no?.includes(searchQuery)
        );
    }, [guests, searchQuery]);

    return (
        <div className="space-y-4 p-4 pb-24 h-full flex flex-col animate-in fade-in">
            <div className="relative">
                <input
                    type="text"
                    placeholder="بحث عن ضيف (الاسم، الجوال، الطاولة)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-lony-navy"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
                {filteredGuests.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        لا توجد نتائج
                    </div>
                ) : (
                    filteredGuests.map((guest: Guest) => (
                        <div key={guest.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-gray-900">{guest.name}</h4>
                                <div className="text-xs text-gray-500 flex gap-2 mt-1">
                                    {guest.table_no && <span className="bg-gray-100 px-2 py-0.5 rounded">طاولة {guest.table_no}</span>}
                                    <span>مرافقين: {guest.companions_count}</span>
                                </div>
                            </div>
                            <div>
                                {guest.status === 'attended' || (guest.scan_count > 0) ? (
                                    <span className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold">
                                        <CheckCircle className="w-3 h-3" />
                                        حضر
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => onManualCheckIn(guest)}
                                        className="text-white bg-lony-navy px-4 py-2 rounded-lg text-xs font-bold hover:bg-opacity-90 transition-colors"
                                    >
                                        تحضير
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


// --- Main Component ---
const EventScanner: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('scanner');
    const [event, setEvent] = useState<Event | null>(null);
    const [guests, setGuests] = useState<Guest[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Auth State (Simple PIN for Supervisor)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [pinCode, setPinCode] = useState('');

    const [scanResult, setScanResult] = useState<{
        status: 'success' | 'error';
        title: string;
        message: string;
        guestName?: string;
        tableNo?: string;
        companions?: number;
        scanCount?: number;
    } | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
    }, [token]);

    const loadData = async () => {
        if (!token) return;

        try {
            // 1. Get Event
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('token', token)
                .single();

            if (eventError || !eventData) throw new Error('المناسبة غير موجودة');
            setEvent(eventData);

            // 2. Get Guests (for list & stats)
            const { data: guestsData } = await supabase
                .from('guests')
                .select('*')
                .eq('event_id', eventData.id);

            if (guestsData) setGuests(guestsData);

            // Check if user is already authenticated (supervisors need to log in once)
            const savedAuth = localStorage.getItem(`lony_auth_${eventData.id}`);
            if (savedAuth === 'true') setIsAuthenticated(true);

            setScanning(true);
            setLoading(false);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ');
            setLoading(false);
        }
    };

    // Scanner Hook
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (scanning && activeTab === 'scanner' && event) {
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
    }, [scanning, activeTab, event]);

    // Handle Tab Change
    const handleTabChange = (tab: string) => {
        if (tab !== 'scanner' && !isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        setActiveTab(tab);
        if (tab === 'scanner') {
            setScanning(true);
            setScanResult(null);
        } else {
            setScanning(false);
        }
    };

    // Handle Auth
    const handleLogin = () => {
        // Simple static PIN for now (can be dynamic later)
        if (pinCode === '1234') {
            setIsAuthenticated(true);
            setShowAuthModal(false);
            localStorage.setItem(`lony_auth_${event?.id}`, 'true');
        } else {
            alert('رمز المرور غير صحيح');
        }
    };

    // Scan Logic
    const extractIdFromUrl = (text: string): string => {
        try {
            if (text.includes('/v/')) return text.split('/v/')[1].split('?')[0];
            if (text.includes('/invite/')) return text.split('/invite/')[1].split('?')[0];
            return text;
        } catch { return text; }
    };

    // Offline Queue State
    const [offlineQueue, setOfflineQueue] = useState<{ guestId: string, timestamp: number }[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Network Status Listener
    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        // Load Queue
        const savedQueue = localStorage.getItem(`lony_offline_queue_${event?.id}`);
        if (savedQueue) setOfflineQueue(JSON.parse(savedQueue));

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, [event?.id]);

    // Background Sync
    useEffect(() => {
        if (isOnline && offlineQueue.length > 0) {
            syncOfflineQueue();
        }
    }, [isOnline, offlineQueue.length]);

    const syncOfflineQueue = async () => {
        const queue = [...offlineQueue];
        const failed: { guestId: string, timestamp: number }[] = [];

        for (const item of queue) {
            try {
                // Fetch latest to extract count
                const { data: currentGuest } = await supabase.from('guests').select('scan_count').eq('id', item.guestId).single();
                if (currentGuest) {
                    await supabase.from('guests').update({
                        status: 'attended',
                        scan_count: (currentGuest.scan_count || 0) + 1
                    }).eq('id', item.guestId);

                    // Also log activity
                    await supabase.from('guest_activity_logs').insert({
                        event_id: event?.id,
                        guest_id: item.guestId,
                        scan_type: 'entry_sync',
                        status: 'success'
                    });
                }
            } catch (err) {
                console.error("Sync failed", err);
                failed.push(item);
            }
        }

        setOfflineQueue(failed);
        localStorage.setItem(`lony_offline_queue_${event?.id}`, JSON.stringify(failed));
        if (queue.length > failed.length) {
            // Some succeeded
            loadData(); // Refresh list from server
        }
    };

    // Scan Logic with Offline Support
    const onScanSuccess = async (decodedText: string) => {
        setScanning(false);
        setProcessing(true);
        const qrToken = extractIdFromUrl(decodedText);

        try {
            // Find guest in local list (This works offline if list is loaded)
            const guest = guests.find(g => g.qr_token === qrToken);

            if (!guest) {
                setScanResult({
                    status: 'error',
                    title: 'غير موجود',
                    message: 'هذا الضيف غير مسجل في القائمة'
                });
                setProcessing(false);
                return;
            }

            // Verify Logic (Check used tickets + queued tickets)
            const queuedCount = offlineQueue.filter(q => q.guestId === guest.id).length;
            const totalTickets = 1 + (guest.companions_count || 0);
            const usedTickets = (guest.scan_count || 0) + queuedCount;
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

            // Update Logic
            const newCount = usedTickets + 1;

            // 1. Optimistic UI Update (Always Instant)
            setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, status: 'attended', scan_count: newCount } : g));

            setScanResult({
                status: 'success',
                title: 'أهلاً وسهلاً',
                message: isOnline ? `تسجيل دخول ناجح (${newCount}/${totalTickets})` : `تم التسجيل محلياً (${newCount}/${totalTickets})`,
                guestName: guest.name,
                companions: guest.companions_count,
                tableNo: guest.table_no,
                scanCount: newCount
            });

            // 2. Network Update (Fail-safe)
            try {
                if (!isOnline) throw new Error("Offline");

                await supabase.from('guests').update({
                    status: 'attended',
                    scan_count: newCount // Note: This might race condition in heavy concurrency, but fine for MVP
                }).eq('id', guest.id);

                // Log Check-in
                await supabase.from('guest_activity_logs').insert({
                    event_id: guest.event_id,
                    guest_id: guest.id,
                    scan_type: 'entry',
                    status: 'success'
                });

            } catch (netErr) {
                console.warn("Network failed, saving to offline queue");
                const newQueueItem = { guestId: guest.id, timestamp: Date.now() };
                const updatedQueue = [...offlineQueue, newQueueItem];
                setOfflineQueue(updatedQueue);
                localStorage.setItem(`lony_offline_queue_${event?.id}`, JSON.stringify(updatedQueue));
            }

        } catch (err) {
            console.error(err);
            setScanResult({ status: 'error', title: 'خطأ', message: 'فشل غير متوقع' });
        } finally {
            setProcessing(false);
        }
    };

    const handleManualCheckIn = async (guest: Guest) => {
        if (!confirm(`هل أنت متأكد من تسجيل دخول ${guest.name} يدوياً؟`)) return;

        // Optimistic Update
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, status: 'attended', scan_count: (Number(g.scan_count) || 0) + 1 } : g));

        await supabase.from('guests').update({
            status: 'attended',
            scan_count: (Number(guest.scan_count) || 0) + 1
        }).eq('id', guest.id);
    };

    if (loading) return <div className="min-h-screen bg-lony-navy flex items-center justify-center text-white"><Activity className="animate-spin" /></div>;
    if (error || !event) return <div className="p-8 text-center text-red-600 font-bold">{error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 font-kufi" dir="rtl">
            {/* Header with Connectivity Status */}
            <div className="bg-lony-navy text-white p-6 pb-12 rounded-b-[3rem] shadow-xl relative z-10 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-1 rounded-full backdrop-blur-md">
                        {isOnline ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
                        <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
                        {offlineQueue.length > 0 && (
                            <span className="bg-lony-gold text-lony-navy px-2 rounded-full font-bold ml-1 animate-pulse">
                                {offlineQueue.length} قيد الانتظار
                            </span>
                        )}
                    </div>
                    {isAuthenticated && <span className="bg-green-500/20 text-green-300 text-[10px] px-2 py-1 rounded-full">وضع المشرف</span>}
                </div>
                <h1 className="text-xl font-bold text-white">{event.name}</h1>
                <p className="text-blue-200 text-xs mt-1">المناسبة رقم: {event.token}</p>
            </div>

            {/* 2. Main Content Area */}
            <div className="max-w-md mx-auto relative -mt-4 z-20 px-4">

                {/* Scanner View */}
                {activeTab === 'scanner' && (
                    <Card className="shadow-xl overflow-hidden border-none">
                        <CardContent className="p-0 bg-white min-h-[400px] relative">
                            {scanning ? (
                                <div className="relative">
                                    <div id="event-reader" className="w-full"></div>
                                    <div className="absolute inset-x-0 bottom-4 text-center">
                                        <p className="inline-block bg-black/50 text-white px-4 py-1 rounded-full text-sm backdrop-blur-sm animate-pulse">
                                            وجه الكاميرا نحو الرمز
                                        </p>
                                    </div>
                                </div>
                            ) : scanResult ? (
                                <div className="animate-in zoom-in duration-300 bg-gray-50 min-h-[400px]">
                                    {/* 1. Header / Status */}
                                    <div className={`p-6 text-center ${scanResult.status === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white rounded-b-3xl shadow-lg relative z-10`}>
                                        <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                                            {scanResult.status === 'success' ? (
                                                <CheckCircle className="w-10 h-10 text-white" />
                                            ) : (
                                                <XCircle className="w-10 h-10 text-white" />
                                            )}
                                        </div>
                                        <h2 className="text-3xl font-bold">{scanResult.title}</h2>
                                        <p className="text-white/90 mt-1">{scanResult.message}</p>
                                    </div>

                                    {/* 2. Guest Details Card (Matching GuestView.tsx) */}
                                    <div className="p-4 -mt-6 relative z-20">
                                        <div className="bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">

                                            {/* Name */}
                                            <div>
                                                {scanResult.guestName && (
                                                    <h3 className="text-3xl font-bold text-gray-800 mb-2">
                                                        {scanResult.guestName}
                                                    </h3>
                                                )}

                                                {/* Table Pill */}
                                                {scanResult.tableNo && (
                                                    <div className="inline-block bg-indigo-100 text-indigo-800 px-6 py-2 rounded-full font-bold text-lg shadow-sm border border-indigo-200">
                                                        طاولة {scanResult.tableNo}
                                                    </div>
                                                )}
                                            </div>

                                            <hr className="border-gray-100" />

                                            {/* Companions & Tickets Grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Companions */}
                                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border border-indigo-100">
                                                    <div className="flex flex-col items-center">
                                                        <Users className="w-6 h-6 text-indigo-500 mb-1" />
                                                        <span className="text-xs text-gray-500">المرافقين</span>
                                                        <span className="text-xl font-bold text-indigo-900">
                                                            {scanResult.companions !== undefined ? scanResult.companions : '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Scan Count */}
                                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border border-purple-100">
                                                    <div className="flex flex-col items-center">
                                                        <Activity className="w-6 h-6 text-purple-500 mb-1" />
                                                        <span className="text-xs text-gray-500">عدد المحاولات</span>
                                                        <span className="text-xl font-bold text-purple-900">
                                                            {scanResult.scanCount !== undefined ? scanResult.scanCount : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reset Button */}
                                    <div className="p-6 pt-0 mt-auto">
                                        <Button
                                            onClick={() => { setScanResult(null); setScanning(true); }}
                                            className="w-full py-4 text-lg font-bold shadow-lg bg-lony-navy hover:bg-lony-navy/90 text-white rounded-xl"
                                        >
                                            <RefreshCw className="w-5 h-5 ml-2" />
                                            مسح ضيف آخر
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 text-center text-gray-400">
                                    <Activity className="animate-spin w-8 h-8 mx-auto mb-2" />
                                    جاري المعالجة...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* List View */}
                {activeTab === 'guests' && (
                    <GuestsList
                        guests={guests}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        onManualCheckIn={handleManualCheckIn}
                    />
                )}

                {/* Stats View */}
                {activeTab === 'stats' && (
                    <StatsView guests={guests} />
                )}
            </div>

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <Card className="w-full max-w-sm">
                        <CardContent className="p-6 text-center space-y-4">
                            <Lock className="w-12 h-12 text-lony-gold mx-auto" />
                            <h2 className="text-xl font-bold text-gray-900">دخول المشرفين</h2>
                            <p className="text-sm text-gray-600">أدخل رمز المرور لعرض بيانات الضيوف والاحصائيات.</p>
                            <input
                                type="password"
                                autoFocus
                                value={pinCode}
                                onChange={(e) => setPinCode(e.target.value)}
                                className="w-full text-center text-2xl tracking-[0.5em] p-3 border rounded-lg focus:ring-2 focus:ring-lony-navy"
                                placeholder="••••"
                                maxLength={4}
                            />
                            <div className="flex gap-2">
                                <Button onClick={() => setShowAuthModal(false)} variant="outline" className="flex-1">إلغاء</Button>
                                <Button onClick={handleLogin} className="flex-1 bg-lony-navy">دخول</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Bottom Nav */}
            <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default EventScanner;
