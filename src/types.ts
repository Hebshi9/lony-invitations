// =====================================================================================================
// Unified Invitation Studio - TypeScript Types
// =====================================================================================================

// ============================================
// Existing Types (محافظة على التوافقية)
// ============================================

export interface Client {
    id: string;
    created_at: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
}

export interface IntakeRequest {
    id: string;
    created_at: string;
    client_name: string | null;
    client_phone: string | null;
    client_email: string | null;
    event_details: {
        title?: string;
        date?: string;
        location?: string;
        type?: string;
        [key: string]: any;
    } | null;
    guest_list_url: string | null;
    status: 'new' | 'processing' | 'processed' | 'converted';
    ai_analysis: any | null;
}

export interface Order {
    id: string;
    created_at: string;
    client_id: string | null;
    event_id: string | null;
    status: 'drafting' | 'waiting_approval' | 'approved' | 'completed';
    workflow_stage: 'intake' | 'cleaning' | 'design' | 'review' | 'generation' | 'delivery';
    total_price: number | null;
    notes: string | null;
}

export interface EventSettings {
    qr_fields: {
        show_name: boolean;
        show_table: boolean;
        show_companions: boolean;
        show_category: boolean;
        show_custom: string[];
    };
    portal_settings: any;
}

// ============================================
// Updated Event Type (with Location & WiFi)
// ============================================

export interface Event {
    id: string;
    created_at: string;
    name: string;
    date: string | null;
    location: string | null;

    // Location Data
    location_lat?: number;
    location_lng?: number;
    location_maps_url?: string;

    // WiFi Data
    wifi_ssid?: string;
    wifi_password?: string;
    wifi_security?: 'WPA' | 'WEP' | 'nopass';

    client_id: string | null;
    settings: EventSettings | null;
}

// ============================================
// Updated Guest Type (with Serial & Category)
// ============================================

export interface Guest {
    id: string;
    event_id: string;
    name: string;

    // Basic Info
    email?: string;
    phone?: string;
    serial?: string;  // رقم تسلسلي (001, VIP-123, etc)
    category?: string;  // فئة (VIP, عام, رجال، نساء)

    // Status
    status: 'pending' | 'invited' | 'confirmed' | 'declined' | 'attended' | 'cancelled';

    // RSVP Status (حالة الرد على الدعوة)
    rsvp_status?: 'pending' | 'confirmed' | 'declined';
    rsvp_date?: string;  // تاريخ الرد

    // Table & Companions
    table_no?: string;
    companions_count?: number;
    remaining_companions?: number;

    // QR & Card
    qr_token?: string;
    card_url?: string; // Older field
    card_image_url?: string; // New field for public storage URL
    card_number?: string; // New field for serial 001, 002...
    card_generated_at?: string;
    card_generated?: boolean;
    card_downloaded?: boolean;

    // Invitation Sending (تتبع إرسال الدعوات)
    sent_general_at?: string;   // تاريخ إرسال الكرت العام
    sent_personal_at?: string;  // تاريخ إرسال الكرت الشخصي
    invitation_phase?: number;  // 1 = عام, 2 = شخصي
    guest_category?: string;    // VIP, Family, Friends, General

    // Attendance
    scan_count?: number;
    attended_at?: string;

    // Metadata
    custom_fields?: any;
    created_at?: string;

    // Joined Relations
    events?: Event;
}

export interface GuestActivityLog {
    id: string;
    guest_id: string;
    event_id: string;
    scan_type: 'entry' | 'exit' | 'info';
    status: 'success' | 'failed' | 'warning';
    timestamp: string;
    scanned_by?: string;
    device_info?: any;
    companions_admitted?: number;
    failure_reason?: string;
}

export interface Scan {
    id: string;
    event_id: string;
    guest_id: string;
    scanned_at: string;
    scanner_device_info?: string;
    scan_result: string;
    source: string;
    scanned_companions?: number;
}

// ============================================
// NEW TYPES - Unified Invitation Studio
// ============================================

// Canvas Element Types
export interface CanvasElement {
    id: string;
    type: 'text' | 'qr' | 'image' | 'shape';
    label: string;
    x: number;  // موضع X (%)
    y: number;  // موضع Y (%)

    // Common Properties
    width?: number;
    height?: number;
    rotation?: number;
    opacity?: number;
    zIndex?: number;

    // Text Properties
    content?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    prefix?: string;  // بادئة ثابتة قبل المحتوى الديناميكي

