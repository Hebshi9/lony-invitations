import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface ActivityLog {
    id: string;
    created_at: string;
    guest_id: string;
    event_id: string;
    scan_type: 'entry' | 'exit' | 'info';
    status: 'success' | 'failed' | 'warning';
    scanned_by?: string;
    device_info?: any;
    companions_admitted: number;
    failure_reason?: string;
    guests?: {
        name: string;
        category?: string;
        table_no?: string;
    };
}

export const useGuestActivity = (eventId: string) => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;

        const fetchLogs = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('guest_activity_logs')
                    .select(`
                        *,
                        guests (
                            name,
                            category,
                            table_no
                        )
                    `)
                    .eq('event_id', eventId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setLogs(data || []);
            } catch (err: any) {
                console.error('Error fetching activity logs:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();

        // Real-time subscription
        const subscription = supabase
            .channel(`activity_logs_${eventId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'guest_activity_logs',
                filter: `event_id=eq.${eventId}`
            }, (payload) => {
                const newLog = payload.new as ActivityLog;
                // Fetch guest details for the new log
                supabase
                    .from('guests')
                    .select('name, category, table_no')
                    .eq('id', newLog.guest_id)
                    .single()
                    .then(({ data }) => {
                        if (data) {
                            setLogs(prev => [{ ...newLog, guests: data }, ...prev]);
                        }
                    });
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };

    }, [eventId]);

    return { logs, loading, error };
};
