
const { spawn } = require('child_process');

const password = 'AHMEDhebshi12';
const host = '62.171.172.76';
const remoteCommand = `cd /www/wwwroot/lony-sendingwa/ && rm api/whatsapp-server-simple.js && cat << 'EOF' > api/whatsapp-server-simple.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
app.use(cors());
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok', synergy: true }));
app.post('/api/campaign/start', async (req, res) => {
    const { guestIds, eventId } = req.body;
    res.json({ success: true, message: 'Synergy Active' });
    try {
        const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
        const { data: guests } = await supabase.from('guests').select('*').in('id', guestIds);
        if (!guests || !event) return console.log('Missing data');
        for (const guest of guests) {
            const url = 'https://graph.facebook.com/v21.0/' + process.env.META_PHONE_NUMBER_ID + '/messages';
            let phone = guest.phone.replace(/[^0-9]/g, '');
            if (phone.startsWith('05')) phone = '966' + phone.substring(1);
            if (phone.startsWith('00')) phone = phone.substring(2);
            const payload = {
                messaging_product: "whatsapp", to: phone, type: "template",
                template: { name: "lony", language: { code: "ar" },
                    components: [
                        { type: "header", parameters: [{ type: "image", image: { link: guest.card_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png' } }] },
                        { type: "body", parameters: [
                            { type: "text", text: guest.name || 'ضيفنا' },
                            { type: "text", text: event.settings?.groom_name || 'مشاري' },
                            { type: "text", text: event.settings?.bride_name || 'رهف' },
                            { type: "text", text: event.date || 'قريباً' },
                            { type: "text", text: event.location || 'موقع الحفل' }
                        ]}
                    ]
                }
            };
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + process.env.META_ACCESS_TOKEN, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const meta = await r.json();
            if (r.ok) {
                console.log('✅ Sent to ' + guest.name);
                await supabase.from('whatsapp_messages').insert([{
                    event_id: eventId, guest_id: guest.id, message_phase: 'invitation', status: 'sent', meta_message_id: meta.messages[0].id
                }]);
                await supabase.from('guests').update({ last_message_status: 'sent' }).eq('id', guest.id);
            } else {
                console.error('❌ Meta Error for ' + guest.name + ':', JSON.stringify(meta));
            }
            await new Promise(res => setTimeout(res, 1000));
        }
    } catch (err) { console.error('VPS Loop Error:', err.message); }
});
app.listen(3001, '0.0.0.0', () => console.log('🚀 Final Meta Synergy LIVE on 3001'));
EOF
pm2 restart lony-adapter --update-env`;

console.log('Starting VPS Update...');

const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', `root@${host}`, remoteCommand], {
    stdio: ['pipe', 'inherit', 'inherit']
});

ssh.on('error', (err) => console.error('Failed to start SSH:', err));

// Password handling is tricky with standard ssh. 
// If this script is run on the user's machine, it might still prompt.
// However, the user said "proceed by your self".

ssh.on('close', (code) => {
    console.log(`SSH process exited with code ${code}`);
});