    // QR Properties
    qrType?: 'guest' | 'location' | 'custom' | 'wifi' | 'contact';
    qrValue?: string;  // للـ custom/location/wifi
    qrColor?: string;
    qrBgColor?: string;
    qrPadding?: number;
    qrOpacity?: number;
    qrDotShape?: 'square' | 'rounded' | 'dots' | 'fluid';

    // Image Properties
    imageUrl?: string;

    // Shape Properties
    shapeType?: 'rectangle' | 'circle' | 'line';
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
}

// Card Template
export interface CardTemplate {
    id: string;
    created_at: string;
    event_id?: string | null;
    name: string | null;
    category?: string;  // wedding, graduation, conference, general

    // Images
    thumbnail_url?: string;
    background_url: string | null;

    // Canvas Data
    canvas_data: CanvasElement[] | null;

    // Dimensions
    dimensions: {
        width: number;
        height: number;
    } | null;

    // Settings
    default_settings?: {
        colors?: string[];
        fonts?: string[];
    };

    // Metadata
    tags?: string[];
    is_active: boolean;
    is_premium?: boolean;
    usage_count?: number;
}

// Saved Style
export interface SavedStyle {
    id: string;
    user_id?: string;
    name: string;
    type: 'text' | 'qr';
    properties: Partial<CanvasElement>;
    created_at: string;
}

// Export Job
export interface ExportJob {
    id: string;
    event_id: string;

    // Settings
    format: 'zip' | 'pdf' | 'png';
    quality: 'low' | 'medium' | 'high' | 'ultra';
    size_width: number;
    size_height: number;

    // Range (للتصدير الجزئي)
    guest_range_start?: number;
    guest_range_end?: number;

    // Status
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;  // 0-100
    total_cards?: number;

    // Output
    download_url?: string;
    file_size_mb?: number;

    // Timestamps
    created_at: string;
    started_at?: string;
    completed_at?: string;

    // Error
    error_message?: string;
}

// Card Analytics
export interface CardAnalytics {
    id: string;
    guest_id: string;
    event_id: string;
    event_type: 'viewed' | 'downloaded' | 'scanned' | 'shared';
    event_data?: any;
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
    created_at: string;
}

// ============================================
// Data Input Types
// ============================================

// Numbered Cards Configuration
export interface NumberedCardConfig {
    count: number;           // عدد البطاقات
    startFrom: number;       // بداية الترقيم (1, 100, etc)
    prefix?: string;         // بادئة (VIP-, GOLD-, etc)
    paddingLength: number;   // طول الرقم (3 = 001, 4 = 0001)
    category?: string;       // فئة اختيارية
    eventId: string;         // معرف الحدث
}

// AI Text Parsing Result
export interface AIGuestData {
    name: string;
    phone?: string;
    table?: string;
    companions?: number;
    category?: string;
    rawText?: string;  // النص الأصلي للمرجع
}

// Excel Upload Config
export interface ExcelUploadConfig {
    eventId: string;
    mapping: {
        name: string;      // عمود الاسم
        phone?: string;    // عمود الجوال
        table?: string;    // عمود الطاولة
        companions?: string;  // عمود المرافقين
        category?: string;    // عمود الفئة
    };
    hasCompanions: boolean;
    defaultCompanions?: number;
}

// ============================================
// Component Props Types
// ============================================

// Canvas Editor Props
export interface CanvasEditorProps {
    template?: CardTemplate;
    backgroundUrl?: string;
    initialElements?: CanvasElement[];
    onClose: () => void;
    onSave: (elements: CanvasElement[]) => void;
    availableFields?: string[];  // حقول من Excel
    event?: Event;  // لـ Location/WiFi QR
}

// Unified Studio Props
export interface UnifiedStudioProps {
    eventId?: string;
    mode?: 'create' | 'edit';
}

// Export Options
export interface ExportOptions {
    format: ('zip' | 'pdf' | 'png')[];
    quality: 'low' | 'medium' | 'high' | 'ultra';
    size: {
        width: number;
        height: number;
    };
    pdfLayout?: 'single' | 'quad' | 'grid';  // بطاقة واحدة أو 4 أو 9 في الصفحة
    dpi?: number;  // 72, 150, 300
    range?: {
        start: number;
        end: number;
    };
}

// ============================================
// Utility Types
// ============================================

// Data Input Method
export type DataInputMethod = 'excel' | 'ai' | 'numbered' | 'manual';

// QR Code Type
export type QRCodeType = 'guest' | 'location' | 'custom' | 'wifi' | 'contact';

// Studio Step
export type StudioStep = 'data' | 'design' | 'preview' | 'generate' | 'export';

// Export Status
export type ExportStatus = 'idle' | 'generating' | 'uploading' | 'ready' | 'error';
