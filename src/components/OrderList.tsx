import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabaseClient';
import { Order } from '../types';
import { Edit, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const OrderList: React.FC = () => {
    const [orders, setOrders] = useState<any[]>([]); // Using any for joined data
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            // Join with clients and events to get names
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    clients (name, email),
                    events (name, date)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-center py-8">جاري التحميل...</div>;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-right">الطلبات النشطة</CardTitle>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">لا توجد طلبات نشطة</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm font-bold">
                                <tr>
                                    <th className="p-4">رقم الطلب</th>
                                    <th className="p-4">العميل</th>
                                    <th className="p-4">الحدث</th>
                                    <th className="p-4">المرحلة</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono text-xs text-gray-500">{order.id.slice(0, 8)}...</td>
                                        <td className="p-4 font-bold text-lony-navy">
                                            {order.clients?.name || 'غير مسجل'}
                                        </td>
                                        <td className="p-4">
                                            {order.events?.name || 'بدون حدث'}
                                            <div className="text-xs text-gray-400">{order.events?.date}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-bold">
                                                {order.workflow_stage}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                order.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => navigate(`/portal/${order.id}`)}>
                                                <Eye className="w-4 h-4 ml-2" />
                                                عرض
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => window.location.href = `/orders/${order.id}`}>
                                                التفاصيل
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default OrderList;
