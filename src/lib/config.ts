/**
 * Application Configuration
 * 
 * Central usage of Environment Variables to ensure
 * consistency across the application.
 */

const getApiUrl = () => {
    // 1. Fallback: Localhost or Primary VPS
    const host = window.location.hostname;
    
    // If we are on localhost, use the same host but port 3001
    if (host === 'localhost' || host === '127.0.0.1') {
        return `http://${host}:3001/api/whatsapp`;
    }

    // Default to the proxy when deployed to bypass Mixed Content/CORS
    return `/api/remote-whatsapp`;
};

const getPublicUrl = () => {
    const host = window.location.hostname;
    // Local development fallback
    if (host === 'localhost' || host === '127.0.0.1') {
        const port = window.location.port === '5173' ? '3001' : window.location.port;
        return `http://${host}:${port}`;
    }
    
    // Deployment fallback (use relative URL for proxying through Netlify)
    return '';
};

export const config = {
    supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    api: {
        whatsapp: getApiUrl(),
        sales: '/api/remote-sales',
        public: getPublicUrl(),
    },
    app: {
        name: 'Lony Invitations',
        version: '1.0.0',
    }
};

export default config;
