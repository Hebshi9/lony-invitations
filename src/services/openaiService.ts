
import OpenAI from 'openai';

// Singleton instance (lazy loaded)
// Prevents crash on initial load if key is missing/invalid
let openaiInstance: OpenAI | null = null;

export const getOpenAIClient = () => {
    if (openaiInstance) return openaiInstance;

    // Try VITE_ prefix first (frontend), then fallback (rarely works in vite client but safe to check)
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error("OpenAI API Key is missing. Please set VITE_OPENAI_API_KEY in .env");
    }

    openaiInstance = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
    });

    return openaiInstance;
};

export interface DetectedLayout {
    fields: {
        type: 'text' | 'qr';
        label: string; // e.g. "Guest Name", "Table", "QR Code"
        x: number;
        y: number;
        width?: number;
        height?: number;
        suggestedColor?: string; // Hex color based on design
    }[];
    backgroundColor?: string; // Dominant background color for simple masking
}

/**
 * Uses GPT-4o Vision to analyze an invitation card and find layout elements.
 */
export const analyzeInvitationLayout = async (base64Image: string): Promise<DetectedLayout> => {
    try {
        const openai = getOpenAIClient();

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert design AI assistant specialized in analyzing event invitation cards. 
          Your job is to identify the precise coordinates (x, y) where dynamic elements should be placed.
          
          The image width is always 1080px and height is 1920px (Portrait).
          
          Return ONLY a JSON object with this structure:
          {
            "fields": [
              { "type": "text", "label": "guest_name", "x": 540, "y": 900, "suggestedColor": "#000000" },
              { "type": "qr", "label": "qr_code", "x": 540, "y": 1400, "width": 300 }
            ],
            "backgroundColor": "#FFFFFF"
          }
          
          - Coordinates (x,y) should be the CENTER point of the element.
          - If you see a name (like 'Mohammed'), identify it as 'guest_name' position.
          - If you see a QR code, identify it as 'qr_code' position.
          - Establish the text color based on the design theme.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this invitation image and tell me where to put the Guest Name and the QR Code." },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2, // Low creativity for high precision
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No analysis returned");

        return JSON.parse(content) as DetectedLayout;

    } catch (error) {
        console.error("OpenAI Analysis Failed:", error);
        // Fallback if AI fails: Return center screen coordinates
        return {
            fields: [
                { type: "qr", label: "qr_code", x: 540, y: 1500, width: 200 },
                { type: "text", label: "guest_name", x: 540, y: 1000, suggestedColor: "#000000" }
            ]
        };
    }
};

/**
 * Uses DALL-E 2 Edit to remove QR codes or text from the image.
 */
export const cleanImageBackground = async (imageBase64: string, maskBase64?: string): Promise<string> => {
    try {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("Missing VITE_OPENAI_API_KEY");

        // 1. Convert Base64 Strings to Blobs/Files
        const imageFile = await base64ToFile(imageBase64, "image.png");
        const maskFile = maskBase64 ? await base64ToFile(maskBase64, "mask.png") : undefined;

        // 2. Call OpenAI Edit API
        const formData = new FormData();
        formData.append('image', imageFile);
        if (maskFile) formData.append('mask', maskFile);
        formData.append('prompt', "Clean background texture, remove qr code and text, keep original design style");
        formData.append('n', '1');
        formData.append('size', '1024x1024'); // Requirement

        // Note: Using fetch directly because OpenAI Node SDK relies on 'fs' which is not in browser
        const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`
                // Content-Type is set automatically by FormData, do NOT set it manually
            },
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            console.error("OpenAI API Error:", data.error);
            throw new Error(data.error.message);
        }

        if (data.data && data.data.length > 0) {
            // OpenAI returns a URL. We return it directly.
            return data.data[0].url;
        }

        throw new Error("No image returned from OpenAI");

    } catch (error) {
        console.error("OpenAI Edit Failed:", error);
        throw error;
    }
};

// --- Helper Utilities ---
async function base64ToFile(base64: string, filename: string): Promise<File> {
    const res = await fetch(base64);
    const blob = await res.blob();
    return new File([blob], filename, { type: "image/png" });
}

/**
 * Uses GPT-4o to parse a raw text list of guests into structured data.
 * Understands Arabic/English and identifies companion counts.
 */
export const parseGuestsFromText = async (text: string): Promise<{ name: string, companions: number }[]> => {
    try {
        const openai = getOpenAIClient();

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert event data parser. 
          Extract guest names and companion counts from the provided text.
          
          Rules:
          - If someone says "Name + family" or "Name وعائلته", assume 4 companions.
          - If someone says "Name + wife" or "Name وحرمه", assume 1 companion.
          - If someone says "Name + X", where X is a number, companions = X.
          - If only a name is provided, companions = 0.
          
          Return ONLY a JSON object with this structure:
          {
            "guests": [
              { "name": "Mohammed Ahmed", "companions": 3 },
              { "name": "Khalid", "companions": 0 }
            ]
          }`
                },
                {
                    role: "user",
                    content: `Parse this list of guests:\n\n${text}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, 
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No data returned from AI");

        const result = JSON.parse(content);
        return result.guests || [];

    } catch (error) {
        console.error("OpenAI Parsing Failed:", error);
        // Fallback: simple line split if AI fails
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(name => ({ name, companions: 0 }));
    }
};
