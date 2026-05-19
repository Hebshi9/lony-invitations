
export const handler = async () => {
    const envVars = {
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING',
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'PRESENT' : 'MISSING',
        META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID ? 'PRESENT' : 'MISSING',
        META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ? 'PRESENT' : 'MISSING',
        NODE_VERSION: process.version
    };

    return {
        statusCode: 200,
        body: JSON.stringify(envVars, null, 2)
    };
};
