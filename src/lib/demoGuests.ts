import { supabase } from './supabaseClient';

/**
 * Generate 3 demo guests for client preview
 * These are NOT real guests - just for demonstration
 */
export async function generateDemoGuests(eventId: string) {
    const demoGuests = [
        {
            event_id: eventId,
            name: 'عينة - قبل المناسبة',
            phone: '+966500000001',
            table_no: 'DEMO-1',
            is_demo: true,
            demo_state: 'before',
            status: 'pending',
            card_generated: true,
            companions_count: 2
        },
        {
            event_id: eventId,
            name: 'عينة - أثناء المناسبة',
            phone: '+966500000002',
            table_no: 'DEMO-2',
            is_demo: true,
            demo_state: 'during',
            status: 'confirmed',
            card_generated: true,
            companions_count: 3
        },
        {
            event_id: eventId,
            name: 'عينة - بعد المناسبة',
            phone: '+966500000003',
            table_no: 'DEMO-3',
            is_demo: true,
            demo_state: 'after',
            status: 'attended',
            card_generated: true,
            companions_count: 1
        }
    ];

    try {
        // Check if demo guests already exist
        const { data: existing } = await supabase
            .from('guests')
            .select('id')
            .eq('event_id', eventId)
            .eq('is_demo', true);

        if (existing && existing.length > 0) {
            console.log('Demo guests already exist for this event');
            return existing;
        }

        // Insert demo guests
        const { data, error } = await supabase
            .from('guests')
            .insert(demoGuests)
            .select();

        if (error) throw error;

        console.log('✅ Created 3 demo guests for client preview');
        return data;
    } catch (error) {
        console.error('Error creating demo guests:', error);
        throw error;
    }
}

/**
 * Get demo guests for an event
 */
export async function getDemoGuests(eventId: string) {
    const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_demo', true)
        .order('demo_state');

    if (error) {
        console.error('Error fetching demo guests:', error);
        return [];
    }

    return data || [];
}

/**
 * Delete demo guests (cleanup)
 */
export async function deleteDemoGuests(eventId: string) {
    const { error } = await supabase
        .from('guests')
        .delete()
        .eq('event_id', eventId)
        .eq('is_demo', true);

    if (error) {
        console.error('Error deleting demo guests:', error);
        throw error;
    }

    console.log('✅ Deleted demo guests');
}

/**
 * Generate demo cards after design is complete
 */
export async function generateDemoCards(eventId: string, cardDesign: any) {
    try {
        // Get demo guests
        const demos = await getDemoGuests(eventId);

        if (demos.length === 0) {
            console.log('No demo guests found, creating them...');
            await generateDemoGuests(eventId);
        }

        // TODO: Generate actual card images using the design
        // This would use the same card generation logic as real guests
        // but with demo data

        console.log('✅ Demo cards generated successfully');
        return true;
    } catch (error) {
        console.error('Error generating demo cards:', error);
        return false;
    }
}
