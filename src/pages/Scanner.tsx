import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, XCircle, RefreshCw, Activity, Users, Plus, Wifi, WifiOff, CloudDownload, Save } from 'lucide-react';

interface OfflineScan {
    guestId: string;
    timestamp: number;
    increment: number;
    synced: boolean;
}

const Scanner: React.FC = () => {
    // --- STATE ---
    const [scanResult, setScanResult] = useState<{
        status: 'success' | 'error' | 'info';
        title: string;
        message: string;
        guestName?: string;
        eventName?: string;
        totalTickets?: number;
        usedTickets?: number;
        remainingTickets?: number;
        guestId?: string;
        tableNo?: string;
        customFields?: any;
    } | null>(null);

    const [scanning, setScanning] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Offline / Hybrid State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState<OfflineScan[]>([]);
    const [cachedGuestsCount, setCachedGuestsCount] = useState(0);

    // --- EFFECTS ---

    // 1. Network Monitoring & Queue Loading
    useEffect(() => {
        const handleStatusChange = () => {
            const online = navigator.onLine;
            setIsOnline(online);
            if (online) syncQueue(); // Try to sync immediately when back online
        };

        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        // Load Queue from LocalStorage
        const savedQueue = localStorage.getItem('lony_offline_queue');
        if (savedQueue) setOfflineQueue(JSON.parse(savedQueue));

        // Load Cache Stats
        const cache = localStorage.getItem('lony_guests_cache');
        if (cache) setCachedGuestsCount(JSON.parse(cache).length);
        const lastSync = localStorage.getItem('lony_last_sync');
        // if (lastSync) setLastSyncTime(lastSync);

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    // 2. Scanner Init
    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;
        if (scanning) {
            scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
            scanner.render(onScanSuccess, (err) => console.log(err));
        }
        return () => {
            if (scanner) scanner.clear().catch(console.error);
        };
    }, [scanning]);

    // --- CORE LOGIC ---

    const extractIdFromUrl = (text: string): string => {
        try {
            if (text.includes('/v/')) return text.split('/v/')[1].split('?')[0];
            return text;
        } catch { return text; }
    };

    // A. SYNC DATA (Download Guests for Offline Use)
    const downloadOfflineData = async () => {
        setProcessing(true);
        try {
            // Fetch ALL guests (For MVP, limit 5000)
            const { data, error } = await supabase
                .from('guests')
                .select('*, events(name)');

            if (error) throw error;
            if (data) {
                localStorage.setItem('lony_guests_cache', JSON.stringify(data));
                localStorage.setItem('lony_last_sync', new Date().toISOString());
                setCachedGuestsCount(data.length);
                alert(`✅ تم تحميل ${data.length} ضيف للعمل بدون إنترنت`);
            }
        } catch (err) {
            console.error(err);
            alert('فشل التحميل. تأكد من الاتصال بالإنترنت.');
        } finally {
            setProcessing(false);
        }
    };

    // B. PROCESS CHECK-IN (Hybrid)
    const processCheckIn = async (guestId: string, increment: number = 1) => {
        setProcessing(true);

        // 1. OFFLINE MODE (No Internet OR Explicit Failover)
        if (!isOnline) {
            processOfflineCheckIn(guestId, increment);
            return;
        }

        // 2. ONLINE MODE
        try {
            const { data: guest, error } = await supabase
                .from('guests')
                .select(`*, events (id, name)`)
                .eq('qr_token', guestId)
                .single();

            if (error || !guest) throw new Error('Guest not found');

            const totalTickets = 1 + (guest.companions_count || 0);
            const usedTickets = guest.scan_count || 0;
            const remaining = totalTickets - usedTickets;

            if (remaining < increment) {
                showResult('error', 'تجاوز العدد', `متبقي فقط ${remaining}`, guest);
                return;
            }

            // Update DB
            const newCount = usedTickets + increment;
            const { error: updateError } = await supabase
                .from('guests')
                .update({ status: 'attended', scan_count: newCount })
                .eq('id', guest.id);
            if (updateError) throw updateError;

            // Log
            await supabase.from('guest_activity_logs').insert({
                event_id: guest.event_id, guest_id: guest.id, scan_type: 'entry', status: 'success', companions_admitted: increment
            });

            showResult('success', 'تم الدخول (Online)', `متبقي ${totalTickets - newCount}`, guest, totalTickets, newCount);

        } catch (err) {
            console.warn("Online check failed, trying offline fallback...", err);
            processOfflineCheckIn(guestId, increment);
        } finally {
            setProcessing(false);
            setScanning(false);
        }
    };

    // C. OFFLINE HANDLER
    const processOfflineCheckIn = (qrToken: string, increment: number) => {
        const cache = localStorage.getItem('lony_guests_cache');
        if (!cache) {
            showResult('error', 'خطأ أوفلاين', 'لم يتم تحميل البيانات مسبقاً. اتصل بالإنترنت وحمل البيانات.');
            setProcessing(false);
            setScanning(false);
            return;
        }

        const guests = JSON.parse(cache);
        const guest = guests.find((g: any) => g.qr_token === qrToken);

        if (!guest) {
            showResult('error', 'غير موجود', 'الضيف غير موجود في البيانات المحملة.');
            setProcessing(false);
            setScanning(false);
            return;
        }

        // Check Local "Used" count (Account for queued scans)
        // We need to count how many times this ID is in the offlineQueue
        const queuedScans = offlineQueue.filter(q => q.guestId === guest.id).reduce((acc, curr) => acc + curr.increment, 0);

        const totalTickets = 1 + (guest.companions_count || 0);
        const initialUsed = guest.scan_count || 0;
        const currentUsed = initialUsed + queuedScans;
        const remaining = totalTickets - currentUsed;

        if (remaining < increment) {
            showResult('error', 'تجاوز العدد (Offline)', `متبقي ${remaining} (من الذاكرة المحلية)`, guest);
            setProcessing(false);
            setScanning(false);
            return;
        }

        // Success - Add to Queue
        const newScan: OfflineScan = {
            guestId: guest.id,
            timestamp: Date.now(),
            increment: increment,
            synced: false
        };
        const newQueue = [...offlineQueue, newScan];
        setOfflineQueue(newQueue);
        localStorage.setItem('lony_offline_queue', JSON.stringify(newQueue));

        showResult('success', 'تم الدخول (Offline)', 'سيتم المزامنة عند عودة الإنترنت', guest, totalTickets, currentUsed + increment);
        setProcessing(false);
        setScanning(false);
    };

    // D. SYNC QUEUE
    const syncQueue = async () => {
        if (!isOnline || offlineQueue.length === 0) return;

        const queue = [...offlineQueue];
        const failed: OfflineScan[] = [];

        console.log(`Starting sync for ${queue.length} items...`);

        for (const scan of queue) {
            try {
                // Fetch latest to be safe
                const { data: currentGuest } = await supabase.from('guests').select('scan_count').eq('id', scan.guestId).single();
                if (currentGuest) {
                    await supabase.from('guests').update({
                        status: 'attended',
                        scan_count: (currentGuest.scan_count || 0) + scan.increment
                    }).eq('id', scan.guestId);

                    await supabase.from('guest_activity_logs').insert({
                        event_id: 'offline_sync', // or fetch real ID
                        guest_id: scan.guestId, scan_type: 'entry_sync', status: 'success', companions_admitted: scan.increment
                    });
                }
            } catch (e) {
                console.error("Sync failed for item", scan, e);
                failed.push(scan);
            }
        }

        setOfflineQueue(failed);
        localStorage.setItem('lony_offline_queue', JSON.stringify(failed));
        if (failed.length === 0) alert('تمت مزامنة جميع البيانات بنجاح!');
    };

    // HELPER: UI State Setter
    const showResult = (status: 'success' | 'error', title: string, message: string, guest?: any, total?: number, used?: number) => {
        setScanResult({
            status, title, message,
            guestName: guest?.name,
            eventName: guest?.events?.name || 'Offline Event',
            totalTickets: total, usedTickets: used,
            remainingTickets: total !== undefined && used !== undefined ? total - used : undefined,
            guestId: guest?.id, tableNo: guest?.table_no, customFields: guest?.custom_fields
        });
    };

    const handleQuickCheckIn = () => {
        if (scanResult?.guestId) processCheckIn(scanResult.guestId, 1);
    };

    const resetScanner = () => {
        setScanResult(null);
        setScanning(true);
    };

    const onScanSuccess = async (decodedText: string) => {
        setScanning(false);
        const qrToken = extractIdFromUrl(decodedText);

        // Redirect to verification page
        window.location.href = `/v/${qrToken}`;
    };

    // --- MANUAL SEARCH ---
    const [showManualSearch, setShowManualSearch] = useState(false);
    const [manualQuery, setManualQuery] = useState('');
    const [manualResults, setManualResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const handleManualSearch = async () => {
        if (!manualQuery.trim()) return;
        setSearching(true);
        try {
            const { data, error } = await supabase
                .from('guests')
                .select('*, events(name)')
                .or(`name.ilike.%${manualQuery}%,phone.ilike.%${manualQuery}%`)
                .limit(10);

            if (error) throw error;
            setManualResults(data || []);
        } catch (e) {
            console.error(e);
            alert('خطأ في البحث');
        } finally {
            setSearching(false);
        }
    };

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-gray-900 p-4 font-kufi flex flex-col items-center" dir="rtl">

            {/* Top Bar: Connectivity & Cache */}
            <div className="w-full max-w-md bg-gray-800 rounded-xl p-3 mb-6 flex justify-between items-center text-xs text-gray-300 shadow-lg border border-gray-700">
                <div className="flex items-center gap-2">
                    {isOnline ? <Wifi className="text-green-400 w-4 h-4" /> : <WifiOff className="text-red-400 w-4 h-4" />}
                    <span>{isOnline ? 'متصل بالإنترنت' : 'وضع الأوفلاين'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Save className="w-4 h-4 text-lony-gold" />
                    <span>{cachedGuestsCount} محفوظ</span>
                    {offlineQueue.length > 0 && <span className="bg-red-500 text-white px-2 rounded-full animate-pulse">{offlineQueue.length} قيد الانتظار</span>}
                </div>
                <div onClick={downloadOfflineData} className="cursor-pointer bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition" title="تحديث البيانات">
                    <CloudDownload className={`w-4 h-4 ${processing ? 'animate-bounce text-yellow-400' : 'text-blue-400'}`} />
                </div>
            </div>

            <div className="w-full max-w-md space-y-6">
                {/* Header */}
                <div className="text-center text-white space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-lony-gold rounded-full shadow-lg mb-4">
                        <Activity className="w-8 h-8 text-lony-navy" />
                    </div>
                    <h1 className="text-2xl font-bold">بوابة التفتيش الذكية</h1>
                    <p className="text-gray-400 text-sm">نظام التحقق (Hybrid)</p>
                </div>

                <div className="flex gap-2 mb-4">
                    <Button
                        variant={!showManualSearch ? 'default' : 'outline'}
                        className={`flex-1 ${!showManualSearch ? 'bg-lony-gold text-lony-navy border-lony-gold' : 'text-white border-gray-600'}`}
                        onClick={() => { setShowManualSearch(false); setScanning(true); }}
                    >
                        المسح بالكاميرا
                    </Button>
                    <Button
                        variant={showManualSearch ? 'default' : 'outline'}
                        className={`flex-1 ${showManualSearch ? 'bg-lony-gold text-lony-navy border-lony-gold' : 'text-white border-gray-600'}`}
                        onClick={() => { setShowManualSearch(true); setScanning(false); }}
                    >
                        بحث يدوي
                    </Button>
                </div>

                <Card className="bg-white border-0 shadow-2xl overflow-hidden min-h-[400px]">
                    <CardContent className="p-0">
                        {showManualSearch ? (
                            <div className="p-6">
                                <div className="flex gap-2 mb-6">
                                    <input
                                        type="text"
                                        className="flex-1 p-3 border rounded-lg text-right"
                                        placeholder="ابحث بالاسم أو الجوال..."
                                        value={manualQuery}
                                        onChange={e => setManualQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                                    />
                                    <Button onClick={handleManualSearch} disabled={searching}>
                                        {searching ? '...' : <Users className="w-5 h-5" />}
                                    </Button>
                                </div>

                                <div className="space-y-4 max-h-[300px] overflow-y-auto">
                                    {manualResults.map(guest => (
                                        <div key={guest.id} className="p-4 border rounded-lg hover:bg-gray-50 flex justify-between items-center cursor-pointer" onClick={() => processCheckIn(guest.qr_token)}>
                                            <div className="text-right">
                                                <div className="font-bold text-gray-800">{guest.name}</div>
                                                <div className="text-xs text-gray-500">{guest.phone || 'بدون جوال'} - {guest.events?.name}</div>
                                                <div className={`text-xs mt-1 ${guest.status === 'attended' && (guest.scan_count >= (guest.companions_count + 1)) ? 'text-red-500' : 'text-green-500'}`}>
                                                    {guest.status === 'attended' && (guest.scan_count >= (guest.companions_count + 1)) ? 'مكتمل' : 'مسموح'} ({guest.scan_count || 0}/{guest.companions_count + 1})
                                                </div>
                                            </div>
                                            <Button size="sm" variant="outline">دخول</Button>
                                        </div>
                                    ))}
                                    {manualResults.length === 0 && !searching && <p className="text-center text-gray-400">لا توجد نتائج</p>}
                                </div>
                            </div>
                        ) : (
                            <>
                                {scanning ? (
                                    <div className="p-6 bg-gray-50 text-center">
                                        <div id="reader" className="rounded-xl overflow-hidden border-4 border-white shadow-inner mb-4"></div>
                                        <p className="text-gray-500 font-bold animate-pulse">وجه الكاميرا نحو الرمز...</p>
                                        {offlineQueue.length > 0 && isOnline && (
                                            <Button onClick={syncQueue} variant="outline" className="mt-4 w-full border-dashed border-blue-300 text-blue-600">
                                                يوجد {offlineQueue.length} عمليات لم تتم مزامنتها. اضغط للمزامنة.
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="animate-in zoom-in duration-300">
                                        {/* Result UI */}
                                        <div className={`p-8 text-center ${scanResult?.status === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                                            {scanResult?.status === 'success' ? <CheckCircle className="w-20 h-20 mx-auto mb-4" /> : <XCircle className="w-20 h-20 mx-auto mb-4" />}
                                            <h2 className="text-3xl font-bold mb-2">{scanResult?.title}</h2>
                                            <p className="text-white/90 text-lg">{scanResult?.message}</p>
                                        </div>
                                        {scanResult?.guestName && (
                                            <div className="p-6 bg-white text-center">
                                                <h3 className="text-2xl font-bold text-gray-800">{scanResult.guestName}</h3>
                                                <p className="text-lony-gold font-bold">{scanResult.eventName}</p>
                                                <p className="text-sm text-gray-400 mt-2">ID: {scanResult.tableNo || '-'}</p>

                                                {/* Scan Result Custom Fields */}
                                                {scanResult.customFields && Object.keys(scanResult.customFields).length > 0 && (
                                                    <div className="bg-gray-100 p-3 rounded-lg mt-4 text-sm text-right grid grid-cols-2 gap-2">
                                                        {Object.entries(scanResult.customFields).map(([key, value]) => (
                                                            <div key={key}>
                                                                <span className="text-gray-500 block text-xs">{key}</span>
                                                                <span className="font-bold text-gray-800">{String(value)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {(scanResult.remainingTickets || 0) > 0 && (
                                                    <Button onClick={handleQuickCheckIn} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white">
                                                        <Plus className="w-4 h-4 ml-2" /> تسجيل مرافق إضافي
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <div className="p-6 pt-0">
                                            <Button onClick={resetScanner} variant="outline" className="w-full py-6 text-lg font-bold border-2">
                                                <RefreshCw className="w-5 h-5 ml-2" /> مسح تذكرة جديدة
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Scanner;
