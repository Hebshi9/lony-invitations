-- Quick check: What columns exist in guests table?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'guests'
ORDER BY ordinal_position;
