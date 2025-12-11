-- Test notification - UPDATED VERSION
-- This query will show you what's happening

-- Step 1: Check your current user_id and org_id
SELECT 
    auth.uid() as my_user_id,
    uo.org_id as my_org_id,
    o.name as org_name
FROM user_orgs uo
JOIN organizations o ON o.id = uo.org_id
WHERE uo.user_id = auth.uid();

-- Step 2: Create notification (run this AFTER step 1 shows results)
INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
SELECT 
    auth.uid() as user_id,
    uo.org_id,
    'info'::text,
    'Test notificatie'::text,
    'Dit is een test notificatie om het systeem te testen!'::text,
    '/leads'::text,
    '{"test": true}'::jsonb
FROM user_orgs uo
WHERE uo.user_id = auth.uid()
LIMIT 1;

-- Step 3: Verify notification was created (RUN THIS NOW!)
SELECT * FROM notifications WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 5;
