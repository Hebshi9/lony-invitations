import JSZip from 'jszip';
import Tesseract from 'tesseract.js';

/**
 * Smart Card Matching Service
 * Matches guest names with card images using multiple strategies
 */
class SmartCardMatcher {
    constructor() {
        this.strategies = [
            this.matchByFilename,
            this.matchByNumber,
            this.matchByOCR,
            this.matchByBarcode
        ];
    }

    /**
     * Extract images from ZIP file(s)
     */
    async extractFromZip(zipFiles) {
        const allImages = [];

        for (const zipFile of zipFiles) {
            try {
                const zip = await JSZip.loadAsync(zipFile);

                // Get all image files
                const imageFiles = Object.keys(zip.files).filter(filename =>
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(filename) &&
                    !filename.startsWith('__MACOSX') && // Ignore Mac metadata
                    !filename.startsWith('.') // Ignore hidden files
                );

                for (const filename of imageFiles) {
                    const file = zip.files[filename];
                    const blob = await file.async('blob');

                    allImages.push({
                        filename: filename.split('/').pop(), // Get just the filename
                        fullPath: filename,
                        blob: blob,
                        url: URL.createObjectURL(blob),
                        zipSource: zipFile.name
                    });
                }
            } catch (error) {
                console.error(`Error extracting ${zipFile.name}:`, error);
            }
        }

        return allImages;
    }

    /**
     * Parse guest list from various formats
     */
    parseGuestList(input, format = 'auto') {
        if (format === 'whatsapp' || this.isWhatsAppFormat(input)) {
            return this.parseWhatsAppList(input);
        } else if (format === 'excel') {
            // Excel parsing handled separately with XLSX
            return [];
        } else {
            // Try to auto-detect
            return this.parseGenericList(input);
        }
    }

