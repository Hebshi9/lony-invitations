// =====================================================================================================
// Workflow System Types
// =====================================================================================================

export type OrderStatus =
    | 'pending_review'      // بانتظار المراجعة
    | 'needs_clarification' // يحتاج توضيح من العميل
    | 'approved'            // معتمد
    | 'event_created'       // تم إنشاء الحدث
    | 'processing_guests'   // جاري معالجة الضيوف
    | 'guests_imported'     // تم استيراد الضيوف
    | 'designing'           // جاري التصميم
    | 'design_ready'        // التصميم جاهز
    | 'generating'          // جاري التوليد
    | 'generated'           // تم التوليد
    | 'ready_for_delivery'  // جاهز للتسليم
    | 'delivered'           // تم التسليم
    | 'completed'           // مكتمل
    | 'cancelled'           // ملغي
    | 'on_hold';            // معلق

export type WorkflowStage =
    | 'intake'          // استلام الطلب
    | 'review'          // المراجعة
    | 'clarification'   // طلب توضيح
    | 'event_creation'  // إنشاء الحدث
    | 'guest_import'    // استيراد الضيوف
    | 'design'          // التصميم
    | 'preview'         // المعاينة
    | 'generation'      // التوليد
    | 'delivery'        // التسليم
    | 'complete'        // مكتمل
    | 'cancelled';      // ملغي

export interface Order {
    id: string;

    // Links
    intake_request_id: string | null;
    event_id: string | null;
    user_id: string;

    // Client Info
    client_name: string;
    client_phone: string | null;
    client_email: string | null;

    // Event Details
    event_type: string | null;
    event_name: string | null;
    event_date: string | null;
    event_location: string | null;
    expected_guests: number | null;

    // Workflow
    status: OrderStatus;
    workflow_stage: WorkflowStage;

    // Timestamps
    created_at: string;
    reviewed_at: string | null;
    approved_at: string | null;
    event_created_at: string | null;
    guests_imported_at: string | null;
    design_started_at: string | null;
    design_completed_at: string | null;
    generation_started_at: string | null;
    generated_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;

    // Actors
    reviewed_by: string | null;
    approved_by: string | null;
    designed_by: string | null;
    generated_by: string | null;
    delivered_by: string | null;

    // Design
    design_config: any | null;
    card_dimensions: { width: number; height: number } | null;
    background_url: string | null;

    // Guest Data
    guest_data_raw: string | null;
    guest_data_parsed: any | null;
    guest_count: number;

    // Generation
    zip_url: string | null;
    zip_file_name: string | null;
    zip_size_mb: number | null;
    zip_expires_at: string | null;
    generation_progress: number;

    // Portal
    portal_token: string | null;
    portal_last_accessed: string | null;

    // Pricing
    price_per_card: number | null;
    total_price: number | null;
    currency: string;

    // Metadata
    notes: string | null;
    admin_notes: string | null;
    rejection_reason: string | null;
    updated_at: string;
}

export interface OrderTimelineEvent {
    id: string;
    order_id: string;
    event_type: TimelineEventType;
    event_title: string;
    event_description: string | null;
    from_status: OrderStatus | null;
    to_status: OrderStatus | null;
    from_stage: WorkflowStage | null;
    to_stage: WorkflowStage | null;
    actor_id: string | null;
    actor_name: string | null;
    metadata: any | null;
    created_at: string;
}

export type TimelineEventType =
    | 'status_change'
    | 'stage_change'
    | 'note_added'
    | 'file_uploaded'
    | 'email_sent'
    | 'sms_sent'
    | 'design_updated'
    | 'generation_started'
    | 'generation_completed'
    | 'delivery_sent'
    | 'client_accessed'
    | 'other';

// =====================================================================================================
// Workflow State Machine
// =====================================================================================================

export interface WorkflowTransition {
    from: WorkflowStage;
    to: WorkflowStage;
    requiredStatus?: OrderStatus;
    action: string;
    label: string;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
    // From intake
    { from: 'intake', to: 'review', action: 'submit_for_review', label: 'تقديم للمراجعة' },

