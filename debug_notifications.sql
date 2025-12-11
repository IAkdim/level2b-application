-- Debug notifications
-- Run each query separately to debug the issue

-- 1. Check if notification was created
SELECT * FROM notifications 
WHERE user_id = auth.uid() 
ORDER BY created_at DESC 
LIMIT 5;

-- 2. Check your user_id and org_id
SELECT 
    auth.uid() as current_user_id,
    uo.org_id,
    o.name as org_name
FROM user_orgs uo
JOIN organizations o ON o.id = uo.org_id
WHERE uo.user_id = auth.uid();

-- 3. Check RLS policies are working
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'notifications';

-- 4. Count total notifications for your user
SELECT COUNT(*) as total_notifications
FROM notifications
WHERE user_id = auth.uid();