    /**
     * Check if text is WhatsApp contact list format
     */
    isWhatsAppFormat(text) {
        // WhatsApp format usually has emojis and specific patterns
        const whatsappPatterns = [
            /📱|📞|☎️/,  // Phone emojis
            /\+\d{10,}/,  // International numbers
            /\d{10,}/,    // Phone numbers
        ];

        return whatsappPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Parse WhatsApp contact list
     * Format examples:
     * - أحمد محمد 0501234567
     * - فاطمة علي +966501234567
     * - خالد 📱 0501234567
     */
    parseWhatsAppList(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const guests = [];

        for (const line of lines) {
            // Remove emojis
            const cleaned = line.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();

            // Extract phone number
            const phoneMatch = cleaned.match(/(\+?\d{10,})/);
            if (!phoneMatch) continue;

            const phone = this.normalizePhone(phoneMatch[1]);

            // Extract name (everything before the phone number)
            const name = cleaned.substring(0, phoneMatch.index).trim();

            if (name && phone) {
                guests.push({
                    id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: name,
                    phone: phone,
                    source: 'whatsapp'
                });
            }
        }

        return guests;
    }

    /**
     * Parse generic list (name, phone on each line)
     */
    parseGenericList(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const guests = [];

        for (const line of lines) {
            // Try to extract name and phone
            const parts = line.split(/[,\t]/).map(p => p.trim());

            if (parts.length >= 2) {
                const name = parts[0];
                const phone = this.normalizePhone(parts[1]);

                if (name && phone) {
                    guests.push({
                        id: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: name,
                        phone: phone,
                        source: 'generic'
                    });
                }
            }
        }

        return guests;
    }

    /**
     * Normalize phone number
     */
    normalizePhone(phone) {
        let cleaned = phone.toString().replace(/\D/g, '');

        // Saudi numbers
        if (cleaned.startsWith('05')) {
            cleaned = '966' + cleaned.substring(1);
        } else if (cleaned.startsWith('5') && cleaned.length === 9) {
            cleaned = '966' + cleaned;
        }

        return '+' + cleaned;
    }

    /**
     * Main matching function
     */
    async matchGuestsToCards(guests, cardImages, onProgress) {
        const matches = [];
        let processed = 0;

        for (const guest of guests) {
            let bestMatch = null;
            let bestScore = 0;
            let matchMethod = null;

            // Try each strategy
            for (const strategy of this.strategies) {
                const result = await strategy.call(this, guest, cardImages);

                if (result && result.score > bestScore) {
                    bestMatch = result.image;
                    bestScore = result.score;
                    matchMethod = result.method;
                }

                // If we have a perfect match, stop
                if (bestScore >= 0.95) break;
            }

            matches.push({
                ...guest,
                cardImage: bestMatch,
                matchScore: bestScore,
                matchMethod: matchMethod,
                matched: bestScore >= 0.6 // Consider matched if score >= 60%
            });

            processed++;
            if (onProgress) {
                onProgress(processed / guests.length);
            }
        }

        return matches;
    }

    /**
     * Strategy 1: Match by filename
     */
    matchByFilename(guest, cardImages) {
        const guestName = guest.name.toLowerCase().trim();

        for (const image of cardImages) {
            const filename = image.filename.toLowerCase();

            // Exact name match
            if (filename.includes(guestName)) {
                return { image, score: 0.95, method: 'filename-exact' };
            }

            // Partial name match (first name or last name)
            const nameParts = guestName.split(' ');
            for (const part of nameParts) {
                if (part.length > 2 && filename.includes(part)) {
                    return { image, score: 0.7, method: 'filename-partial' };
                }
            }
        }

        return null;
    }

    /**
     * Strategy 2: Match by number in filename
     * If guest has a number field or is numbered in list
     */
    matchByNumber(guest, cardImages) {
        if (!guest.number) return null;

        const guestNumber = guest.number.toString();

        for (const image of cardImages) {
            const filename = image.filename;

            // Extract numbers from filename
            const numbers = filename.match(/\d+/g);
            if (!numbers) continue;

            for (const num of numbers) {
                if (num === guestNumber) {
                    return { image, score: 0.9, method: 'number-match' };
                }
            }
        }

        return null;
    }

    /**
     * Strategy 3: Match by OCR (read text from image)
     */
    async matchByOCR(guest, cardImages) {
        // Only try OCR on unmatched cards to save time
        const guestName = guest.name.toLowerCase();

        // Try first 5 unmatched images (OCR is slow)
        const samplesToCheck = cardImages.slice(0, 5);

        for (const image of samplesToCheck) {
            try {
                const { data: { text } } = await Tesseract.recognize(
                    image.url,
                    'ara+eng', // Arabic + English
                    {
                        logger: () => { } // Disable logging
                    }
                );

                const extractedText = text.toLowerCase();

                // Check if guest name appears in extracted text
                if (extractedText.includes(guestName)) {
                    return { image, score: 0.85, method: 'ocr-match' };
                }

                // Check partial matches
                const nameParts = guestName.split(' ');
                let matchCount = 0;
                for (const part of nameParts) {
                    if (part.length > 2 && extractedText.includes(part)) {
                        matchCount++;
                    }
                }

                if (matchCount >= nameParts.length / 2) {
                    return { image, score: 0.7, method: 'ocr-partial' };
                }

            } catch (error) {
                console.error('OCR error:', error);
            }
        }

        return null;
    }

    /**
     * Strategy 4: Match by barcode/QR code
     * (Placeholder - requires barcode scanning library)
     */
    matchByBarcode(guest, cardImages) {
        // TODO: Implement barcode scanning
        // This would require a library like @zxing/library
        return null;
    }

    /**
     * Get matching statistics
     */
    getMatchingStats(matches) {
        const total = matches.length;
        const matched = matches.filter(m => m.matched).length;
        const unmatched = total - matched;

        const methodCounts = {};
        matches.forEach(m => {
            if (m.matchMethod) {
                methodCounts[m.matchMethod] = (methodCounts[m.matchMethod] || 0) + 1;
            }
        });

        return {
            total,
            matched,
            unmatched,
            matchRate: (matched / total * 100).toFixed(1),
            methodCounts
        };
    }
}

// Singleton instance
const smartMatcher = new SmartCardMatcher();

export default smartMatcher;
