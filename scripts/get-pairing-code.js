import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';

// 👇 Set the phone number without + or spaces
const PHONE_NUMBER = '966569667344';

async function getPairingCode() {
    console.log(`🔄 Generating pairing code for: +${PHONE_NUMBER}`);
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_pairing');

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Chrome', 'Chrome', '108.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait a moment for socket to be ready, THEN request pairing code
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            // When QR is requested, use pairing code instead
            try {
                const code = await sock.requestPairingCode(PHONE_NUMBER);
                console.log(`\n✅ YOUR PAIRING CODE IS: ${code}\n`);
                console.log('👉 On your phone: WhatsApp > Settings > Linked Devices > Link a Device > Link with phone number');
                console.log('👉 Enter the code above');
                console.log('⏳ Waiting for pairing... (90s timeout)\n');
            } catch (err) {
                console.error('❌ Could not get pairing code:', err.message || err);
            }
        }

        if (connection === 'open') {
            console.log(`\n🎉 CONNECTED! User: ${sock.user?.id}`);
            process.exit(0);
        }

        if (connection === 'close') {
            console.log('❌ Connection closed.');
            process.exit(1);
        }
    });

    setTimeout(() => {
        console.log('⌛ Timeout.');
        process.exit(0);
    }, 90000);
}

getPairingCode().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
