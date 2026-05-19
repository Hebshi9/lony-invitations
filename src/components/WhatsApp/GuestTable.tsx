import React, { useState } from 'react';
import {
    CheckCircle, XCircle, Clock, Send, RefreshCcw, Edit2, Save, X, Trash2, AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/Button';

interface GuestTableProps {
    guests: any[];
    onRetry: (guest: any) => void;
    onDirectSend: (guest: any) => void;
    onOverrideStatus?: (guest: any, newStatus: string) => void;
    onEditPhone?: (guest: any, newPhone: string) => void;
    onShowLifecycle?: (guest: any) => void;
    onSendTest?: (guest: any) => void;
    onDelete?: (guest: any) => void;
    stuckTimeoutHours?: number; // Configurable timeout
}

const GuestTable: React.FC<GuestTableProps> = ({ guests, onRetry, onDirectSend, onOverrideStatus, onEditPhone, onShowLifecycle, onSendTest, onDelete, stuckTimeoutHours = 3 }) => {

    const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
    const [editPhoneValue, setEditPhoneValue] = useState('');

    // Helper to get status icon and color from combined status
    const getStatusInfo = (rawStatus: string, deliveryStatus?: string, errorMsg?: string, rsvpStatus?: string, messageDate?: string) => {
        
        // 🚨 INTITSAR GUARDRAIL: Detect "Stuck" messages (Sent but never Delivered)
        const isStuck = deliveryStatus === 'sent' && messageDate && (
            (new Date().getTime() - new Date(messageDate).getTime()) > (stuckTimeoutHours * 60 * 60 * 1000)
        );

        if (isStuck) {
            return { 
                icon: <div className="animate-pulse"><AlertTriangle className="w-4 h-4 text-amber-500" /></div>, 
                color: 'text-amber-800', 
                bg: 'bg-amber-50 border-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.2)]', 
                label: 'عالقة ⚠️ (راجع الضيف)',
                note: 'تم الإرسال من السيرفر ولكن لم يصل للهاتف بعد (احتمالية حالة إنتصار)'
            };
        }
        // IMPROVEMENT: If they responded (RSVP), they DEFINITELY read it.
        if (rsvpStatus && rsvpStatus !== 'none' && rsvpStatus !== 'pending') {
            return { 
                icon: (
                    <div className="flex -space-x-1">
                        <CheckCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500/10" />
                        <CheckCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500/10" />
                    </div>
                ), 
                color: 'text-sky-700', 
                bg: 'bg-sky-50 border-sky-100', 
                label: 'تمت القراءة (رد)' 
            };
        }

        // High priority: Failed
        if (rawStatus === 'failed' || deliveryStatus === 'failed') {
            const isMetaBlock = errorMsg?.includes('131051') || errorMsg?.includes('سياسة الواتساب الدولية');
            return { 
                icon: <XCircle className="w-4 h-4 text-rose-500" />, 
                color: 'text-rose-700', 
                bg: 'bg-rose-50 border-rose-100', 
                label: isMetaBlock ? 'حجب ميتا الدعائي 🛡️' : 'فشل الإرسال',
                note: errorMsg
            };
        }

        // Check delivery status from Meta
        // Check delivery status from Meta
        switch (deliveryStatus) {
            case 'read': 
                return { 
                    icon: (
                        <div className="flex -space-x-1">
                            <CheckCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500/10" />
                            <CheckCircle className="w-3.5 h-3.5 text-sky-500 fill-sky-500/10" />
                        </div>
                    ), 
                    color: 'text-sky-700', 
                    bg: 'bg-sky-50 border-sky-100', 
                    label: 'تمت القراءة 🔵' 
                };
            case 'delivered': 
                return { 
                    icon: (
                        <div className="flex -space-x-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                    ), 
                    color: 'text-emerald-700', 
                    bg: 'bg-emerald-50 border-emerald-100', 
                    label: 'وصلت (صحين) ✅' 
                };
            case 'bridging':
                return { 
                    icon: <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />, 
                    color: 'text-blue-800', 
                    bg: 'bg-blue-50 border-blue-200', 
                    label: 'بانتظار الموافقة 🌉' 
                };
            case 'sent': 
                return { 
                    icon: <CheckCircle className="w-3.5 h-3.5 text-slate-300" />, 
                    color: 'text-slate-500', 
                    bg: 'bg-slate-50 border-slate-100', 
                    label: 'جاري الإرسال.. 🚚' 
                };
            case 'queued': 
                return { icon: <Clock className="w-4 h-4 animate-pulse text-amber-500" />, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', label: 'في الطابور' };
            case 'failed':
                return { 
                    icon: (
                        <div className="group relative">
                            <XCircle className="w-4 h-4 text-rose-500 cursor-help" />
                            {errorMsg && (
                                <div className="absolute bottom-full right-0 mb-2 invisible group-hover:visible z-50 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl border border-slate-700 leading-relaxed text-right">
                                    <div className="font-bold text-rose-300 mb-1 border-b border-white/10 pb-1">سبب الفشل:</div>
                                    {errorMsg}
                                </div>
                            )}
                        </div>
                    ), 
                    color: 'text-rose-700', 
                    bg: 'bg-rose-50 border-rose-100', 
                    label: 'فشل الإرسال ❌',
                    note: errorMsg
                };
        }

        if (rawStatus === 'sent' && !deliveryStatus) {
            return { 
                icon: <CheckCircle className="w-3.5 h-3.5 text-slate-300" />, 
                color: 'text-slate-500', 
                bg: 'bg-slate-50 border-slate-100', 
                label: 'تم الإرسال.. بانتظار تحديث الحالة',
                note: 'تم إرسال الرسالة بنجاح وننتظر رد نظام الواتساب'
            };
        }

        if (rawStatus === 'sent') return { icon: <CheckCircle className="w-3.5 h-3.5 text-slate-300" />, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-100', label: 'تم الإرسال.. 🚚' };
        if (rawStatus === 'failed') return { icon: <XCircle className="w-4 h-4 text-rose-500" />, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100', label: 'فشل ❌', note: errorMsg };
        
        return { icon: <Clock className="w-4 h-4 text-slate-300" />, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-100', label: 'بانتظار الإرسال' };
    };

    // Helper for RSVP status
    const getRSVPInfo = (status: string) => {
        switch (status) {
            case 'confirmed': return { icon: '✅', label: 'مؤكد', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };
            case 'declined': return { icon: '❌', label: 'معتذر', color: 'text-rose-700 bg-rose-50 border-rose-100' };
            case 'maybe': return { icon: '🤔', label: 'ربما', color: 'text-amber-700 bg-amber-50 border-amber-100' };
            default: return { icon: '⏳', label: 'لا رد', color: 'text-slate-500 bg-slate-50 border-slate-100' };
        }
    };

    return (
        <div className="overflow-x-auto border border-slate-100 rounded-3xl bg-white shadow-sm">
            <table className="w-full text-right">
                <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest text-center">التسلسل</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">اسم الضيف</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">رقم الجوال</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">المرافقين 👥</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">حالة الإرسال</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest text-center">كود الدخول 🎫</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">الرد (RSVP)</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">آخر نشاط</th>
                        <th className="p-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">تحكم</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {guests.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="p-20 text-center">
                                <div className="flex flex-col items-center gap-2 opacity-30">
                                    <Send className="w-12 h-12 text-slate-300" />
                                    <span className="text-sm font-bold text-slate-500">لا يوجد ضيوف في هذه القائمة لبدء التتبع</span>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        guests.map((guest, index) => {
                            // Find the most recent message specifically for the 'invitation' phase to show the journey clearly
                            const msgs = guest.whatsapp_messages || [];
                            const inviteMsg = msgs.findLast((m: any) => m.message_phase === 'invitation') || (msgs.length > 0 ? msgs[msgs.length - 1] : null);
                            
                            const statusInfo = getStatusInfo(
                                guest.status, 
                                inviteMsg?.delivery_status, 
                                inviteMsg?.error_message || guest.custom_fields?.last_meta_error,
                                guest.rsvp_status,
                                inviteMsg?.created_at
                            );
                            const rsvpInfo = getRSVPInfo(guest.rsvp_status);

                            return (
                                <tr key={guest.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="p-4 text-center text-[10px] font-black text-slate-300">{index + 1}</td>
                                    <td className="p-4 font-bold text-slate-700 min-w-[140px]">
                                        <div className="flex items-center gap-2 group/name">
                                            {guest.name}
                                            {onShowLifecycle && (
                                                <button 
                                                    onClick={() => onShowLifecycle(guest)}
                                                    className="p-1 hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 rounded transition-all opacity-0 group-hover/name:opacity-100"
                                                    title="سجل حياة الرسالة"
                                                >
                                                    <Clock className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4" dir="ltr">
                                        {editingPhoneId === guest.id ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => {
                                                    if(onEditPhone) onEditPhone(guest, editPhoneValue);
                                                    setEditingPhoneId(null);
                                                }} className="bg-emerald-500 text-white p-1 rounded-md shadow-sm">
                                                    <Save className="w-3 h-3" />
                                                </button>
                                                <input 
                                                    type="text" 
                                                    value={editPhoneValue} 
                                                    onChange={(e) => setEditPhoneValue(e.target.value)}
                                                    className="w-28 text-xs p-1 border border-indigo-200 rounded-md outline-none text-left font-mono focus:ring-2 ring-indigo-500/20"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group/phone">
                                                <span className={`text-[11px] font-black font-mono transition-colors ${!guest.phone ? 'text-rose-400 italic' : 'text-slate-500 group-hover:text-indigo-600'}`}>
                                                    {guest.phone || 'رقم مفقود'}
                                                </span>
                                                {onEditPhone && (
                                                    <button 
                                                        onClick={() => { setEditingPhoneId(guest.id); setEditPhoneValue(guest.phone || ''); }}
                                                        className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-slate-300 hover:text-indigo-600"
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg w-fit text-[10px] font-black text-slate-500">
                                            {guest.companions_count || 0} مرافقين
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-all ${statusInfo.color} ${statusInfo.bg}`}>
                                                {statusInfo.icon}
                                                {statusInfo.label}
                                            </div>
                                            {statusInfo.note && (
                                                <span className="text-[8px] text-rose-400 font-bold pr-2 max-w-[150px] truncate" title={statusInfo.note}>
                                                    ⚠️ {statusInfo.note}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        {guest.whatsapp_messages?.some((m: any) => m.message_phase === 'qr_code') ? (
                                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black border border-emerald-100">
                                                <span>🎫</span> تم الإرسال
                                            </div>
                                        ) : guest.rsvp_status === 'confirmed' ? (
                                            <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-500 px-3 py-1 rounded-lg text-[10px] font-black border border-indigo-100 animate-pulse">
                                                بانتظار الكرت
                                            </div>
                                        ) : (
                                            <span className="text-slate-100">--</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1.5 min-w-[100px]">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black border ${rsvpInfo.color}`}>
                                                <span>{rsvpInfo.icon}</span>
                                                {rsvpInfo.label}
                                            </div>
                                            {onOverrideStatus && (
                                                <select
                                                    value={guest.rsvp_status || 'pending'}
                                                    onChange={(e) => onOverrideStatus(guest, e.target.value)}
                                                    className="text-[9px] bg-slate-50 border border-slate-100 rounded-lg p-1 text-slate-400 font-bold outline-none cursor-pointer hover:bg-white transition-colors"
                                                >
                                                    <option value="pending">تعديل الرد..</option>
                                                    <option value="confirmed">تأكيد حضور</option>
                                                    <option value="declined">إعتذار</option>
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col text-[9px] font-bold text-slate-400">
                                            {inviteMsg?.updated_at ? (
                                                <>
                                                    <span>{new Date(inviteMsg.updated_at).toLocaleDateString('ar-SA')}</span>
                                                    <span>{new Date(inviteMsg.updated_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </>
                                            ) : '--'}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {guest.status === 'failed' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onRetry(guest)}
                                                    className="bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white h-8 text-[10px] font-black px-3 rounded-xl transition-all"
                                                >
                                                    إعادة إرسال
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onDirectSend(guest)}
                                                className="bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white h-8 text-[10px] font-black px-3 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                                            >
                                                <Send className="w-3 h-3" />
                                                إرسال الآن
                                            </Button>
                                            {onSendTest && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onSendTest(guest)}
                                                    className="bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white h-8 text-[10px] font-black px-3 rounded-xl transition-all flex items-center gap-1"
                                                    title="إرسال تجريبي لرقمك الخاص"
                                                >
                                                    🎯 تجربة
                                                </Button>
                                            )}
                                            {onShowLifecycle && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onShowLifecycle(guest)}
                                                    className="bg-sky-50 border-sky-100 text-sky-600 hover:bg-sky-600 hover:text-white h-8 text-[10px] font-black px-3 rounded-xl transition-all flex items-center gap-1"
                                                    title="معاينة ما يراه الضيف 👀"
                                                >
                                                    👀 معاينة
                                                </Button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={() => onDelete(guest)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="حذف الضيف"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default GuestTable;
