import React from 'react';
import {
    CheckCircle, XCircle, Clock, AlertTriangle, MessageCircle, HelpCircle, RefreshCcw
} from 'lucide-react';
import { Button } from '../ui/Button';

interface GuestTableProps {
    guests: any[];
    onRetry: (guest: any) => void;
    onOverrideStatus?: (guest: any, newStatus: string) => void;
}

const GuestTable: React.FC<GuestTableProps> = ({ guests, onRetry, onOverrideStatus }) => {

    // Helper to get status icon and color
    const getStatusInfo = (status: string, phase: string) => {
        switch (status) {
            case 'sent': return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500', bg: 'bg-green-50', label: 'تم الإرسال' };
            case 'delivered': return { icon: <CheckCircle className="w-4 h-4 fill-green-500 text-white" />, color: 'text-green-600', bg: 'bg-green-100', label: 'وصلت' };
            case 'read': return { icon: <CheckCircle className="w-4 h-4 fill-blue-500 text-white" />, color: 'text-blue-600', bg: 'bg-blue-100', label: 'قرأها' };
            case 'failed': return { icon: <XCircle className="w-4 h-4" />, color: 'text-red-500', bg: 'bg-red-50', label: 'فشل' };
            case 'queued': return { icon: <Clock className="w-4 h-4 animate-pulse" />, color: 'text-orange-500', bg: 'bg-orange-50', label: 'في الطابور' };
            default: return { icon: <Clock className="w-4 h-4" />, color: 'text-gray-400', bg: 'bg-gray-50', label: 'انتظار' };
        }
    };

    // Helper for RSVP status
    const getRSVPInfo = (status: string) => {
        switch (status) {
            case 'confirmed': return { icon: '✅', label: 'مؤكد', color: 'text-green-700 bg-green-100' };
            case 'declined': return { icon: '❌', label: 'معتذر', color: 'text-red-700 bg-red-100' };
            case 'maybe': return { icon: '🤔', label: 'ربما', color: 'text-orange-700 bg-orange-100' };
            case 'inquiry': return { icon: '❓', label: 'استفسار', color: 'text-blue-700 bg-blue-100' };
            default: return { icon: '⬜', label: 'لا رد', color: 'text-gray-500 bg-gray-100' };
        }
    };

    return (
        <div className="overflow-x-auto border rounded-lg shadow-sm">
            <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="p-3 font-medium text-gray-600">#</th>
                        <th className="p-3 font-medium text-gray-600">الضيف</th>
                        <th className="p-3 font-medium text-gray-600">الجوال</th>
                        <th className="p-3 font-medium text-gray-600">حالة الإرسال</th>
                        <th className="p-3 font-medium text-gray-600">حالة الرد (RSVP)</th>
                        <th className="p-3 font-medium text-gray-600">إجراءات</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {guests.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-gray-500">
                                لا يوجد ضيوف لعرضهم
                            </td>
                        </tr>
                    ) : (
                        guests.map((guest, index) => {
                            // Find the most relevant message status (priority: failed -> read -> delivered -> sent -> queued -> pending)
                            // For simplicity, we assume the guest object passed here already has the latest message status merged or we find it.
                            // UPDATE: The parent component should map guests to include their latest message status.

                            const statusInfo = getStatusInfo(guest.last_message_status || 'pending', guest.last_message_phase);
                            const rsvpInfo = getRSVPInfo(guest.rsvp_status);

                            return (
                                <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 text-gray-500">{index + 1}</td>
                                    <td className="p-3 font-medium text-gray-900">{guest.name}</td>
                                    <td className="p-3 text-gray-600 font-mono text-xs" dir="ltr">{guest.phone}</td>
                                    <td className="p-3">
                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bg}`}>
                                            {statusInfo.icon}
                                            {statusInfo.label}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col gap-1 items-end">
                                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${rsvpInfo.color}`}>
                                                <span>{rsvpInfo.icon}</span>
                                                {rsvpInfo.label}
                                            </div>
                                            {onOverrideStatus && (
                                                <select
                                                    value={guest.rsvp_status || 'pending'}
                                                    onChange={(e) => onOverrideStatus(guest, e.target.value)}
                                                    className="text-[10px] mt-1 border border-gray-200 rounded p-0.5 bg-white text-gray-600 focus:ring-1 focus:ring-lony-gold w-20 cursor-pointer"
                                                >
                                                    <option value="pending">تعيين يديوي..</option>
                                                    <option value="confirmed">تأكيد حضور</option>
                                                    <option value="declined">إعتذار</option>
                                                    <option value="maybe">ربما</option>
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        {guest.last_message_status === 'failed' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onRetry(guest)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                                            >
                                                <RefreshCcw className="w-3 h-3 ml-1" />
                                                إعادة
                                            </Button>
                                        )}
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
