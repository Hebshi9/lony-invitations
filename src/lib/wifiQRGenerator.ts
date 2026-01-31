import QRCodeLib from 'qrcode';

/**
 * WiFi QR Code Generator
 * Generates QR codes that automatically connect devices to WiFi networks
 */

export type WiFiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface WiFiConfig {
    ssid: string;
    password?: string;
    security: WiFiSecurity;
    hidden?: boolean;
}

/**
 * Generate WiFi QR Code as Data URL
 * Format: WIFI:T:WPA;S:MyNetwork;P:MyPassword;H:false;;
 */
export async function generateWiFiQR(config: WiFiConfig): Promise<string> {
    const { ssid, password = '', security, hidden = false } = config;

    // Build WiFi string according to standard format
    const wifiString = `WIFI:T:${security};S:${escapeSpecialChars(ssid)};P:${escapeSpecialChars(password)};H:${hidden};;`;

    try {
        const qrDataUrl = await QRCodeLib.toDataURL(wifiString, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return qrDataUrl;
    } catch (error) {
        console.error('Error generating WiFi QR:', error);
        throw new Error('Failed to generate WiFi QR code');
    }
}

/**
 * Generate WiFi QR Code as Base64 string (without data URL prefix)
 */
export async function generateWiFiQRBase64(config: WiFiConfig): Promise<string> {
    const dataUrl = await generateWiFiQR(config);
    // Remove "data:image/png;base64," prefix
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * Generate WiFi QR Code as Buffer (for server-side usage)
 */
export async function generateWiFiQRBuffer(config: WiFiConfig): Promise<Buffer> {
    const { ssid, password = '', security, hidden = false } = config;
    const wifiString = `WIFI:T:${security};S:${escapeSpecialChars(ssid)};P:${escapeSpecialChars(password)};H:${hidden};;`;

    try {
        const buffer = await QRCodeLib.toBuffer(wifiString, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M'
        });

        return buffer;
    } catch (error) {
        console.error('Error generating WiFi QR buffer:', error);
        throw new Error('Failed to generate WiFi QR buffer');
    }
}

/**
 * Escape special characters in WiFi SSID and password
 * Special chars: \ ; , " :
 */
function escapeSpecialChars(str: string): string {
    return str
        .replace(/\\/g, '\\\\')  // Backslash
        .replace(/;/g, '\\;')    // Semicolon
        .replace(/,/g, '\\,')    // Comma
        .replace(/"/g, '\\"')    // Quote
        .replace(/:/g, '\\:');   // Colon
}

/**
 * Validate WiFi configuration
 */
export function validateWiFiConfig(config: WiFiConfig): { valid: boolean; error?: string } {
    if (!config.ssid || config.ssid.trim() === '') {
        return { valid: false, error: 'SSID is required' };
    }

    if (config.ssid.length > 32) {
        return { valid: false, error: 'SSID must be 32 characters or less' };
    }

    if (config.security !== 'nopass' && (!config.password || config.password.trim() === '')) {
        return { valid: false, error: 'Password is required for secured networks' };
    }

    if (config.password && config.password.length < 8 && config.security === 'WPA') {
        return { valid: false, error: 'WPA password must be at least 8 characters' };
    }

    return { valid: true };
}

/**
 * Example usage:
 * 
 * const qrDataUrl = await generateWiFiQR({
 *   ssid: 'MyWiFi',
 *   password: 'SecurePass123',
 *   security: 'WPA'
 * });
 * 
 * <img src={qrDataUrl} alt="WiFi QR Code" />
 */
