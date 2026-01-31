import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { RefreshCw, CheckCircle, XCircle, Clock, Send, Eye, AlertTriangle } from 'lucide-react';

interface AdminMessage {
    message_id: string;
    guest_name: string;
    phone: string;
    status: string;
    delivery_status: string;
    sent_at: string;
    delivered_at: string;
    read_at: string;
    error_message: string;
    retry_count: number;
    sender_account: string;
    whatsapp_rsvp_status: string;
}

export default function AdminWhatsAppView({ eventId }: { eventId: string }) {
    const [messages, setMessages] = useState<AdminMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'failed' | 'pending'>('all');

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // تحديث كل 5 ثواني
        return () => clearInterval(interval);
    }, [eventId]);

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('admin_whatsapp_view')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });

        if (data) {
            setMessages(data);
        }
        setLoading(false);
    };

    const getFilteredMessages = () => {
        switch (filter) {
            case 'failed':
                return messages.filter(m => m.status === 'failed');
            case 'pending':
                return messages.filter(m => m.status === 'pending' || m.status === 'queued');
            default:
                return messages;
        }
    };

    const getStatusIcon = (msg: AdminMessage) => {
        if (msg.status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
        if (msg.delivery_status === 'read') return <Eye className="w-4 h-4 text-purple-500" />;
        if (msg.delivery_status === 'delivered') return <CheckCircle className="w-4 h-4 text-green-500" />;
        if (msg.status === 'sent') return <Send className="w-4 h-4 text-blue-500" />;
        return <Clock className="w-4 h-4 text-gray-400" />;
    };

    const getStatusText = (msg: AdminMessage) => {
        if (msg.status === 'failed') return 'فشل';
        if (msg.delivery_status === 'read') return 'تم القراءة';
        if (msg.delivery_status === 'delivered') return 'تم التسليم';
        if (msg.status === 'sent') return 'تم الإرسال';
        if (msg.status === 'queued') return 'في القائمة';
        return 'قيد الانتظار';
    };

    const filteredMessages = getFilteredMessages();
    const stats = {
        total: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.delivery_status === 'delivered').length,
        read: messages.filter(m => m.delivery_status === 'read').length,
        failed: messages.filter(m => m.status === 'failed').length,
        pending: messages.filter(m => m.status === 'pending' || m.status === 'queued').length
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>🔧 لوحة المشرف - تتبع WhatsApp</CardTitle>
                    <button
                        onClick={fetchMessages}
                        className="p-2 hover:bg-gray-100 rounded"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </CardHeader>
            <CardContent>
                {/* الإحصائيات */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <div className="text-xs text-gray-600">المجموع</div>
                    </div>
                    <div className="bg-yellow-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                        <div className="text-xs text-gray-600">قيد الإرسال</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
                        <div className="text-xs text-gray-600">تم الإرسال</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                        <div className="text-xs text-gray-600">تم التسليم</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold text-purple-600">{stats.read}</div>
                        <div className="text-xs text-gray-600">تم القراءة</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded text-center">
                        <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                        <div className="text-xs text-gray-600">فشل</div>
                    </div>
                </div>

                {/* الفلاتر */}
                <div className="flex gap-2 mb-4" dir="rtl">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                    >
                        الكل ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilter('pending')}
                        className={`px-4 py-2 rounded ${filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200'}`}
                    >
                        قيد الإرسال ({stats.pending})
                    </button>
                    <button
                        onClick={() => setFilter('failed')}
                        className={`px-4 py-2 rounded ${filter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                    >
                        فشل ({stats.failed})
                    </button>
                </div>

                {/* الجدول */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" dir="rtl">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 text-right">الاسم</th>
                                <th className="p-3 text-right">الرقم</th>
                                <th className="p-3 text-center">الحالة</th>
                                <th className="p-3 text-center">RSVP</th>
                                <th className="p-3 text-right">الحساب المرسل</th>
                                <th className="p-3 text-right">التفاصيل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMessages.map(msg => (
                                <tr key={msg.message_id} className={`border-b hover:bg-gray-50 ${msg.status === 'failed' ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 font-medium">{msg.guest_name || 'غير معروف'}</td>
                                    <td className="p-3 font-mono text-xs">{msg.phone}</td>
                                    <td className="p-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {getStatusIcon(msg)}
                                            <span className="text-xs">{getStatusText(msg)}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {msg.whatsapp_rsvp_status === 'confirmed' && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">✅</span>
                                        )}
                                        {msg.whatsapp_rsvp_status === 'declined' && (
                                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">❌</span>
                                        )}
                                        {msg.whatsapp_rsvp_status === 'maybe' && (
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">❓</span>
                                        )}
                                    </td>
                                    <td className="p-3 font-mono text-xs">{msg.sender_account || '-'}</td>
                                    <td className="p-3">
                                        {msg.error_message && (
                                            <div className="flex items-start gap-2 text-xs text-red-600 max-w-md">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                <div className="break-words">
                                                    <div className="font-bold">خطأ:</div>
                                                    <div className="text-xs">{msg.error_message}</div>
                                                    {msg.retry_count > 0 && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            محاولات: {msg.retry_count}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {msg.read_at && (
                                            <div className="text-xs text-gray-500">
                                                قرأها: {new Date(msg.read_at).toLocaleString('ar-SA', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </div>
                                        )}
                                        {msg.delivered_at && !msg.read_at && (
                                            <div className="text-xs text-gray-500">
                                                وصلت: {new Date(msg.delivered_at).toLocaleString('ar-SA', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </div>
                                        )}
                                        {msg.sent_at && !msg.delivered_at && (
                                            <div className="text-xs text-gray-500">
                                                أُرسلت: {new Date(msg.sent_at).toLocaleString('ar-SA', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short'
                                                })}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredMessages.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            لا توجد رسائل لعرضها
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
