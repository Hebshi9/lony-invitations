import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';

const OUTPUT_PATH = 'C:/Users/user/.gemini/antigravity/brain/ca6f0c21-c4d8-48dd-bf07-b754b6cede46/whatsapp_qr.png';

async function generateQR() {
    console.log('🔄 Starting fresh QR code generation...');
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_qr_test');

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Chrome', 'Chrome', '108.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            console.log('✅ QR received! Saving image...');
            await QRCode.toFile(OUTPUT_PATH, qr, {
                color: { dark: '#000000', light: '#ffffff' },
                width: 512,
                margin: 2,
            });
            console.log(`✅ QR image saved to: ${OUTPUT_PATH}`);
            console.log('⏳ Waiting for scan... (will exit after 90 seconds or on success)');
        }

        if (connection === 'open') {
            console.log(`✅ WhatsApp connected! User: ${JSON.stringify(sock.user)}`);
            process.exit(0);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.message;
            console.log(`❌ Connection closed: ${reason}`);
            process.exit(1);
        }
    });

    // Auto-exit after 90 seconds
    setTimeout(() => {
        console.log('⌛ Timeout - exiting.');
        process.exit(0);
    }, 90000);
}

generateQR().catch(err => {
    console.error('❌ Fatal:', err);
    process.exit(1);
});
