import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Trash2, Settings, Copy, Palette, Send, Loader2, Search, Edit3, CalendarCheck, Clock, CheckCircle } from 'lucide-react';
import EventManager from './EventManager';

const AdminEventsPanel: React.FC = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Ensure magic_link_token exists
            const validEvents = data?.map(ev => {
                if (!ev.magic_link_token) {
                    // In a perfect world we would generate this, but let's assume the DB fallback handled it
                    // or generate a mock one for testing if it's missing just so the UI doesn't break.
                    return { ...ev, magic_link_token: ev.id };
                }
                return ev;
            });

            setEvents(validEvents || []);
        } catch (error) {
            console.error('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyMagicLink = (token: string) => {
        const link = `${window.location.origin}/host/${token}`;
        navigator.clipboard.writeText(link);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const navigateToStudio = (eventId: string) => {
        navigate('/studio', { state: { selectedEventId: eventId } });
    };

    const navigateToSender = (eventId: string) => {
        navigate('/whatsapp-sender', { state: { selectedEventId: eventId } });
    };

    const deleteEvent = async (id: string, name: string) => {
        if (!window.confirm(`هل أنت متأكد من حذف المناسبة: "${name}"؟ هذا الإجراء سيقوم بحذف جميع الضيوف والرسائل المرتبطة بها.`)) {
            return;
        }

        // إدخال رمز الأمان للحذف (لحماية البيانات من الحذف الخاطئ)
        const secretCode = window.prompt("أدخل رمز الأمان لإتمام عملية الحذف:");
        if (secretCode !== "3801") {
            alert("رمز الأمان خاطئ. تم إلغاء عملية الحذف.");
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchEvents();
        } catch (error: any) {
            console.error('Error deleting event:', error);
            alert(`حدث خطأ أثناء الحذف: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const filteredEvents = events.filter(e =>
        (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.date && e.date.includes(searchTerm))
    );

    return (
        <div className="space-y-6 font-kufi" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-lony-navy font-amiri">مركز العمليات (Events Panel)</h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة شاملة لجميع المناسبات والتحكم بها</p>
                </div>
                {!editingEvent && (
                    <Button onClick={() => setEditingEvent('new')} className="w-full md:w-auto bg-lony-gold hover:bg-lony-gold/90 text-lony-navy">
                        + إضافة مناسبة جديدة
                    </Button>
                )}
            </div>

            {/* If Editing/Creating an event, show EventManager inline */}
            {editingEvent && (
                <Card className="border-lony-gold/30 border-2 overflow-hidden shadow-xl animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-lony-navy px-6 py-4 flex justify-between items-center">
                        <h2 className="text-white font-bold text-lg">
                            {editingEvent === 'new' ? 'إنشاء مناسبة جديدة' : `تعديل: ${editingEvent.name}`}
                        </h2>
                        <button
                            onClick={() => { setEditingEvent(null); fetchEvents(); }}
                            className="text-white/60 hover:text-white transition-colors text-sm bg-white/10 px-3 py-1 rounded-full"
                        >
                            إغلاق (X)
                        </button>
                    </div>
                    <CardContent className="p-6 bg-gray-50">
                        <EventManager
                            initialEvent={editingEvent === 'new' ? undefined : editingEvent}
                            onSuccess={() => {
                                setEditingEvent(null);
                                fetchEvents();
                            }}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Search Bar */}
            {!editingEvent && (
                <div className="relative max-w-md">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="ابحث عن مناسبة بالاسم أو التاريخ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-lony-gold/50 focus:border-lony-gold transition-all shadow-sm"
                    />
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-10 h-10 animate-spin text-lony-gold" />
                </div>
            ) : (
                <div className="grid grid-cols-1 space-y-4">
                    {!editingEvent && filteredEvents.map((event) => (
                        <Card key={event.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                            <div className="flex flex-col md:flex-row items-center p-0">
                                {/* Details Section */}
                                <div className="p-6 flex-grow border-b md:border-b-0 md:border-l border-gray-100 w-full">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xl font-bold text-lony-navy font-amiri group-hover:text-lony-gold transition-colors">
                                            {event.name || 'بدون اسم'}
                                        </h3>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${(event.date && new Date(event.date + 'T23:59:59') < new Date()) ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'
                                            }`}>
                                            {(event.date && new Date(event.date + 'T23:59:59') < new Date()) ? 'منتهية' : 'نشطة'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-4 mt-4">
                                        <div className="flex items-center text-sm text-gray-600 gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                            <CalendarCheck className="w-4 h-4 text-lony-gold" />
                                            {event.date || 'لم يحدد'}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-600 gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                            <Clock className="w-4 h-4 text-lony-gold" />
                                            الرمز: {event.token || 'لا يوجد'}
                                        </div>
                                        <div className="flex items-center text-sm text-gray-500 w-full mt-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 pr-0 pl-3 flex-shrink-0 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                                                onClick={() => copyMagicLink(event.magic_link_token || event.id)}
                                            >
                                                {copiedToken === (event.magic_link_token || event.id) ? <CheckCircle className="w-4 h-4 ml-1.5" /> : <Copy className="w-4 h-4 ml-1.5" />}
                                                {copiedToken === (event.magic_link_token || event.id) ? 'تم النسخ!' : 'نسخ رابط العميل (Magic Link)'}
                                            </Button>
                                            <span className="text-xs font-mono truncate max-w-xs">{window.location.origin}/host/{(event.magic_link_token || event.id)?.substring(0, 8)}...</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions Section */}
                                <div className="flex md:flex-col w-full md:w-auto p-4 gap-2 bg-gray-50/50 h-full min-h-[140px] justify-center">
                                    {/* Edit is disabled temporarily while we refactor EventManager, but UI is ready */}
                                    <Button
                                        variant="outline"
                                        className="flex-1 md:flex-none justify-start border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                                        onClick={() => setEditingEvent(event)}
                                    >
                                        <Edit3 className="w-4 h-4 ml-2 text-gray-400" />
                                        تعديل
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 md:flex-none justify-start border-blue-200 text-blue-700 hover:bg-blue-50"
                                        onClick={() => navigateToStudio(event.id)}
                                    >
                                        <Palette className="w-4 h-4 ml-2 text-blue-500" />
                                        تصميم الكروت
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 md:flex-none justify-start border-green-200 text-green-700 hover:bg-green-50"
                                        onClick={() => navigateToSender(event.id)}
                                    >
                                        <Send className="w-4 h-4 ml-2 text-green-500" />
                                        إرسال واتساب
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 md:flex-none justify-start border-red-100 text-red-600 hover:bg-red-50"
                                        onClick={() => deleteEvent(event.id, event.name)}
                                    >
                                        <Trash2 className="w-4 h-4 ml-2 text-red-400" />
                                        حذف المناسبة
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {!editingEvent && filteredEvents.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                            <p className="text-gray-500">لا توجد مناسبات مطابقة للبحث</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminEventsPanel;
