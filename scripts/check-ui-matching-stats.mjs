import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function run() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error(error);
        return;
    }

    const failedCount = guests.filter((g) => 
        g.status === 'failed' || 
        g.whatsapp_messages?.some((m) => m.status === 'failed' || m.delivery_status === 'failed')
    ).length;

    const bridgingCount = guests.filter((g) => 
        g.status === 'bridging' || 
        g.whatsapp_messages?.some((m) => m.delivery_status === 'bridging')
    ).length;

    const stats = {
        total: guests.length,
        sent: guests.filter((g) => g.status === 'sent').length,
        delivered: guests.filter((g) => g.whatsapp_messages?.some((m) => m.delivery_status === 'delivered' || m.delivery_status === 'read')).length,
        read: guests.filter((g) => g.whatsapp_messages?.some((m) => m.delivery_status === 'read') || (g.rsvp_status && g.rsvp_status !== 'none' && g.rsvp_status !== 'pending')).length,
        failed: failedCount,
        confirmed: guests.filter((g) => g.rsvp_status === 'confirmed').length,
        declined: guests.filter((g) => g.rsvp_status === 'declined').length,
        maybe: guests.filter((g) => g.rsvp_status === 'maybe').length,
        entered: guests.filter((g) => g.checked_in).length,
        bridging: bridgingCount,
        no_response: guests.filter((g) => {
            const isSentOrReached = g.status === 'sent' || g.whatsapp_messages?.some((m) => m.delivery_status === 'delivered' || m.delivery_status === 'read');
            const noRsvp = !g.rsvp_status || g.rsvp_status === 'none' || g.rsvp_status === 'pending';
            const isNotFailed = g.status !== 'failed' && !g.whatsapp_messages?.some((m) => m.status === 'failed' || m.delivery_status === 'failed');
            return isSentOrReached && noRsvp && isNotFailed;
        }).length
    };

    console.log(JSON.stringify(stats, null, 2));
}

run();
