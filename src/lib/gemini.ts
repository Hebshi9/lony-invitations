import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.warn('Missing VITE_GEMINI_API_KEY in .env file');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

export const aiService = {
    // 1. Clean and Parse Guest List
    async parseGuestList(file: File): Promise<any[]> {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            let prompt = '';
            let imagePart = null;

            if (file.type.startsWith('image/')) {
                // Handle Image
                const base64Data = await fileToGenerativePart(file);
                // @ts-ignore
                imagePart = base64Data;
                prompt = `
                    You are an expert data assistant. 
                    I have an image of a guest list. 
                    Please extract the guest data into a structured JSON array.
                    
                    Rules:
                    1. Extract 'name', 'phone', 'email', 'table_no', 'companions_count'.
                    2. If 'companions_count' is not explicit, infer it from the name (e.g., "Mr. X and Family" -> 3 companions + 1 guest = 4 total, so companions_count = 3).
                    3. If phone number is missing, leave it null.
                    4. Return ONLY the JSON array, no markdown, no code blocks.
                    5. CLEANING RULES:
                       - Name: Remove titles (Dr., Mr., Mrs., Ms., Prof., Eng., Doctor, Sheikh, Abu, Umm, الدكتور, الشيخ, المهندس, الاستاذ, ابو, ام, etc.). Keep only the name.
                       - Phone: Normalize to E.164 format (e.g., +9665XXXXXXXX). If starts with 05, replace 0 with +966. Remove spaces and dashes.
                `;
            } else {
                // Handle Text/Other (Fallback to text extraction if possible)
                const text = await file.text();
                prompt = `
                    You are an expert data assistant. 
                    I have a guest list file (Type: ${file.type}). 
                    Please extract the guest data into a structured JSON array.
                    
                    Rules:
                    1. Extract 'name', 'phone', 'email', 'table_no', 'companions_count'.
                    2. If 'companions_count' is not explicit, infer it from the name (e.g., "Mr. X and Family" -> 3 companions + 1 guest = 4 total, so companions_count = 3).
                    3. If phone number is missing, leave it null.
                    4. Return ONLY the JSON array, no markdown, no code blocks.
                    5. CLEANING RULES:
                       - Name: Remove titles (Dr., Mr., Mrs., Ms., Prof., Eng., Doctor, Sheikh, Abu, Umm, الدكتور, الشيخ, المهندس, الاستاذ, ابو, ام, etc.). Keep only the name.
                       - Phone: Normalize to E.164 format (e.g., +9665XXXXXXXX). If starts with 05, replace 0 with +966. Remove spaces and dashes.
                    
                    File Content:
                    ${text.substring(0, 30000)}
                `;
            }

            const result = imagePart
                ? await model.generateContent([prompt, imagePart])
                : await model.generateContent(prompt);

            const response = result.response;
            const textResponse = response.text();

            // Clean markdown if present
            const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);

        } catch (error) {
            console.error('AI Parse Error:', error);
            throw new Error('Failed to parse guest list with AI');
        }
    },

    // 1b. Process Structured JSON (from Excel)
    async processGuestJson(data: any[]): Promise<any[]> {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const sample = data.slice(0, 50);
            const prompt = `
                You are an expert data assistant.
                I have a raw JSON dataset of guests.
                Please CLEAN and NORMALIZE it into a structured JSON array.

                Rules:
                1. Output keys MUST be: 'name', 'phone', 'email', 'table_no', 'companions_count'.
                2. Map the input keys to these output keys (e.g. "Guest Name" -> "name", "Mobile" -> "phone").
                3. Infer 'companions_count' if implicit in name.
                4. Clean Names: Remove titles (Mr, Dr, etc.).
                5. Clean Phones: E.164 format (+966...).
                6. Return ONLY the JSON array.

                Input Data:
                ${JSON.stringify(sample)}
            `;

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const cleanedSample = JSON.parse(jsonStr);

            return cleanedSample;

        } catch (error) {
            console.error('AI JSON Process Error:', error);
            // Fallback: return original data with best-guess mapping
            return data.map(d => ({
                name: d.name || d.Name || d['الاسم'] || Object.values(d)[0],
                phone: d.phone || d.Phone || d['الجوال'] || '',
                companions_count: 0
            }));
        }
    },

    // 2. Translate to Arabic
    async translateToArabic(text: string): Promise<string> {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `Translate this text to Arabic. Return ONLY the translation: "${text}"`;
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            return text; // Fallback
        }
    },

    // 3. Suggest Template Style
    async suggestTemplateStyle(_imageBase64: string): Promise<any> {
        // Placeholder for vision capabilities
        return {
            primaryColor: '#D4AF37',
            fontFamily: 'Amiri',
            layout: 'centered'
        };
    }
};

async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
}

export async function analyzeGuestList(headers: string[], sampleData: any[]): Promise<{ name?: string; phone?: string; table?: string; companions?: string; category?: string } | null> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `
            You are an expert data analyst.
            I have a dataset with the following headers: ${JSON.stringify(headers)}.
            Here is a sample of the data: ${JSON.stringify(sampleData)}.
            
            Please identify which column corresponds to:
            1. Guest Name (name) - Look for "Name", "Guest", "الاسم", "الضيف".
            2. Phone Number (phone) - Look for "Phone", "Mobile", "Jawal", "الجوال", "رقم الهاتف".
            3. Table Number (table) - Look for "Table", "Seat", "الطاولة", "رقم الجلوس".
            4. Companions Count (companions) - Look for "Companions", "Guests", "Pax", "Plus", "المرافقين", "عدد المرافقين".
            5. Category (category) - Look for "Category", "Type", "Class", "VIP", "الفئة", "التصنيف".

            Return a JSON object with keys: "name", "phone", "table", "companions", "category".
            Values should be the exact header string from the list.
            If a column is not found, set the value to null.
            Return ONLY the JSON.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return null;
    }
}
