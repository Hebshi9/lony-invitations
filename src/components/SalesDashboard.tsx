import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MessageSquare, Phone, Clock, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Conversation {
    id: string;
    phone: string;
    client_name: string;
    status: string;
    priority: string;
    message_count: number;
    overall_intent: string;
    escalated: boolean;
    first_contact_at: string;
    last_contact_at: string;
    conversation_summary: string;
    last_message: string;
    last_ai_response: string;
}

export default function SalesDashboard() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'escalated'>('all');

    useEffect(() => {
        loadConversations();

        // Real-time subscription
        const subscription = supabase
            .channel('sales_changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'sales_conversations' },
                () => loadConversations()
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [filter]);

    const loadConversations = async () => {
        setLoading(true);
        let query = supabase.from('sales_dashboard').select('*');

        if (filter === 'active') query = query.eq('status', 'active');
        if (filter === 'escalated') query = query.eq('escalated', true);

        const { data } = await query.order('last_contact_at', { ascending: false });
        setConversations(data || []);
        setLoading(false);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-50';
            case 'medium': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getIntentIcon = (intent: string) => {
        switch (intent) {
            case 'closing': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
            case 'escalation': return <AlertCircle className="w-4 h-4 text-red-600" />;
            case 'negotiation': return <TrendingUp className="w-4 h-4 text-blue-600" />;
            default: return <MessageSquare className="w-4 h-4 text-gray-600" />;
        }
    };

    const stats = {
        total: conversations.length,
        active: conversations.filter(c => c.status === 'active').length,
        escalated: conversations.filter(c => c.escalated).length,
        highPriority: conversations.filter(c => c.priority === 'high').length
    };

    return (
        <div className="p-6 max-w-7xl mx-auto" dir="rtl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    🤖 لوحة Sales AI
                </h1>
                <p className="text-gray-600">متابعة المحادثات مع العملاء المحتملين</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="text-sm text-gray-600">إجمالي المحادثات</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="text-sm text-gray-600">نشطة</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="text-sm text-gray-600">مصعّدة</div>
                    <div className="text-2xl font-bold text-red-600">{stats.escalated}</div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow border">
                    <div className="text-sm text-gray-600">أولوية عالية</div>
                    <div className="text-2xl font-bold text-orange-600">{stats.highPriority}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                {(['all', 'active', 'escalated'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === f
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border hover:bg-gray-50'
                            }`}
                    >
                        {f === 'all' ? 'الكل' : f === 'active' ? 'نشطة' : 'مصعّدة'}
                    </button>
                ))}
            </div>

            {/* Conversations List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
                ) : conversations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">لا توجد محادثات</div>
                ) : (
                    conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`bg-white rounded-lg shadow border p-4 transition hover:shadow-md ${conv.escalated ? 'border-r-4 border-r-red-500' : ''
                                }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <Phone className="w-5 h-5 text-gray-400" />
                                    <div>
                                        <div className="font-mono text-sm font-bold text-gray-900" dir="ltr">
                                            {conv.phone}
                                        </div>
                                        {conv.client_name && (
                                            <div className="text-xs text-gray-500">{conv.client_name}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {conv.escalated && (
                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                                            🚨 مصعّد
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(conv.priority)}`}>
                                        {conv.priority === 'high' ? 'عالي' : conv.priority === 'medium' ? 'متوسط' : 'عادي'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">آخر رسالة من العميل:</div>
                                    <div className="text-sm text-gray-800 bg-gray-50 p-2 rounded">
                                        {conv.last_message || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">رد AI:</div>
                                    <div className="text-sm text-blue-800 bg-blue-50 p-2 rounded">
                                        {conv.last_ai_response || '-'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        {getIntentIcon(conv.overall_intent)}
                                        <span>{conv.overall_intent || 'غير محدد'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        <span>{conv.message_count} رسالة</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(conv.last_contact_at).toLocaleString('ar-SA')}</span>
                                    </div>
                                </div>
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                    {conv.status}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
