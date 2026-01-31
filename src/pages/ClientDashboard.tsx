import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent } from '../components/ui/Card';
import { Loader2, Users, CheckCircle, PieChart, Activity } from 'lucide-react';

const ClientDashboard: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [totalGuests, setTotalGuests] = useState(0);
    const [attendedGuests, setAttendedGuests] = useState(0);

    useEffect(() => {
        fetchStats();
        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [eventId]);

    const fetchStats = async () => {
        try {
            // Get total count
            const { count: total, error: err1 } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId);

            if (err1) throw err1;
            setTotalGuests(total || 0);

            // Get attended count
            const { count: attended, error: err2 } = await supabase
                .from('guests')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'attended');

            if (err2) throw err2;
            setAttendedGuests(attended || 0);

            setLoading(false);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-lony-gold w-10 h-10" />
        </div>
    );

    const percentage = totalGuests > 0 ? Math.round((attendedGuests / totalGuests) * 100) : 0;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans" dir="rtl">
            {/* Header */}
            <div className="bg-lony-navy text-white p-6 rounded-b-[2rem] shadow-xl">
                <div className="flex items-center gap-3 mb-2 opacity-80">
                    <Activity className="w-5 h-5" />
                    <span className="text-xs uppercase tracking-widest">Live Event Monitor</span>
                </div>
                <h1 className="text-2xl font-bold font-serif">لوحة العميل المباشرة</h1>
                <p className="text-white/60 text-sm">تحديث تلقائي كل 30 ثانية</p>
            </div>

            <div className="p-6 -mt-8 space-y-4">
                {/* Main Stats Card */}
                <Card className="border-none shadow-xl overflow-hidden">
                    <div className="bg-lony-gold p-1"></div>
                    <CardContent className="p-6 text-center">
                        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-8 border-gray-100 mb-4 relative">
                            <span className="text-4xl font-bold text-lony-navy">{percentage}%</span>
                            <span className="absolute -bottom-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">نسبة الحضور</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">
                            <div>
                                <p className="text-gray-400 text-xs uppercase mb-1">الضيوف بالداخل</p>
                                <p className="text-2xl font-bold text-lony-navy">{attendedGuests}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs uppercase mb-1">إجمالي المدعوين</p>
                                <p className="text-2xl font-bold text-gray-400">{totalGuests}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-blue-50 border-blue-100">
                        <CardContent className="p-4 flex flex-col items-center justify-center h-32">
                            <Users className="w-8 h-8 text-blue-500 mb-2" />
                            <span className="font-bold text-blue-800">المتبقي</span>
                            <span className="text-2xl text-blue-600">{totalGuests - attendedGuests}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-100">
                        <CardContent className="p-4 flex flex-col items-center justify-center h-32">
                            <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                            <span className="font-bold text-green-800">وصل الآن</span>
                            <span className="text-2xl text-green-600">{attendedGuests}</span>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center mt-8 opacity-50">
                    <img src="/logo.png" className="h-6 mx-auto mb-2 grayscale" alt="Lony" />
                    <p className="text-xs text-gray-400">Powered by Lony Invitations</p>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
