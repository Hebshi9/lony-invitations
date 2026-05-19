import fetch from 'node-fetch';

async function checkStorageFile() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    const guestId = '6e90b323-6bc5-4f80-9117-2ab727f20772';
    
    const formats = ['jpg', 'png', 'jpeg'];
    
    console.log(`🔍 Checking storage for event ${eventId}, guest ${guestId}...`);
    
    for (const ext of formats) {
        const url = `https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/${eventId}/${guestId}.${ext}`;
        console.log(`Checking: ${url}`);
        
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) {
                console.log(`✅ FOUND! Format: ${ext}`);
                console.log(`URL: ${url}`);
                return;
            } else {
                console.log(`❌ Not found (${res.status})`);
            }
        } catch (e) {
            console.error(`Error: ${e.message}`);
        }
    }
    
    console.log('\n--- Checking another guest in the same event ---');
    // Let's try to list files in that folder if we can't find yours
}

checkStorageFile();
