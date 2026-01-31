-- =====================================================================================================
-- 🚀 WORKFLOW SYSTEM - Database Schema
-- =====================================================================================================
-- Creates the complete workflow system with Orders, States, and Stage tracking
-- Run AFTER COMPLETE_SETUP.sql
-- =====================================================================================================

-- ========================================
-- STEP 1: Orders Table (Enhanced)
-- ========================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    intake_request_id UUID REFERENCES intake_requests(id) ON DELETE SET NULL,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    user_id UUID, -- auth.uid() from Supabase Auth
    
    -- Client Info (copied from intake for quick access)
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    
    -- Event Details
    event_type TEXT, -- wedding, graduation, conference, birthday
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
    
    -- Stage Owners (who performed each action)
    reviewed_by UUID, -- user who reviewed
    approved_by UUID, -- user who approved
    designed_by UUID, -- user who designed
    generated_by UUID, -- user who generated
    delivered_by UUID, -- user who delivered
    
    -- Design Configuration
    design_config JSONB, -- Canvas elements
    card_dimensions JSONB DEFAULT '{"width": 1080, "height": 1920}'::jsonb,
    background_url TEXT,
    
    -- Guest Data (before import)
    guest_data_raw TEXT, -- Original text/paste
    guest_data_parsed JSONB, -- AI parsed result
    guest_count INTEGER DEFAULT 0,
    
    -- Generation Results
    zip_url TEXT,
    zip_file_name TEXT,
    zip_size_mb DECIMAL(10, 2),
    zip_expires_at TIMESTAMP,
    generation_progress INTEGER DEFAULT 0,
    
    -- Client Portal
    portal_token TEXT UNIQUE, -- للوصول للـ dashboard
    portal_last_accessed TIMESTAMP,
    
    -- Pricing (optional)
    price_per_card DECIMAL(10, 2),
    total_price DECIMAL(10, 2),
    currency TEXT DEFAULT 'SAR',
    
    -- Metadata
    notes TEXT,
    admin_notes TEXT, -- ملاحظات داخلية
    rejection_reason TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN (
        'pending_review',      -- بانتظار المراجعة
        'needs_clarification', -- يحتاج توضيح من العميل
        'approved',            -- معتمد
        'event_created',       -- تم إنشاء الحدث
        'processing_guests',   -- جاري معالجة الضيوف
        'guests_imported',     -- تم استيراد الضيوف
        'designing',           -- جاري التصميم
        'design_ready',        -- التصميم جاهز
        'generating',          -- جاري التوليد
        'generated',           -- تم التوليد
        'ready_for_delivery',  -- جاهز للتسليم
        'delivered',           -- تم التسليم
        'completed',           -- مكتمل
        'cancelled',           -- ملغي
        'on_hold'              -- معلق
    )),
    
    CONSTRAINT valid_workflow_stage CHECK (workflow_stage IN (
        'intake',          -- استلام الطلب
        'review',          -- المراجعة
        'clarification',   -- طلب توضيح
        'event_creation',  -- إنشاء الحدث
        'guest_import',    -- استيراد الضيوف
        'design',          -- التصميم
        'preview',         -- المعاينة
        'generation',      -- التوليد
        'delivery',        -- التسليم
        'complete',        -- مكتمل
        'cancelled'        -- ملغي
    ))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_orders_intake ON orders(intake_request_id);
CREATE INDEX IF NOT EXISTS idx_orders_event ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_portal_token ON orders(portal_token);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Comments
COMMENT ON TABLE orders IS 'الطلبات مع تتبع كامل للـ workflow';
COMMENT ON COLUMN orders.status IS 'الحالة الحالية للطلب';
COMMENT ON COLUMN orders.workflow_stage IS 'المرحلة الحالية في الـ workflow';
COMMENT ON COLUMN orders.portal_token IS 'Token للعميل للوصول للـ dashboard';

-- ========================================
-- STEP 2: Order Timeline (Activity Log)
-- ========================================

CREATE TABLE IF NOT EXISTS order_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    
    -- Event Details
    event_type TEXT NOT NULL, -- status_change, note_added, file_uploaded, etc.
    event_title TEXT NOT NULL,
    event_description TEXT,
    
    -- State Transition (if applicable)
    from_status TEXT,
    to_status TEXT,
    from_stage TEXT,
    to_stage TEXT,
    
    -- Actor
    actor_id UUID, -- Supabase auth.uid()
    actor_name TEXT, -- cached for display
    
    -- Metadata
    metadata JSONB, -- extra data
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'status_change',
        'stage_change',
        'note_added',
        'file_uploaded',
        'email_sent',
        'sms_sent',
        'design_updated',
        'generation_started',
        'generation_completed',
        'delivery_sent',
        'client_accessed',
        'other'
    ))
);

