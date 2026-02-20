import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';

async function testInit() {
    console.log('🔄 Starting Baileys test...');
    try {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`✅ Version fetched: ${version} (Latest: ${isLatest})`);

        const { state, saveCreds } = await useMultiFileAuthState('./test_auth');
        console.log('✅ Auth state loaded');

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'debug' }),
            printQRInTerminal: true,
            auth: state
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, qr } = update;
            if (qr) console.log('✅ QR Code generated!');
            if (connection === 'open') console.log('✅ Connected!');
        });

        console.log('🚀 Socket initialized');
    } catch (err) {
        console.error('❌ Crash detected:', err);
    }
}

testInit();
