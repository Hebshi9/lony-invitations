import React, { useState } from 'react';
import {
    Plus, Trash2, Smartphone, Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CONFIG } from '../../lib/config';

interface ConnectionPanelProps {
    accounts: any[];
    onAccountsChange: () => void;
    addLog: (msg: string) => void;
}

const API_URL = CONFIG.API_URL;

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ accounts, onAccountsChange, addLog }) => {
    const [newPhone, setNewPhone] = useState('');
    const [newName, setNewName] = useState('');
    const [metaToken, setMetaToken] = useState('');
    const [metaPhoneId, setMetaPhoneId] = useState('');
    const [metaWabaId, setMetaWabaId] = useState('');
    const [discoveredNumbers, setDiscoveredNumbers] = useState<any[]>([]);
    const [fetchingNumbers, setFetchingNumbers] = useState(false);

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
        if (!newPhone || !metaToken) return alert('الرجاء إدخال رقم الهاتف والـ Access Token');

        try {
            const body = { 
                phone: newPhone, 
                name: newName || newPhone,
                provider: 'meta',
                meta_access_token: metaToken,
                meta_phone_number_id: metaPhoneId,
                meta_waba_id: metaWabaId
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
            alert('تم ربط حساب ميتا بنجاح!');
        } catch (error: any) {
            alert('خطأ في إضافة الحساب: ' + error.message);
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف الحساب؟')) return;
        try {
            addLog(`🗑️ Deleting meta account: ${id}`);
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

    return (
        <div className="space-y-4">
            {/* Add New Meta Account */}
            <div className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <h3 className="text-sm font-black text-indigo-800 mb-4 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" /> ربط حساب WhatsApp Meta رسمي
                </h3>
                
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <input
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            placeholder="الاسم (مثال: رقم المكتب)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                        />
                        <input
                            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 cursor-not-allowed"
                            placeholder="رقم الهاتف ID"
                            value={newPhone}
                            readOnly
                        />
                    </div>

                    <input
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                        placeholder="Access Token (الرمز الرئيسي من فيسبوك)"
                        value={metaToken}
                        onChange={e => setMetaToken(e.target.value)}
                    />

                    <div className="flex gap-2">
                        <input
                            className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                            placeholder="WABA ID (رقم حساب واتساب للأعمال)"
                            value={metaWabaId}
                            onChange={e => setMetaWabaId(e.target.value)}
                        />
                        <Button 
                            onClick={handleFetchMetaNumbers} 
                            disabled={fetchingNumbers}
                            size="sm" 
                            className="bg-indigo-600 text-white hover:bg-indigo-700 h-10 px-4 text-[10px] font-black rounded-xl"
                        >
                            {fetchingNumbers ? <Loader2 className="w-3 h-3 animate-spin" /> : 'جلب أرقامي'}
                        </Button>
                    </div>

                    {discoveredNumbers.length > 0 && (
                        <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-inner animate-in zoom-in duration-200">
                            <p className="text-[10px] font-black text-indigo-700 mb-2 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> اختر الرقم المراد تفعيله:
                            </p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                {discoveredNumbers.map(n => (
                                    <button
                                        key={n.id}
                                        onClick={() => {
                                            setMetaPhoneId(n.id);
                                            setNewPhone(n.display_phone_number);
                                            setNewName(n.verified_name || n.display_phone_number);
                                        }}
                                        className={`w-full text-right p-2 rounded-lg text-[10px] font-bold flex justify-between items-center transition-all ${
                                            metaPhoneId === n.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 hover:bg-indigo-50 text-slate-600'
                                        }`}
                                    >
                                        <span>{n.display_phone_number}</span>
                                        <span className="opacity-70 text-[8px]">{n.verified_name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <Button onClick={handleAddAccount} className="w-full mt-2 h-11 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95">
                        تثبيت وربط الحساب الرسمي 🚀
                    </Button>
                </div>
            </div>

            {/* Accounts List */}
            <div className="space-y-3">
                {accounts.length > 0 ? accounts.map(acc => (
                    <div key={acc.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 rounded-xl">
                                    <Smartphone className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-black text-slate-800 text-xs flex items-center gap-2">
                                        {acc.name}
                                        <span className="bg-emerald-50 text-emerald-600 text-[8px] px-1.5 py-0.5 rounded-full font-black">ACTIVE</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-0.5" dir="ltr">{acc.phone}</div>
                                </div>
                            </div>
                            <button onClick={() => handleDeleteAccount(acc.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-10 opacity-30">
                        <Smartphone className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">لا توجد حسابات ميتا مربوطة حالياً</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionPanel;
