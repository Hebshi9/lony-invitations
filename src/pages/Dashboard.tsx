import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabaseClient';
import IntakeRequestList from '../components/IntakeRequestList';
import OrderList from '../components/OrderList';
// import CardTemplateEditor from '../components/CardTemplateEditor';
import { LayoutDashboard, FileInput, ShoppingBag, Palette } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    date: string;
    created_at: string;
}

interface DashboardStats {
    totalEvents: number;
    totalGuests: number;
    sentInvitations: number;
}

const Dashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'intake' | 'orders' | 'templates'>('overview');
    const [stats, setStats] = useState<DashboardStats>({
        totalEvents: 0,
        totalGuests: 0,
        sentInvitations: 0,
    });
    const [recentEvents, setRecentEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (activeTab === 'overview') {
            fetchDashboardData();
        }
    }, [activeTab]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch stats
            const { count: eventsCount } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true });

            const { count: guestsCount } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true });

            // Assuming 'sent' status or just total guests for now if status isn't fully utilized
            const { count: sentCount } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'sent');

            setStats({
                totalEvents: eventsCount || 0,
                totalGuests: guestsCount || 0,
                sentInvitations: sentCount || 0,
            });

            // Fetch recent events
            const { data: events } = await supabase
                .from('events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (events) {
                setRecentEvents(events);
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 text-right">لوحة التحكم</h1>
                <div className="flex gap-2 bg-white p-1 rounded-lg border shadow-sm overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-lony-navy text-white' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        نظرة عامة
                    </button>
                    <button
                        onClick={() => setActiveTab('intake')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'intake' ? 'bg-lony-navy text-white' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <FileInput className="w-4 h-4" />
                        طلبات العملاء
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'orders' ? 'bg-lony-navy text-white' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <ShoppingBag className="w-4 h-4" />
                        الطلبات
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'templates' ? 'bg-lony-navy text-white' : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Palette className="w-4 h-4" />
                        القوالب
                    </button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg text-right">إجمالي الأحداث</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-blue-600 text-right">
                                    {loading ? '...' : stats.totalEvents}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg text-right">إجمالي الضيوف</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-green-600 text-right">
                                    {loading ? '...' : stats.totalGuests}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg text-right">الدعوات المرسلة</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold text-purple-600 text-right">
                                    {loading ? '...' : stats.sentInvitations}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-right">الأحداث الأخيرة</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الحدث</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">التاريخ</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">جاري التحميل...</td>
                                            </tr>
                                        ) : recentEvents.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">لا توجد أحداث حتى الآن</td>
                                            </tr>
                                        ) : (
                                            recentEvents.map((event) => (
                                                <tr key={event.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <Button size="sm" variant="outline">عرض التفاصيل</Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {activeTab === 'intake' && <IntakeRequestList />}
            {activeTab === 'orders' && <OrderList />}
            {/* {activeTab === 'templates' && <CardTemplateEditor />} */}
        </div>
    );
};

export default Dashboard;
