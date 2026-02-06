-- Create a Demo Event if not exists
INSERT INTO events (id, name, date, location, description)
VALUES (
  'live-test-event-001', 
  'تجربة حية (Live Test)', 
  CURRENT_DATE, 
  'Riyadh, KSA', 
  'حدث تجريبي لاختبار الرد الذكي'
) ON CONFLICT (id) DO NOTHING;

-- Add the Test Guest
INSERT INTO guests (id, event_id, name, phone, category, companions_count, rsvp_status)
VALUES (
  'guest-live-test-user',
  'live-test-event-001',
  'الضيف الكريم (Test User)',
  '966503678789', -- Normalized 0503678789
  'VIP',
  2,
  'pending'
) ON CONFLICT (id) DO UPDATE 
SET rsvp_status = 'pending'; -- Reset status to pending for re-testing
