/**
 * Application Configuration
 * 
 * Central usage of Environment Variables to ensure
 * consistency across the application.
 */

const getApiUrl = () => {
    // 1. Priority: Defined in .env (Production/Staging)
    if (import.meta.env.VITE_WHATSAPP_API_URL) {
        return import.meta.env.VITE_WHATSAPP_API_URL;
    }

    // 2. Fallback: Localhost/Network Development
    // Logic: Use the current window hostname (localhost, 127.0.0.1, or network IP)
    const host = window.location.hostname || 'localhost';

    // In local development, the Evolution API adapter usually lives on port 3002
    return `http://${host}:3002/api/whatsapp`;
};

export const config = {
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    api: {
        whatsapp: getApiUrl(),
    },
    app: {
        name: 'Lony Invitations',
        version: '1.0.0',
    }
};

export default config;
