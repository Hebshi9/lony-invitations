import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrdersCanvasData() {
    console.log('Fetching all orders with canvas_data...');
    const { data: orders, error } = await supabase.from('orders').select('id, canvas_data').not('canvas_data', 'is', null);

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    let updatedCount = 0;

    for (const order of orders) {
        if (!order.canvas_data || !Array.isArray(order.canvas_data)) continue;

        let modified = false;
        const newCanvasData = order.canvas_data.map(el => {
            if (el.type === 'qr' && el.qrUrl) {
                if (el.qrUrl.includes('lonyinvite.netlify.app')) {
                    console.log(`Found old URL in order [${order.id}], updating to lonyinvit...`);
                    el.qrUrl = el.qrUrl.replace('lonyinvite.netlify.app', 'lonyinvit.netlify.app');
                    modified = true;
                }
            }
            return el;
        });

        if (modified) {
            console.log(`Saving update for order: ${order.id}`);
            const { error: updateError } = await supabase
                .from('orders')
                .update({ canvas_data: newCanvasData })
                .eq('id', order.id);

            if (updateError) {
                console.error(`Failed to update order ${order.id}:`, updateError);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`✅ Finished checking orders. Updated ${updatedCount} orders.`);
    console.log(`All QR codes in the studio are now fixed!`);
}

fixOrdersCanvasData();
