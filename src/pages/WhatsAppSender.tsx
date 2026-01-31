
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
    Send, Pause, Play, StopCircle, Plus, Trash2, Wifi, WifiOff,
    ArrowRight, ArrowLeft, CheckCircle, Loader2, Sparkles
} from 'lucide-react';
import geminiService from '../services/gemini-service';
import { supabase } from '../lib/supabaseClient';
import messageTemplates, { fillTemplate, getTemplateVariables } from '../services/message-templates';
import QRCode from 'react-qr-code';

const API_URL = `http://${window.location.hostname}:3001/api/whatsapp`;

const WhatsAppSender = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [guests, setGuests] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('default');
    const [customMessage, setCustomMessage] = useState(messageTemplates.default.text);
    const [messagePhase, setMessagePhase] = useState<'initial' | 'personalized'>('initial');
    const [queueStatus, setQueueStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [activeQR, setActiveQR] = useState<{ accountId: string, qr: string } | null>(null);

    // Debug logging state
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const addLog = (msg: string) => setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);



    // New account form
    const [newAccountPhone, setNewAccountPhone] = useState('');
    const [newAccountName, setNewAccountName] = useState('');

    useEffect(() => {
        fetchEvents();
        fetchAccounts();

        // Poll queue status every 5 seconds
        const interval = setInterval(fetchQueueStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            fetchGuests(selectedEventId);
        }
    }, [selectedEventId]);

    useEffect(() => {
        setCustomMessage(messageTemplates[selectedTemplate].text);
    }, [selectedTemplate]);

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*');
        if (data) {
            setEvents(data);
            // Auto-select first event if strictly one exists or none selected
            if (data.length > 0 && !selectedEventId) {
                const firstId = data[0].id;
                setSelectedEventId(firstId);
                addLog(`Auto-selected event: ${data[0].name}`);
            }
        }
    };

    const fetchGuests = async (eventId: string) => {
        const { data } = await supabase
            .from('guests')
            .select('id, name, phone, card_image_url, qr_token, rsvp_status')
            .eq('event_id', eventId);
        if (data) setGuests(data);
    };

    const fetchAccounts = async () => {
        try {
            const response = await fetch(`${API_URL}/accounts`);
            const result = await response.json();
            if (result.success) {
                setAccounts(result.accounts);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchQueueStatus = async () => {
        if (!selectedEventId) return;

        try {
            const response = await fetch(`${API_URL}/status/${selectedEventId}`);
            const result = await response.json();
            if (result.success) {
                setQueueStatus(result.status);
            }
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    const handleAddAccount = async () => {
        if (!newAccountPhone) {
            alert('الرجاء إدخال رقم الهاتف');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: newAccountPhone,
                    name: newAccountName || newAccountPhone
                })
            });

            const result = await response.json();
            if (result.success) {
                setNewAccountPhone('');
                setNewAccountName('');
                fetchAccounts();
                alert('تم إضافة الحساب بنجاح!');
            }
        } catch (error) {
            alert('خطأ في إضافة الحساب: ' + error.message);
        }
    };

    const handleConnectAccount = async (accountId: string) => {
        try {
            addLog(`🔌 Attempting to connect account: ${accountId}`);

            // Start connection
            const response = await fetch(`${API_URL}/connect/${accountId}`, {
                method: 'POST'
            });

            const result = await response.json();
            addLog(`📡 Response received: ${JSON.stringify(result)}`);

            if (result.success) {
                addLog(`✅ Connection initiated, listening for QR code...`);

                // Listen for QR code using Server-Sent Events
                const eventSource = new EventSource(`${API_URL}/qr/${accountId}`);

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.qr) {
                            addLog(`📱 QR Code received!`);
                            setActiveQR({ accountId, qr: data.qr });
                        }
                    } catch (err: any) {
                        addLog(`⚠️ Error parsing QR data: ${err.message}`);
                    }
                };

                eventSource.onerror = (error) => {
                    addLog(`❌ EventSource error`);
                    eventSource.close();
                };

                // Poll for connection status
                const statusInterval = setInterval(async () => {
                    const checkResponse = await fetch(`${API_URL}/accounts`);
                    const checkResult = await checkResponse.json();
                    if (checkResult.success) {
                        const updatedAccount = checkResult.accounts.find((a: any) => a.id === accountId);
                        if (updatedAccount && updatedAccount.status === 'connected') {
                            addLog(`✅ Account connected successfully!`);
                            clearInterval(statusInterval);
                            eventSource.close();
                            setActiveQR(null);
                            fetchAccounts();
                            alert('✅ تم الربط بنجاح!');
                        }
                    }
                }, 3000);

                // Stop polling after 2 minutes
                setTimeout(() => {
                    clearInterval(statusInterval);
                    eventSource.close();
                    setActiveQR(null);
                    addLog(`⏱️ Connection timeout`);
                }, 120000);
            } else {
                addLog(`❌ Connection failed: ${result.error || 'Unknown error'}`);
                alert('فشل الاتصال: ' + (result.error || 'خطأ غير معروف'));
            }
        } catch (error: any) {
            addLog(`❌ Error: ${error.message}`);
            alert('خطأ في الاتصال: ' + error.message);
        }
    };


    const handleDeleteAccount = async (accountId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;

        try {
            const response = await fetch(`${API_URL}/accounts/${accountId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success) {
                if (activeQR?.accountId === accountId) {
                    setActiveQR(null);
                }
                await fetchAccounts();
                alert('تم حذف الحساب');
            }
        } catch (error) {
            alert('خطأ في الحذف: ' + error.message);
        }
    };

    const handlePrepareMessages = async () => {
        if (!selectedEventId) {
            alert('الرجاء اختيار حدث');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/prepare-messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    template: messageTemplates[selectedTemplate].text,
                    customMessage,
                    messagePhase // Add phase selection
                })
            });

            const result = await response.json();
            if (result.success) {
                const phaseText = messagePhase === 'initial' ? 'دعوة عامة (بدون كرت)' : 'دعوة شخصية (مع كرت)';
                alert(`تم تجهيز ${result.count} رسالة - ${phaseText}`);
            }
        } catch (error: any) {
            alert('خطأ في تجهيز الرسائل: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStartSending = async () => {
        addLog('🖱️ Button Clicked: Start Sending');

        if (!selectedEventId) {
            addLog('❌ Error: No event selected');
            alert('⛔ توقف: لم يتم اختيار حدث! الرجاء اختيار حدث من القائمة.');
            return;
        }

        const connectedAccounts = accounts.filter(a => a.status === 'connected');
        if (connectedAccounts.length === 0) {
            addLog('❌ Error: No connected accounts');
            alert(`⛔ توقف: لا يوجد حسابات متصلة!\nالمتصلة: 0`);
            return;
        }

        setLoading(true);
        try {
            addLog(`🚀 Sending request to ${API_URL}/send-batch`);
            const response = await fetch(`${API_URL}/send-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEventId })
            });

            const result = await response.json();
            addLog(`✅ Server Response: ${JSON.stringify(result)}`);

            if (result.success) {
                alert('✅ تم إرسال أمر البدء للسيرفر بنجاح!');
            } else {
                alert('⚠️ السيرفر رد بخطأ: ' + (result.error || 'غير معروف'));
            }
        } catch (error: any) {
            addLog(`🔥 Network Error: ${error.message}`);
            alert('❌ فشل الاتصال بالسيرفر! تأكد أن السيرفر يعمل.\n' + error.message);
        } finally {
            setLoading(false);
        }
    };



    const guestsWithPhone = guests.filter(g => g.phone);

    return (
        <div className="space-y-6 font-kufi" dir="rtl">
            <h1 className="text-3xl font-bold text-lony-navy font-amiri">إرسال WhatsApp</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Event Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>1. اختر الحدث</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                            >
                                <option value="">-- اختر --</option>
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                            {guestsWithPhone.length > 0 && (
                                <div className="mt-2 text-sm text-green-600">
                                    ✓ {guestsWithPhone.length} ضيف لديهم أرقام
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Accounts Management */}
                    <Card>
                        <CardHeader>
                            <CardTitle>2. حسابات WhatsApp</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add Account */}
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="رقم الهاتف (مثال: +966...)"
                                    className="w-full p-2 border rounded text-sm"
                                    value={newAccountPhone}
                                    onChange={(e) => setNewAccountPhone(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="اسم الحساب (اختياري)"
                                    className="w-full p-2 border rounded text-sm"
                                    value={newAccountName}
                                    onChange={(e) => setNewAccountName(e.target.value)}
                                />
                                <Button
                                    onClick={handleAddAccount}
                                    className="w-full"
                                    size="sm"
                                >
                                    <Plus className="w-4 h-4 ml-2" />
                                    إضافة حساب
                                </Button>
                            </div>

                            {/* Accounts List */}
                            <div className="space-y-2">
                                {accounts.map(account => (
                                    <div key={account.id} className="border rounded p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {account.status === 'connected' ? (
                                                    <Wifi className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <WifiOff className="w-4 h-4 text-gray-400" />
                                                )}
                                                <span className="font-medium text-sm">{account.name}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteAccount(account.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-600">
                                            {account.phone}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {account.messages_sent_today}/{account.daily_limit} رسالة اليوم
                                        </div>
                                        {account.status !== 'connected' && (
                                            <div className="space-y-2">
                                                <Button
                                                    onClick={() => handleConnectAccount(account.id)}
                                                    size="sm"
                                                    className="w-full"
                                                >
                                                    اتصال
                                                </Button>
                                                {activeQR?.accountId === account.id && activeQR.qr && (
                                                    <div className="bg-white p-2 rounded border flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                                                        <QRCode value={activeQR.qr} size={150} />
                                                        <span className="text-[10px] text-gray-500 text-center">امسح الكود لربط الحساب</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Message Phase Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>3. نوع الرسالة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setMessagePhase('initial')}
                                    className={`p-4 rounded-lg border-2 transition-all ${messagePhase === 'initial'
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-300 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">📧</div>
                                        <div className="font-bold text-gray-800">دعوة عامة</div>
                                        <div className="text-sm text-gray-600 mt-1">بدون كرت شخصي</div>
                                        <div className="text-xs text-gray-500 mt-2">
                                            للتأكد من الحضور أولاً
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMessagePhase('personalized')}
                                    className={`p-4 rounded-lg border-2 transition-all ${messagePhase === 'personalized'
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-300 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="text-center">
                                        <div className="text-2xl mb-2">🎴</div>
                                        <div className="font-bold text-gray-800">دعوة شخصية</div>
                                        <div className="text-sm text-gray-600 mt-1">مع كرت شخصي</div>
                                        <div className="text-xs text-gray-500 mt-2">
                                            إرسال الكرت مباشرة
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {messagePhase === 'initial' && (
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                    💡 <strong>نظام المرحلتين:</strong> أرسل دعوة عامة أولاً، ثم أرسل الكروت الشخصية للمؤكدين فقط
                                </div>
                            )}

                            {/* New: Client Tools (Host Info) */}
                            <div className="mt-6 pt-6 border-t border-gray-100">
                                <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="bg-lony-gold/20 p-1 rounded">👑</span>
                                    أدوات العميل (Client Tools)
                                </h4>
                                <Button
                                    onClick={async () => {
                                        if (!selectedEventId) return;
                                        // Fetch event details to get PIN and Token
                                        const { data: event } = await supabase.select('*').from('events').eq('id', selectedEventId).single();
                                        if (!event) return;

                                        const message = `مرحباً عزيزي العميل 👑\n\nإليك رابط لوحة التحكم الخاصة بك لمتابعة الحضور:\n${window.location.origin}/client/dashboard/${event.id}\n\n${event.host_pin ? `رمز المضيف (للمسح بالكاميرا): ${event.host_pin}` : ''}`;

                                        // Open WhatsApp with this message
                                        // In a real app we might send it via the connected bot, but for now specific admin sending is manual or via bot if selected
                                        const phone = prompt('أدخل رقم جوال العميل (مع مفتاح الدولة):', event.client_phone || '');
                                        if (phone) {
                                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
                                        }
                                    }}
                                    variant="outline"
                                    className="w-full border-lony-gold text-lony-navy hover:bg-lony-gold/10"
                                >
                                    إرسال بيانات الدخول للعميل (واتساب)
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Template Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle>4. قالب الرسالة</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <select
                                className="w-full p-2 border rounded-lg"
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                            >
                                {Object.entries(messageTemplates).map(([key, template]) => (
                                    <option key={key} value={key}>{template.name}</option>
                                ))}
                            </select>

                            <div className="relative">
                                <textarea
                                    className="w-full p-3 border rounded-lg font-kufi"
                                    rows={8}
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    placeholder="اكتب رسالتك هنا..."
                                />
                                {geminiService.isConfigured() && (
                                    <button
                                        onClick={async () => {
                                            if (!customMessage) return;
                                            setLoading(true);
                                            const polished = await geminiService.polishMessage(customMessage);
                                            setCustomMessage(polished);
                                            setLoading(false);
                                        }}
                                        disabled={loading || !customMessage}
                                        className="absolute bottom-2 left-2 flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-md text-xs hover:bg-purple-200 transition-colors"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        {loading ? 'جاري التحسين...' : 'تحسين بالذكاء الاصطناعي'}
                                    </button>
                                )}
                            </div>

                            <div className="text-sm text-gray-600">
                                <p className="font-medium mb-1">المتغيرات المتاحة:</p>
                                <div className="flex flex-wrap gap-2">
                                    {['{{name}}', '{{event}}', '{{date}}', '{{location}}'].map(v => (
                                        <code key={v} className="bg-gray-100 px-2 py-1 rounded">{v}</code>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handlePrepareMessages}
                                disabled={loading || !selectedEventId}
                                className="w-full"
                            >
                                تجهيز الرسائل
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Sending Controls */}
                    <Card>
                        <CardHeader>
                            <CardTitle>4. التحكم (Debug Panel)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Button
                                onClick={handleStartSending}
                                disabled={loading || queueStatus?.isRunning}
                                className={`w-full py-6 text-lg font-bold ${queueStatus?.isRunning ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                {loading ? 'جاري الاتصال...' : queueStatus?.isRunning ? 'Running...' : '🚀 بدء الإرسال (Start Sending)'}
                            </Button>

                            {/* Debug Logs Box */}
                            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-xs h-40 overflow-y-auto" dir="ltr">
                                <div className="font-bold border-b border-gray-700 mb-2 pb-1">System Logs:</div>
                                {debugLogs.length === 0 && <div className="opacity-50">Waiting for actions...</div>}
                                {debugLogs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>

                            {/* Progress */}
                            {queueStatus?.stats && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-4 gap-2 text-center">
                                        <div className="bg-gray-100 p-3 rounded">
                                            <div className="text-2xl font-bold">{queueStatus.stats.pending}</div>
                                            <div className="text-xs text-gray-600">قيد الانتظار</div>
                                        </div>
                                        <div className="bg-blue-100 p-3 rounded">
                                            <div className="text-2xl font-bold text-blue-600">{queueStatus.stats.queued}</div>
                                            <div className="text-xs text-gray-600">في القائمة</div>
                                        </div>
                                        <div className="bg-green-100 p-3 rounded">
                                            <div className="text-2xl font-bold text-green-600">{queueStatus.stats.sent}</div>
                                            <div className="text-xs text-gray-600">تم الإرسال</div>
                                        </div>
                                        <div className="bg-red-100 p-3 rounded">
                                            <div className="text-2xl font-bold text-red-600">{queueStatus.stats.failed}</div>
                                            <div className="text-xs text-gray-600">فشل</div>
                                        </div>
                                    </div>

                                    {queueStatus.isRunning && (
                                        <div className="text-center text-sm">
                                            {queueStatus.isPaused ? (
                                                <span className="text-yellow-600">⏸️ متوقف مؤقتاً</span>
                                            ) : (
                                                <span className="text-green-600">▶️ جاري الإرسال...</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppSender;
