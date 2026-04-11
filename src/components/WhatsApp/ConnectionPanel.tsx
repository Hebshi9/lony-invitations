import React, { useState } from 'react';
import {
    Wifi, WifiOff, Plus, Trash2, Smartphone, Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import QRCode from 'react-qr-code';
import config from '../../lib/config';

interface ConnectionPanelProps {
    accounts: any[];
    onAccountsChange: () => void;
    addLog: (msg: string) => void;
}

const API_URL = config.api.whatsapp;

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ accounts, onAccountsChange, addLog }) => {


    const [newPhone, setNewPhone] = useState('');
    const [newName, setNewName] = useState('');
    const [provider, setProvider] = useState<'evolution' | 'meta'>('evolution');
    const [metaToken, setMetaToken] = useState('');
    const [metaPhoneId, setMetaPhoneId] = useState('');
    const [metaWabaId, setMetaWabaId] = useState('');
    const [discoveredNumbers, setDiscoveredNumbers] = useState<any[]>([]);
    const [fetchingNumbers, setFetchingNumbers] = useState(false);
    const [activeQR, setActiveQR] = useState<{ accountId: string, qr: string } | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);

    const handleFetchMetaNumbers = async () => {
        if (!metaToken || !metaWabaId) return alert('الرجاء إدخال الـ Token والـ WABA ID أولاً');
        setFetchingNumbers(true);
        try {
            const res = await fetch(`${API_URL}/meta-numbers?token=${metaToken}&wabaId=${metaWabaId}`);
            const data = await res.json();
            if (data.success) {
                setDiscoveredNumbers(data.numbers);
                if (data.numbers.length === 0) alert('لم يتم العثور على أرقام مسجلة لهذا الحساب');
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            alert('فشل جلب الأرقام: ' + e.message);
        } finally {
            setFetchingNumbers(false);
        }
    };

    const handleAddAccount = async () => {
        if (!newPhone) return alert('الرجاء إدخال رقم الهاتف');

        try {
            const body = { 
                phone: newPhone, 
                name: newName || newPhone,
                provider,
                meta_access_token: provider === 'meta' ? metaToken : null,
                meta_phone_number_id: provider === 'meta' ? metaPhoneId : null,
                meta_waba_id: provider === 'meta' ? metaWabaId : null
            };

            const response = await fetch(`${API_URL}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.success === false) {
                throw new Error(data.error || data.message || 'فشل الاتصال بسيرفر API');
            }

            setNewPhone('');
            setNewName('');
            setMetaToken('');
            setMetaPhoneId('');
            setMetaWabaId('');
            onAccountsChange();
            alert('تم إضافة الحساب بنجاح!');
        } catch (error: any) {
            alert('خطأ في إضافة الحساب: ' + error.message);
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف الحساب؟')) return;
        try {
            addLog(`🗑️ Deleting account: ${id}`);
            const response = await fetch(`${API_URL}/accounts/${id}`, { method: 'DELETE' });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to delete account');
            }

            addLog('✅ Account deleted successfully');
            onAccountsChange();
            alert('✅ تم حذف الحساب بنجاح');
        } catch (error: any) {
            addLog(`❌ Delete failed: ${error.message}`);
            alert('خطأ في الحذف: ' + error.message);
        }
    };

    const handleDisconnect = async (id: string) => {
        if (!confirm('هل أنت متأكد من قطع الاتصال؟')) return;
        try {
            addLog(`🔌 Disconnecting account: ${id}`);
            const response = await fetch(`${API_URL}/disconnect/${id}`, { method: 'POST' });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to disconnect');
            }

            addLog('✅ Disconnected successfully');
            onAccountsChange();
            alert('✅ تم قطع الاتصال بنجاح');
        } catch (error: any) {
            addLog(`❌ Disconnect failed: ${error.message}`);
            alert('خطأ في قطع الاتصال: ' + error.message);
        }
    };

    const handleConnect = async (accountId: string) => {
        try {
            setConnectingId(accountId);
            addLog(`🔌 Connecting account: ${accountId}`);

            const response = await fetch(`${API_URL}/connect/${accountId}`, { method: 'POST' });
            const result = await response.json();

            if (result.success) {
                // Poll for QR and Status
                const pollInterval = setInterval(async () => {
                    try {
                        const res = await fetch(`${API_URL}/qr-status/${accountId}`);
                        const data = await res.json();

                        if (data.connected) {
                            clearInterval(pollInterval);
                            setActiveQR(null);
                            setConnectingId(null);
                            onAccountsChange();
                            alert('✅ تم الاتصال بنجاح!');
                        } else if (data.qr) {
                            setActiveQR({ accountId, qr: data.qr });
                        }
                    } catch (e) {
                        console.error("Polling error", e);
                    }
                }, 2000);

                // Timeout after 2 minutes
                setTimeout(() => {
                    clearInterval(pollInterval);
                    setConnectingId(null);
                    if (!activeQR) {
                        // Optional: alert('Timeout waiting for QR');
                    }
                }, 120000);

            } else {
                alert('فشل الاتصال: ' + result.error);
                setConnectingId(null);
            }
        } catch (error: any) {
            alert('خطأ: ' + error.message);
            setConnectingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Add New Account */}
            <div className="bg-gray-50 p-4 rounded-lg border shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" /> إضافة قناة إرسال جديدة
                </h3>
                
                {/* Provider Selector */}
                <div className="flex gap-2 mb-4 bg-white p-1 rounded-lg border">
                    <button 
                        onClick={() => setProvider('evolution')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${provider === 'evolution' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Evolution (غير رسمي)
                    </button>
                    <button 
                        onClick={() => setProvider('meta')}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${provider === 'meta' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Meta Official (رسمي)
                    </button>
                </div>

                <div className="space-y-2">
                    <input
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        placeholder="رقم الجوال (مثال: +966...)"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                    />
                    <input
                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                        placeholder="اسم الحساب (مثال: رقم المكتب)"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />


                    {/* Meta Specific Fields */}
                    {provider === 'meta' && (
                        <div className="space-y-2 mt-2 pt-2 border-t animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] text-indigo-600 font-bold mb-1 uppercase tracking-wider">إعدادات Meta Cloud API</p>
                            <input
                                className="w-full p-2 border rounded text-sm bg-blue-50/10 focus:bg-white transition-colors"
                                placeholder="Access Token (الرمز الرئيسي)"
                                value={metaToken}
                                onChange={e => setMetaToken(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 p-2 border rounded text-sm bg-blue-50/10 focus:bg-white"
                                    placeholder="WABA ID"
                                    value={metaWabaId}
                                    onChange={e => setMetaWabaId(e.target.value)}
                                />
                                <Button 
                                    onClick={handleFetchMetaNumbers} 
                                    disabled={fetchingNumbers}
                                    size="sm" 
                                    variant="outline" 
                                    className="text-[10px] h-9"
                                >
                                    {fetchingNumbers ? <Loader2 className="w-3 h-3 animate-spin" /> : 'بحث عن أرقامي'}
                                </Button>
                            </div>

                            {discoveredNumbers.length > 0 && (
                                <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100 animate-in zoom-in duration-200">
                                    <p className="text-[10px] font-bold text-indigo-700 mb-1.5 flex items-center gap-1">
                                        <Smartphone className="w-3 h-3" /> اختر الرقم المراد ربطه:
                                    </p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                        {discoveredNumbers.map(n => (
                                            <button
                                                key={n.id}
                                                onClick={() => {
                                                    setMetaPhoneId(n.id);
                                                    setNewPhone(n.display_phone_number);
                                                    setNewName(n.verified_name || n.display_phone_number);
                                                }}
                                                className={`w-full text-left p-1.5 rounded text-[11px] flex justify-between items-center transition-all ${
                                                    metaPhoneId === n.id ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-indigo-100 text-gray-700'
                                                }`}
                                            >
                                                <span>{n.display_phone_number}</span>
                                                <span className="opacity-70 text-[9px]">{n.verified_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <input
                                className="w-full p-2 border rounded text-sm bg-gray-50 opacity-70"
                                placeholder="Phone Number ID (سيتم ملؤه آلياً)"
                                value={metaPhoneId}
                                readOnly
                            />
                        </div>
                    )}

                    <Button onClick={handleAddAccount} size="sm" className="w-full mt-2 font-bold">
                        حفظ الإعدادات والربط 🚀
                    </Button>
                </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-2">
                {accounts.map(acc => (
                    <div key={acc.id} className={`border rounded-lg p-3 transition-all ${acc.status === 'connected' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${acc.provider === 'meta' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                    {acc.provider === 'meta' ? 
                                        <Smartphone className="w-4 h-4 text-blue-600" /> : 
                                        acc.status === 'connected' ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-gray-400" />
                                    }
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                                        {acc.name}
                                        {acc.provider === 'meta' && <span className="bg-blue-600 text-white text-[8px] px-1 py-0.5 rounded font-black uppercase">Official</span>}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono" dir="ltr">{acc.phone}</div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteAccount(acc.id)} className="text-gray-400 hover:text-red-500">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Status Bar */}
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-2">
                            <div className="flex-1 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="bg-green-500 h-full"
                                    style={{ width: `${(acc.messages_sent_today / acc.daily_limit) * 100}%` }}
                                />
                            </div>
                            <span>{acc.messages_sent_today}/{acc.daily_limit}</span>
                        </div>

                        {/* Actions */}
                        {acc.status === 'connected' ? (
                            <Button
                                onClick={() => handleDisconnect(acc.id)}
                                size="sm"
                                variant="outline"
                                className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 h-8"
                            >
                                قطع الاتصال
                            </Button>
                        ) : (
                            <div className="space-y-2">
                                <Button
                                    onClick={() => handleConnect(acc.id)}
                                    size="sm"
                                    className="w-full text-xs h-8"
                                    disabled={connectingId === acc.id}
                                >
                                    {connectingId === acc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'اتصال (Scan QR)'}
                                </Button>

                                {activeQR?.accountId === acc.id && (
                                    <div className="bg-white p-2 rounded border flex flex-col items-center animate-in zoom-in duration-300">
                                        {activeQR?.qr?.startsWith('data:image') ? (
                                            <img src={activeQR.qr} alt="QR Code" className="w-32 h-32 object-contain" />
                                        ) : (
                                            <QRCode value={activeQR?.qr || ''} size={120} />
                                        )}
                                        <p className="text-[10px] text-center mt-1 text-gray-500">امسح الكود بالكاميرا</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ConnectionPanel;
