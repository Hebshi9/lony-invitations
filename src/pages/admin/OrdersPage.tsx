import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Order, OrderStatus, WorkflowStage, getStageInfo } from '../../types/workflow';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Search, Filter, Plus, Eye, Trash2, Clock, User, Package } from 'lucide-react';

const OrdersPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteOrder = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

        try {
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            alert('حدث خطأ في الحذف');
        }
    };

    const getStatusBadge = (status: OrderStatus) => {
        const colors: Record<OrderStatus, string> = {
            'pending_review': 'bg-yellow-100 text-yellow-800',
            'needs_clarification': 'bg-orange-100 text-orange-800',
            'approved': 'bg-blue-100 text-blue-800',
            'event_created': 'bg-indigo-100 text-indigo-800',
            'processing_guests': 'bg-purple-100 text-purple-800',
            'guests_imported': 'bg-purple-100 text-purple-800',
            'designing': 'bg-pink-100 text-pink-800',
            'design_ready': 'bg-pink-100 text-pink-800',
            'generating': 'bg-orange-100 text-orange-800',
            'generated': 'bg-teal-100 text-teal-800',
            'ready_for_delivery': 'bg-green-100 text-green-800',
            'delivered': 'bg-green-100 text-green-800',
            'completed': 'bg-green-600 text-white',
            'cancelled': 'bg-red-100 text-red-800',
            'on_hold': 'bg-gray-100 text-gray-800'
        };

        const labels: Record<OrderStatus, string> = {
            'pending_review': 'قيد المراجعة',
            'needs_clarification': 'يحتاج توضيح',
            'approved': 'معتمد',
            'event_created': 'تم إنشاء الحدث',
            'processing_guests': 'معالجة الضيوف',
            'guests_imported': 'تم استيراد الضيوف',
            'designing': 'جاري التصميم',
            'design_ready': 'التصميم جاهز',
            'generating': 'جاري التوليد',
            'generated': 'تم التوليد',
            'ready_for_delivery': 'جاهز للتسليم',
            'delivered': 'تم التسليم',
            'completed': 'مكتمل',
            'cancelled': 'ملغي',
            'on_hold': 'معلق'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
                {labels[status]}
            </span>
        );
    };

    const filteredOrders = orders
        .filter(order => statusFilter === 'all' || order.status === statusFilter)
        .filter(order => 
            order.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.client_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.id.includes(searchTerm)
        );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lony-gold mx-auto"></div>
                    <p className="mt-4 text-gray-600">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6" dir="rtl">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-lony-navy flex items-center gap-2">
                            <Package className="w-8 h-8" />
                            إدارة الطلبات
                        </h1>
                        <p className="text-gray-600 mt-1">
                            إجمالي الطلبات: {orders.length}
                        </p>
                    </div>
                    <Button className="bg-lony-gold text-white hover:bg-lony-gold/90">
                        <Plus className="w-4 h-4 ml-2" />
                        طلب جديد
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="ابحث بالاسم، الإيميل، أو رقم الطلب..."
                            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lony-gold focus:border-transparent"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lony-gold"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                    >
                        <option value="all">جميع الحالات</option>
                        <option value="pending_review">قيد المراجعة</option>
                        <option value="approved">معتمد</option>
                        <option value="designing">جاري التصميم</option>
                        <option value="generating">جاري التوليد</option>
                        <option value="completed">مكتمل</option>
                        <option value="cancelled">ملغي</option>
                    </select>
                </div>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-12">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-600 mb-2">
                            {searchTerm || statusFilter !== 'all' ? 'لا توجد نتائج' : 'لا توجد طلبات'}
                        </h3>
                        <p className="text-gray-500">
                            {searchTerm || statusFilter !== 'all' ? 'جرب تغيير الفلتر أو البحث' : 'ابدأ بإنشاء طلب جديد'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    رقم الطلب
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    العميل
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    نوع الفعالية
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    الحالة
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    المرحلة
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    التاريخ
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    إجراءات
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredOrders.map((order) => {
                                const stageInfo = getStageInfo(order.workflow_stage);
                                return (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-mono text-gray-900">
                                                #{order.id.slice(0, 8)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-gray-400" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {order.client_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {order.client_email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {order.event_type || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(order.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl">{stageInfo.icon}</span>
                                                <span className="text-sm text-gray-600">
                                                    {stageInfo.label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                <Clock className="w-4 h-4" />
                                                {new Date(order.created_at).toLocaleDateString('ar-SA')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center gap-2">
                                                <Link to={`/admin/orders/${order.id}`}>
                                                    <Button variant="outline" className="flex items-center gap-1">
                                                        <Eye className="w-4 h-4" />
                                                        عرض
                                                    </Button>
                                                </Link>
                                                <button
                                                    onClick={() => deleteOrder(order.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OrdersPage;
