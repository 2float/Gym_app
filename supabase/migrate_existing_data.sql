-- Migrate existing workout_logs to the first user's account
-- 
-- INSTRUCTIONS:
-- 1. Sign up in the app to create your first user account
-- 2. Run this query AFTER signing up
-- 3. Replace 'YOUR_EMAIL_HERE' with your actual email address
--
-- This will assign all existing workouts to your user account.

UPDATE workout_logs
SET user_id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'f.thinschmidt@web.de'
  LIMIT 1
)
WHERE user_id IS NULL;

-- Verify the migration
SELECT 
  COUNT(*) as migrated_workouts,
  user_id,
  (SELECT email FROM auth.users WHERE id = user_id) as user_email
FROM workout_logs
WHERE user_id IS NOT NULL
GROUP BY user_id;
