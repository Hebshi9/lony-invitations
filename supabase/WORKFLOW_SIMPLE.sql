-- =====================================================================================================
-- 🚀 WORKFLOW SYSTEM - Simple Version (No RLS)
-- =====================================================================================================
-- Run this first to create the tables, then add RLS later
-- =====================================================================================================

-- ========================================
-- STEP 1: Orders Table
-- ========================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links (optional - may not exist yet)
    intake_request_id UUID,
    event_id UUID,
    user_id UUID,
    
    -- Client Info
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    
    -- Event Details
    event_type TEXT,
    event_name TEXT,
    event_date DATE,
    event_location TEXT,
    expected_guests INTEGER,
    
    -- Workflow Status
    status TEXT NOT NULL DEFAULT 'pending_review',
    workflow_stage TEXT NOT NULL DEFAULT 'intake',
    
    -- Stage Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    approved_at TIMESTAMP,
    event_created_at TIMESTAMP,
    guests_imported_at TIMESTAMP,
    design_started_at TIMESTAMP,
    design_completed_at TIMESTAMP,
    generation_started_at TIMESTAMP,
    generated_at TIMESTAMP,
    delivered_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    
    -- Stage Owners
    reviewed_by UUID,
    approved_by UUID,
    designed_by UUID,
    generated_by UUID,
    delivered_by UUID,
    
    -- Design Configuration
    design_config JSONB,
    card_dimensions JSONB DEFAULT '{"width": 1080, "height": 1920}'::jsonb,
    background_url TEXT,
    
    -- Guest Data
    guest_data_raw TEXT,
    guest_data_parsed JSONB,
    guest_count INTEGER DEFAULT 0,
    
    -- Generation Results
    zip_url TEXT,
    zip_file_name TEXT,
    zip_size_mb DECIMAL(10, 2),
    zip_expires_at TIMESTAMP,
    generation_progress INTEGER DEFAULT 0,
    
    -- Client Portal
    portal_token TEXT UNIQUE,
    portal_last_accessed TIMESTAMP,
    
    -- Pricing
    price_per_card DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    currency TEXT DEFAULT 'SAR',
    
    -- Metadata
    notes TEXT,
    admin_notes TEXT,
    rejection_reason TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN (
        'pending_review', 'needs_clarification', 'approved', 'event_created',
        'processing_guests', 'guests_imported', 'designing', 'design_ready',
        'generating', 'generated', 'ready_for_delivery', 'delivered',
        'completed', 'cancelled', 'on_hold'
    )),
    
    CONSTRAINT valid_workflow_stage CHECK (workflow_stage IN (
        'intake', 'review', 'clarification', 'event_creation', 'guest_import',
        'design', 'preview', 'generation', 'delivery', 'complete', 'cancelled'
    ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ========================================
-- STEP 2: Order Timeline
-- ========================================

CREATE TABLE IF NOT EXISTS order_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    
    event_type TEXT NOT NULL,
    event_title TEXT NOT NULL,
    event_description TEXT,
    
    from_status TEXT,
    to_status TEXT,
    from_stage TEXT,
    to_stage TEXT,
    
    actor_id UUID,
    actor_name TEXT,
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'status_change', 'stage_change', 'note_added', 'file_uploaded',
        'email_sent', 'sms_sent', 'design_updated', 'generation_started',
        'generation_completed', 'delivery_sent', 'client_accessed', 'other'
    ))
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id, created_at DESC);

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ WORKFLOW TABLES CREATED!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables:';
    RAISE NOTICE '  - orders';
    RAISE NOTICE '  - order_timeline';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test with sample data, then add RLS later';
END $$;