CREATE INDEX IF NOT EXISTS idx_timeline_order ON order_timeline(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON order_timeline(event_type);

COMMENT ON TABLE order_timeline IS 'سجل زمني لجميع أنشطة الطلب';

-- ========================================
-- STEP 3: Helper Functions
-- ========================================

-- Function: Create order from intake
CREATE OR REPLACE FUNCTION create_order_from_intake(
    p_intake_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_intake RECORD;
BEGIN
    -- Get intake data
    SELECT * INTO v_intake FROM intake_requests WHERE id = p_intake_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Intake request not found';
    END IF;
    
    -- Create order
    INSERT INTO orders (
        intake_request_id,
        user_id,
        client_name,
        client_phone,
        client_email,
        event_type,
        event_name,
        event_date,
        event_location,
        guest_data_raw,
        portal_token,
        status,
        workflow_stage
    ) VALUES (
        p_intake_id,
        p_user_id,
        v_intake.client_name,
        v_intake.client_phone,
        v_intake.client_email,
        v_intake.event_details->>'type',
        v_intake.event_details->>'title',
        (v_intake.event_details->>'date')::DATE,
        v_intake.event_details->>'location',
        v_intake.raw_guest_data,
        encode(gen_random_bytes(32), 'hex'),
        'pending_review',
        'review'
    ) RETURNING id INTO v_order_id;
    
    -- Log timeline event
    INSERT INTO order_timeline (
        order_id,
        event_type,
        event_title,
        event_description,
        to_status,
        to_stage,
        actor_id
    ) VALUES (
        v_order_id,
        'status_change',
        'طلب جديد',
        'تم إنشاء الطلب من intake request',
        'pending_review',
        'review',
        p_user_id
    );
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update order status
CREATE OR REPLACE FUNCTION update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_new_stage TEXT,
    p_actor_id UUID,
    p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_status TEXT;
    v_old_stage TEXT;
BEGIN
    -- Get current status
    SELECT status, workflow_stage INTO v_old_status, v_old_stage
    FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Update order
    UPDATE orders SET
        status = p_new_status,
        workflow_stage = p_new_stage,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Log timeline
    INSERT INTO order_timeline (
        order_id,
        event_type,
        event_title,
        event_description,
        from_status,
        to_status,
        from_stage,
        to_stage,
        actor_id
    ) VALUES (
        p_order_id,
        'status_change',
        format('تحديث الحالة: %s', p_new_status),
        p_notes,
        v_old_status,
        p_new_status,
        v_old_stage,
        p_new_stage,
        p_actor_id
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get order progress percentage
CREATE OR REPLACE FUNCTION get_order_progress(p_order_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_stage TEXT;
    v_progress INTEGER;
BEGIN
    SELECT workflow_stage INTO v_stage FROM orders WHERE id = p_order_id;
    
    v_progress := CASE v_stage
        WHEN 'intake' THEN 10
        WHEN 'review' THEN 20
        WHEN 'clarification' THEN 15
        WHEN 'event_creation' THEN 30
        WHEN 'guest_import' THEN 45
        WHEN 'design' THEN 60
        WHEN 'preview' THEN 75
        WHEN 'generation' THEN 85
        WHEN 'delivery' THEN 95
        WHEN 'complete' THEN 100
        WHEN 'cancelled' THEN 0
        ELSE 0
    END;
    
    RETURN v_progress;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 4: RLS Policies for Orders
-- ========================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
USING (auth.uid() = user_id);

-- Users can create orders
CREATE POLICY "Users can create orders"
ON orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their orders
CREATE POLICY "Users can update own orders"
ON orders FOR UPDATE
USING (auth.uid() = user_id);

-- Users can view timeline of their orders
CREATE POLICY "Users can view timeline of own orders"
ON order_timeline FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_timeline.order_id
        AND orders.user_id = auth.uid()
    )
);

-- Users can add to timeline of their orders
CREATE POLICY "Users can add to timeline of own orders"
ON order_timeline FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_timeline.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ========================================
-- SUCCESS
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ WORKFLOW SYSTEM SETUP COMPLETE!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Created:';
    RAISE NOTICE '  - orders (with full workflow tracking)';
    RAISE NOTICE '  - order_timeline (activity log)';
    RAISE NOTICE '';
    RAISE NOTICE 'Functions Created:';
    RAISE NOTICE '  - create_order_from_intake()';
    RAISE NOTICE '  - update_order_status()';
    RAISE NOTICE '  - get_order_progress()';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Create Admin Orders Dashboard UI';
END $$;
