-- Debug: Check if auth is working
SELECT auth.uid() as current_user;

-- Debug: Try to see ALL notifications (bypass RLS temporarily)
-- This will fail if RLS is blocking, but that tells us something
SELECT COUNT(*) as total_notifications FROM notifications;

-- Debug: Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'notifications';

-- Solution: Try inserting with explicit user_id
-- First get your IDs:
SELECT auth.uid() as user_id, org_id FROM user_orgs WHERE user_id = auth.uid() LIMIT 1;