    // From review
    { from: 'review', to: 'clarification', action: 'request_clarification', label: 'طلب توضيح' },
    { from: 'review', to: 'event_creation', action: 'approve', label: 'الموافقة' },
    { from: 'review', to: 'cancelled', action: 'reject', label: 'رفض الطلب' },

    // From clarification
    { from: 'clarification', to: 'review', action: 'resubmit', label: 'إعادة التقديم' },

    // From event_creation
    { from: 'event_creation', to: 'guest_import', action: 'create_event', label: 'إنشاء الحدث' },

    // From guest_import
    { from: 'guest_import', to: 'design', action: 'import_guests', label: 'استيراد الضيوف' },

    // From design
    { from: 'design', to: 'preview', action: 'complete_design', label: 'إكمال التصميم' },

    // From preview
    { from: 'preview', to: 'design', action: 'edit_design', label: 'تعديل التصميم' },
    { from: 'preview', to: 'generation', action: 'approve_design', label: 'الموافقة على التصميم' },

    // From generation
    { from: 'generation', to: 'delivery', action: 'complete_generation', label: 'إكمال التوليد' },

    // From delivery
    { from: 'delivery', to: 'complete', action: 'deliver', label: 'التسليم للعميل' },

    // Any stage can be put on hold or cancelled
];

export function getAvailableTransitions(currentStage: WorkflowStage): WorkflowTransition[] {
    return WORKFLOW_TRANSITIONS.filter(t => t.from === currentStage);
}

export function isValidTransition(from: WorkflowStage, to: WorkflowStage): boolean {
    return WORKFLOW_TRANSITIONS.some(t => t.from === from && t.to === to);
}

// =====================================================================================================
// Stage Display Info
// =====================================================================================================

export interface StageInfo {
    stage: WorkflowStage;
    label: string;
    description: string;
    icon: string;
    color: string;
    progress: number; // 0-100
}

export const STAGE_INFO: Record<WorkflowStage, StageInfo> = {
    intake: {
        stage: 'intake',
        label: 'استلام الطلب',
        description: 'العميل قدم الطلب',
        icon: '📝',
        color: 'gray',
        progress: 10
    },
    review: {
        stage: 'review',
        label: 'المراجعة',
        description: 'جاري مراجعة الطلب',
        icon: '🔍',
        color: 'blue',
        progress: 20
    },
    clarification: {
        stage: 'clarification',
        label: 'طلب توضيح',
        description: 'بانتظار معلومات إضافية من العميل',
        icon: '❓',
        color: 'yellow',
        progress: 15
    },
    event_creation: {
        stage: 'event_creation',
        label: 'إنشاء الحدث',
        description: 'جاري إنشاء الحدث',
        icon: '🎉',
        color: 'indigo',
        progress: 30
    },
    guest_import: {
        stage: 'guest_import',
        label: 'استيراد الضيوف',
        description: 'جاري استيراد ومعالجة قائمة الضيوف',
        icon: '👥',
        color: 'purple',
        progress: 45
    },
    design: {
        stage: 'design',
        label: 'التصميم',
        description: 'جاري تصميم البطاقات',
        icon: '🎨',
        color: 'pink',
        progress: 60
    },
    preview: {
        stage: 'preview',
        label: 'المعاينة',
        description: 'معاينة التصميم النهائي',
        icon: '👁️',
        color: 'teal',
        progress: 75
    },
    generation: {
        stage: 'generation',
        label: 'التوليد',
        description: 'جاري توليد البطاقات',
        icon: '⚙️',
        color: 'orange',
        progress: 85
    },
    delivery: {
        stage: 'delivery',
        label: 'التسليم',
        description: 'جاهز للتسليم',
        icon: '📦',
        color: 'green',
        progress: 95
    },
    complete: {
        stage: 'complete',
        label: 'مكتمل',
        description: 'الطلب مكتمل',
        icon: '✅',
        color: 'green',
        progress: 100
    },
    cancelled: {
        stage: 'cancelled',
        label: 'ملغي',
        description: 'تم إلغاء الطلب',
        icon: '❌',
        color: 'red',
        progress: 0
    }
};

export function getStageInfo(stage: WorkflowStage): StageInfo {
    return STAGE_INFO[stage];
}

export function getProgressPercentage(stage: WorkflowStage): number {
    return STAGE_INFO[stage].progress;
}
