-- G3: تذكير تلقائي
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP;
