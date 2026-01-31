import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';
import { IntakeRequest } from '../types';
import { CheckCircle, Clock, FileText } from 'lucide-react';

const IntakeRequestList: React.FC = () => {
    const [requests, setRequests] = useState<IntakeRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('client_intake_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRequests(data || []);
        } catch (error) {
            console.error('Error fetching intake requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id: string, newStatus: 'processing' | 'processed' | 'converted') => {
        try {
            const { error } = await supabase
                .from('client_intake_requests')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            fetchRequests(); // Refresh list
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    if (loading) return <div className="text-center py-8">جاري التحميل...</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-right">طلبات العملاء الجديدة</CardTitle>
            </CardHeader>
            <CardContent>
                {requests.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">لا توجد طلبات جديدة</div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((req) => (
                            <div key={req.id} className="border rounded-lg p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white hover:shadow-sm transition-shadow">
                                <div className="flex-1 text-right">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-lony-navy">{req.client_name || 'عميل غير معروف'}</h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${req.status === 'new' ? 'bg-blue-100 text-blue-700' :
                                            req.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                req.status === 'converted' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-600'
                                            }`}>
                                            {req.status === 'new' ? 'جديد' :
                                                req.status === 'processing' ? 'قيد المعالجة' :
                                                    req.status === 'converted' ? 'تم التحويل' : req.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        {new Date(req.created_at).toLocaleDateString('ar-EG')}
                                    </p>
                                    <div className="mt-2 text-sm text-gray-700">
                                        <p><strong>الهاتف:</strong> {req.client_phone}</p>
                                        {req.event_details && (
                                            <p><strong>الحدث:</strong> {req.event_details.title} ({req.event_details.date})</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {req.status === 'new' && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => handleStatusUpdate(req.id, 'processing')}>
                                                بدء المعالجة
                                            </Button>
                                        </>
                                    )}
                                    {req.status === 'processing' && (
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusUpdate(req.id, 'converted')}>
                                            <CheckCircle className="w-4 h-4 ml-2" />
                                            تحويل لطلب
                                        </Button>
                                    )}
                                    {req.guest_list_url && (
                                        <Button size="sm" variant="ghost" onClick={() => { if (req.guest_list_url) window.open(req.guest_list_url, '_blank'); }}>
                                            <FileText className="w-4 h-4 ml-2" />
                                            ملف الضيوف
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default IntakeRequestList;
