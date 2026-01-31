
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { MessageCircle, Check, Eye, Search } from 'lucide-react';

interface Guest {
    id: string;
    name: string;
    phone: string;
    event_id: string;
    sent_via_whatsapp?: boolean;
}

interface Event {
    id: string;
    name: string;
}

export default function WhatsAppHub() {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        if (selectedEvent) {
            fetchGuests(selectedEvent);
        } else {
            setGuests([]);
        }
    }, [selectedEvent]);

    async function fetchEvents() {
        const { data } = await supabase.from('events').select('id, name');
        if (data) {
            setEvents(data);
            if (data.length > 0) setSelectedEvent(data[0].id);
        }
        setLoading(false);
    }

    async function fetchGuests(eventId: string) {
        setLoading(true);
        const { data } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', eventId);

        if (data) setGuests(data);
        setLoading(false);
    }

    const handleSendWhatsApp = async (guest: Guest) => {
        // 1. Construct the message
        // Use production URL (update this with your actual deployed URL)
        const baseUrl = window.location.hostname === 'localhost'
            ? 'https://lony-invite.netlify.app'  // Replace with your actual domain
            : window.location.origin;

        const landingPageUrl = `${baseUrl}/invite/${guest.id}`;
        const message = `مرحباً ${guest.name}،

نتشرف بدعوتكم لحضور مناسبتنا السعيدة 🌹

يمكنكم الحصول على بطاقة الدعوة وتفاصيل الموقع من خلال الرابط:
${landingPageUrl}

ننتظر تشريفكم!`;

        // 2. Encode for URL
        const encodedMessage = encodeURIComponent(message);

        // 3. Mark as "Sent" in DB (Optimistic update)
        // In a real app, we might want to wait for user confirmation, but for now we assume they click send.
        // Note: We need to add 'sent_via_whatsapp' column to DB if not exists, or just use local state for demo.
        // Let's assume we just track it locally for this session or update if column exists.

        // Open WhatsApp
        const whatsappUrl = `https://wa.me/${guest.phone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');

        // Update DB status
        const { error } = await supabase
            .from('guests')
            .update({ sent_via_whatsapp: true }) // Ensure this column exists in schema or ignore error
            .eq('id', guest.id);

        if (!error) {
            setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, sent_via_whatsapp: true } : g));
        }
    };

    const filteredGuests = guests.filter(g =>
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.phone.includes(searchTerm)
    );

    return (
        <div className="p-6 bg-gray-50 min-h-screen font-cairo" dir="rtl">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">مركز الواتساب الذكي 💬</h1>
                    <p className="text-gray-500">أرسل الدعوات لضيوفك بضغطة زر وبدون حظر</p>
                </div>

                {/* Event Selector */}
                <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="bg-white border text-gray-700 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                >
                    <option value="" disabled>اختر المناسبة</option>
                    {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm">إجمالي الضيوف</p>
                        <h3 className="text-2xl font-bold text-gray-800">{guests.length}</h3>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                        <Check size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm">تم الإرسال</p>
                        <h3 className="text-2xl font-bold text-green-600">
                            {guests.filter(g => g.sent_via_whatsapp).length}
                        </h3>
                    </div>
                    <div className="bg-green-50 p-3 rounded-full text-green-600">
                        <MessageCircle size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm">شاهدوا الدعوة</p>
                        <h3 className="text-2xl font-bold text-purple-600">0</h3> {/* Needs 'viewed_at' logic later */}
                    </div>
                    <div className="bg-purple-50 p-3 rounded-full text-purple-600">
                        <Eye size={24} />
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <input
                    type="text"
                    placeholder="بحث عن ضيف برقم الهاتف أو الاسم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl py-3 px-12 focus:ring-2 focus:ring-green-500 outline-none shadow-sm"
                />
                <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
            </div>

            {/* Guests Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="text-right py-4 px-6 text-gray-500 font-medium text-sm">اسم الضيف</th>
                            <th className="text-right py-4 px-6 text-gray-500 font-medium text-sm">رقم الجوال</th>
                            <th className="text-center py-4 px-6 text-gray-500 font-medium text-sm">الحالة</th>
                            <th className="text-center py-4 px-6 text-gray-500 font-medium text-sm">إجراء</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredGuests.map(guest => (
                            <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-6 text-gray-800 font-medium">{guest.name}</td>
                                <td className="py-4 px-6 text-gray-500 font-mono text-sm" dir="ltr">{guest.phone}</td>
                                <td className="py-4 px-6 text-center">
                                    {guest.sent_via_whatsapp ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            تم الإرسال
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                            لم يرسل
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <button
                                        onClick={() => handleSendWhatsApp(guest)}
                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${guest.sent_via_whatsapp
                                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            : 'bg-green-500 text-white hover:bg-green-600 shadow-md hover:shadow-lg'
                                            }`}
                                    >
                                        <MessageCircle size={16} />
                                        {guest.sent_via_whatsapp ? 'إرسال مرة أخرى' : 'إرسال عبر واتساب'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredGuests.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-gray-400">
                                    لا يوجد ضيوف مطابقين للبحث
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
