import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Guest {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    table_no?: string | null;
    companions_count: number;
    remaining_companions: number;
    category?: string | null;
    status: 'invited' | 'attended' | 'cancelled';
    qr_token?: string;
    card_url?: string | null;
    created_at: string;
}

export const useRealtimeGuests = (eventId: string) => {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;

        const fetchGuests = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('guests')
                    .select('*')
                    .eq('event_id', eventId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setGuests(data || []);
            } catch (err: any) {
                console.error('Error fetching guests:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchGuests();

        // Real-time subscription
        const subscription = supabase
            .channel(`guests_${eventId}`)
            .on('postgres_changes', {
                event: '*', // Listen to INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'guests',
                filter: `event_id=eq.${eventId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setGuests(prev => [payload.new as Guest, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setGuests(prev => prev.map(g =>
                        g.id === payload.new.id ? payload.new as Guest : g
                    ));
                } else if (payload.eventType === 'DELETE') {
                    setGuests(prev => prev.filter(g => g.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };

    }, [eventId]);

    // Calculate stats in real-time
    const stats = {
        total: guests.length,
        attended: guests.filter(g => g.status === 'attended').length,
        pending: guests.filter(g => g.status === 'invited').length,
        companions: guests.reduce((sum, g) => sum + g.companions_count, 0),

        // RSVP Statistics (إحصائيات الرد على الدعوة)
        rsvpConfirmed: guests.filter(g => (g as any).rsvp_status === 'confirmed').length,
        rsvpDeclined: guests.filter(g => (g as any).rsvp_status === 'declined').length,
        rsvpPending: guests.filter(g => !(g as any).rsvp_status || (g as any).rsvp_status === 'pending').length,

        // Legacy stats
        totalCompanions: guests.reduce((sum, g) => sum + g.companions_count, 0),
        admittedCompanions: guests.reduce((sum, g) => sum + (g.companions_count - g.remaining_companions), 0)
    };

    return { guests, stats, loading, error };
};
