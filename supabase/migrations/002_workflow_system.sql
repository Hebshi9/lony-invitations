-- =====================================================================================================
-- 🔧 CLEAN & REINSTALL - Workflow System
-- =====================================================================================================
-- This will DROP existing tables and recreate them fresh
-- ⚠️ WARNING: This will delete all data in orders and order_timeline tables!
-- =====================================================================================================

-- ========================================
-- STEP 1: Drop existing tables (if any)
-- ========================================

DROP TABLE IF EXISTS order_timeline CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- ========================================
-- STEP 2: Create Orders Table (Fresh)
-- ========================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
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
    CHECK (status IN (
        'pending_review', 'needs_clarification', 'approved', 'event_created',
        'processing_guests', 'guests_imported', 'designing', 'design_ready',
        'generating', 'generated', 'ready_for_delivery', 'delivered',
        'completed', 'cancelled', 'on_hold'
    )),
    
    CHECK (workflow_stage IN (
        'intake', 'review', 'clarification', 'event_creation', 'guest_import',
        'design', 'preview', 'generation', 'delivery', 'complete', 'cancelled'
    ))
);

-- Indexes
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stage ON orders(workflow_stage);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_portal_token ON orders(portal_token);

-- ========================================
-- STEP 3: Create Order Timeline
-- ========================================

CREATE TABLE order_timeline (
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
    
    CHECK (event_type IN (
        'status_change', 'stage_change', 'note_added', 'file_uploaded',
        'email_sent', 'sms_sent', 'design_updated', 'generation_started',
        'generation_completed', 'delivery_sent', 'client_accessed', 'other'
    ))
);

CREATE INDEX idx_timeline_order ON order_timeline(order_id, created_at DESC);

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅✅✅ WORKFLOW TABLES CREATED SUCCESSFULLY! ✅✅✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Created:';
    RAISE NOTICE '  ✓ orders (with user_id column)';
    RAISE NOTICE '  ✓ order_timeline';
    RAISE NOTICE '';
    RAISE NOTICE 'Columns in orders table:';
    RAISE NOTICE '  - id, user_id, client_name, status, workflow_stage';
    RAISE NOTICE '  - design_config, card_dimensions, portal_token';
    RAISE NOTICE '  - and 30+ more columns...';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Ready to use!';
END $$;
