import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const qrString = "2@4/BnjFe/lKyTM92B2BEBN02IQmYjvV/IRnDRX0Dgc0twbDvIehz7T+GXSObSz+PDqKgr776Cqmxvytjs1MNOvwi2HVuV3VZg+mk=,EaJjs2aoIlxj/93Xagq22q5dMSHNcDNm/+kt++oAJ18=,ZWcKbPED8SzngeHkPG5REZS69sSIwRcwUbvvjac8QBc=,kbycVt2j3gu+s8dPSuuSBj236V6Ca0dDtFeIqOqjh6k=";
const outputPath = path.resolve('C:/Users/user/.gemini/antigravity/brain/ca6f0c21-c4d8-48dd-bf07-b754b6cede46/whatsapp_qr.png');

async function generateQR() {
    try {
        await QRCode.toFile(outputPath, qrString, {
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            width: 500
        });
        console.log(`✅ QR Image generated at: ${outputPath}`);
    } catch (err) {
        console.error('❌ Error generating QR image:', err);
    }
}

generateQR();
