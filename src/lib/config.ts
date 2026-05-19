/**
 * Lony Core Configuration
 * Central source of truth for API URLs and environment settings.
 */

const isDev = import.meta.env.DEV;

export const CONFIG = {
    // API Endpoints
    API_URL: (typeof window !== 'undefined' ? window.location.origin : 'https://lonyinvite.netlify.app'),
    
    // Meta Cloud API specific
    META: {
        VERSION: 'v18.0',
        DEFAULT_LANGUAGE: 'ar'
    },

    // UI Constants
    LUXURY_COLORS: {
        NAVY: '#001F3F',
        GOLD: '#D4AF37',
        IVORY: '#FDFCF0'
    },

    // Feature Flags
    ENABLE_AI_RSVP: true,
    ENABLE_DEBT_PULSE: true // Ready for development
};

export default CONFIG;
