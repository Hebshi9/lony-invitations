import QRCodeLib from 'qrcode';

/**
 * Location QR Code Generator
 * Generates QR codes that open locations in Google Maps
 */

export interface LocationConfig {
    // Option 1: Use coordinates
    lat?: number;
    lng?: number;

    // Option 2: Use address string
    address?: string;

    // Optional: Place name
    name?: string;
}

/**
 * Generate Google Maps QR Code from coordinates
 */
export async function generateLocationQR(config: LocationConfig): Promise<string> {
    const mapsUrl = buildMapsUrl(config);

    try {
        const qrDataUrl = await QRCodeLib.toDataURL(mapsUrl, {
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
        console.error('Error generating location QR:', error);
        throw new Error('Failed to generate location QR code');
    }
}

/**
 * Generate Location QR Code as Base64
 */
export async function generateLocationQRBase64(config: LocationConfig): Promise<string> {
    const dataUrl = await generateLocationQR(config);
    return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}

/**
 * Build Google Maps URL from location config
 */
function buildMapsUrl(config: LocationConfig): string {
    const { lat, lng, address, name } = config;

    // Option 1: Use coordinates
    if (lat !== undefined && lng !== undefined) {
        const query = name ? `${lat},${lng}` : `${lat},${lng}`;
        return `https://www.google.com/maps/search/?api=1&query=${query}${name ? `&query_place_id=${encodeURIComponent(name)}` : ''}`;
    }

    // Option 2: Use address
    if (address) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }

    throw new Error('Either coordinates (lat, lng) or address must be provided');
}

/**
 * Validate location configuration
 */
export function validateLocationConfig(config: LocationConfig): { valid: boolean; error?: string } {
    const { lat, lng, address } = config;

    // Must have either coordinates or address
    if ((lat === undefined || lng === undefined) && !address) {
        return { valid: false, error: 'Either coordinates (lat, lng) or address is required' };
    }

    // Validate coordinates if provided
    if (lat !== undefined || lng !== undefined) {
        if (lat === undefined || lng === undefined) {
            return { valid: false, error: 'Both lat and lng must be provided together' };
        }

        if (lat < -90 || lat > 90) {
            return { valid: false, error: 'Latitude must be between -90 and 90' };
        }

        if (lng < -180 || lng > 180) {
            return { valid: false, error: 'Longitude must be between -180 and 180' };
        }
    }

    // Validate address if provided
    if (address && address.trim() === '') {
        return { valid: false, error: 'Address cannot be empty' };
    }

    return { valid: true };
}

/**
 * Get Google Maps URL (without generating QR)
 */
export function getGoogleMapsUrl(config: LocationConfig): string {
    return buildMapsUrl(config);
}

/**
 * Example usage:
 * 
 * // Using coordinates
 * const qr1 = await generateLocationQR({
 *   lat: 24.7136,
 *   lng: 46.6753,
 *   name: 'Riyadh, Saudi Arabia'
 * });
 * 
 * // Using address
 * const qr2 = await generateLocationQR({
 *   address: 'King Fahd Road, Riyadh, Saudi Arabia'
 * });
 */
