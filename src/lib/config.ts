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

    // 2. Fallback: Localhost Development
    // Logic: If running on localhost, assume backend is on port 3001
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `http://${window.location.hostname}:3001/api/whatsapp`;
    }

    // 3. Absolute Fallback (Production but forgot env var?)
    // This might fail if backend is not on the same domain, but better than crashing
    return '/api/whatsapp';
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
