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
    const [activeQR, setActiveQR] = useState<{ accountId: string, qr: string } | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);

    const handleAddAccount = async () => {
        if (!newPhone) return alert('الرجاء إدخال رقم الهاتف');

        try {
            await fetch(`${API_URL}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: newPhone, name: newName || newPhone })
            });
            setNewPhone('');
            setNewName('');
            onAccountsChange();
            alert('تم إضافة الحساب بنجاح!');
        } catch (error: any) {
            alert('خطأ: ' + error.message);
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
            <div className="bg-gray-50 p-3 rounded-lg border">
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> إضافة حساب جديد
                </h3>
                <div className="grid grid-cols-1 gap-2">
                    <input
                        className="p-2 border rounded text-sm mb-1"
                        placeholder="رقم الجوال (مثال: +966...)"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                    />
                    <input
                        className="p-2 border rounded text-sm mb-2"
                        placeholder="الاسم (مثال: جوال العمل)"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                    />
                    <Button onClick={handleAddAccount} size="sm" variant="outline" className="w-full">
                        حفظ الحساب
                    </Button>
                </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-2">
                {accounts.map(acc => (
                    <div key={acc.id} className={`border rounded-lg p-3 transition-all ${acc.status === 'connected' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                {acc.status === 'connected' ? <Wifi className="w-4 h-4 text-green-600" /> : <WifiOff className="w-4 h-4 text-gray-400" />}
                                <div>
                                    <div className="font-bold text-sm text-gray-800">{acc.name}</div>
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
