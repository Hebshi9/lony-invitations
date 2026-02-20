// features.ts - Feature utilities and types

export interface EventFeatures {
    // Security & Control
    qr_time_restricted: boolean;
    enable_host_pin: boolean;
    privacy_mode: boolean;

    // Scanning Methods & Permissions
    enable_simple_scan: boolean;       // Guest preview mode (no check-in)
    require_inspector_app: boolean;    // Inspector check-in mode
    offline_mode: boolean;

    // Analytics & Dashboards
    live_analytics: boolean;
    client_dashboard: boolean;

    // AI & Automation
    ai_rsvp_bot: boolean;
    whatsapp_automated: boolean;
    instant_notifications: boolean;

    // Advanced Customization
    custom_checkin_page: boolean;
    enable_categories: boolean;
    enable_registration: boolean;      // Guest must register if name is generic
}

export const DEFAULT_FEATURES: EventFeatures = {
    qr_time_restricted: false,
    enable_host_pin: false,
    privacy_mode: false,
    enable_simple_scan: false,
    require_inspector_app: false,
    offline_mode: false,
    live_analytics: false,
    client_dashboard: false,
    ai_rsvp_bot: false,
    whatsapp_automated: false,
    instant_notifications: false,
    custom_checkin_page: false,
    enable_categories: false,
    enable_registration: false,
};

export interface FeatureMetadata {
    key: keyof EventFeatures;
    label: string;
    description: string;
    requiresConfig?: boolean;
    requiresBackend?: boolean;
    note?: string;
    requires?: (keyof EventFeatures)[];
}

export const FEATURE_CATEGORIES: Record<string, { title: string; icon: string; features: FeatureMetadata[] }> = {
    security: {
        title: 'الأمان والتحكم',
        icon: '🔐',
        features: [
            {
                key: 'qr_time_restricted',
                label: 'تقييد QR بالتوقيت',
                description: 'الباركود لا يعمل قبل وقت محدد',
                requiresConfig: true, // needs activation_time
            },
            {
                key: 'enable_host_pin',
                label: 'Host PIN للمضيف',
                description: 'رمز سري للمضيف للتحكم الكامل',
                requiresConfig: true, // needs host_pin field
            },
            {
                key: 'privacy_mode',
                label: 'وضع الخصوصية',
                description: 'إخفاء معلومات حساسة من المشرفين',
            },
        ],
    },
    scanning: {
        title: 'طرق المسح والصلاحيات',
        icon: '📱',
        features: [
            {
                key: 'enable_simple_scan',
                label: 'السماح للضيوف بمعاينة الدعوة',
                description: 'الضيف يمسح بكاميرته ويشوف معلوماته فقط (لا يسجل حضور)',
                note: 'Preview Mode - معاينة فقط',
            },
            {
                key: 'require_inspector_app',
                label: 'تطبيق/رابط المشرفين',
                description: 'المشرفين فقط يمسحون ويسجلون الحضور في قاعدة البيانات',
                note: 'Check-in Mode - تسجيل رسمي',
            },
            {
                key: 'offline_mode',
                label: 'وضع Offline للمشرفين',
                description: 'المشرفين يمسحون بدون إنترنت',
                requires: ['require_inspector_app'],
            },
        ],
    },
    analytics: {
        title: 'التحليلات واللوحات',
        icon: '📊',
        features: [
            {
                key: 'live_analytics',
                label: 'تحليلات مباشرة',
                description: 'Dashboard بإحصائيات لحظية',
            },
            {
                key: 'client_dashboard',
                label: 'لوحة تحكم العميل',
                description: 'صفحة خاصة للعميل لمتابعة الحضور',
            },
        ],
    },
    ai: {
        title: 'الذكاء الاصطناعي',
        icon: '🤖',
        features: [
            {
                key: 'ai_rsvp_bot',
                label: 'AI RSVP Bot',
                description: 'رد تلقائي ذكي على رسائل الضيوف',
                requiresBackend: true,
            },
            {
                key: 'whatsapp_automated',
                label: 'WhatsApp تلقائي',
                description: 'إرسال تلقائي عبر Bot',
                requiresBackend: true,
            },
            {
                key: 'instant_notifications',
                label: 'إشعارات فورية',
                description: 'تنبيه للمضيف عند حضور VIP',
            },
        ],
    },
    customization: {
        title: 'تخصيص متقدم',
        icon: '🎨',
        features: [
            {
                key: 'custom_checkin_page',
                label: 'صفحة Check-in مخصصة',
                description: 'تصميم خاص لصفحة الترحيب',
            },
            {
                key: 'enable_categories',
                label: 'فئات الضيوف المتقدمة',
                description: 'تصنيف متقدم مع ألوان وصلاحيات مختلفة',
            },
            {
                key: 'enable_registration',
                label: 'تفعيل رابط التسجيل المفتوح',
                description: 'يسمح للضيوف المجهولين بتسجيل بياناتهم عند المسح',
            },
        ],
    },
};

// Helper function to check if feature is enabled
export function hasFeature(
    event: { features?: Partial<EventFeatures> },
    featureName: keyof EventFeatures
): boolean {
    return event.features?.[featureName] === true;
}

// Helper to validate feature dependencies
export function validateFeatures(features: Partial<EventFeatures>): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    // Offline mode requires inspector app
    if (features.offline_mode && !features.require_inspector_app) {
        errors.push('وضع Offline يتطلب تفعيل تطبيق المشرفين');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// Helper to get enabled features count
export function getEnabledFeaturesCount(features: Partial<EventFeatures>): number {
    return Object.values(features).filter((v) => v === true).length;
}

// Check if feature requires backend
export function requiresBackend(featureName: keyof EventFeatures): boolean {
    const backendFeatures: (keyof EventFeatures)[] = [
        'whatsapp_automated',
        'ai_rsvp_bot',
    ];
    return backendFeatures.includes(featureName);
}
