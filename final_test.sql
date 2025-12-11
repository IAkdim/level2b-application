-- Step 1: Check if auth.uid() has a value
SELECT auth.uid() as my_auth_uid;

-- Step 2: Check what's in user_orgs table
SELECT * FROM user_orgs LIMIT 5;

-- Step 3: Does YOUR user exist in user_orgs?
SELECT * FROM user_orgs WHERE user_id = '3b77433c-f8f6-45d3-a143-2a63891c60ce';

-- Step 4: If auth.uid() is NULL, create notification with hardcoded ID:
INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
VALUES (
    '3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid,
    '78c063c0-9f3e-4815-b849-4bb47aaee2c6'::uuid,
    'info',
    'Hard coded test',
    'Deze notificatie gebruikt hard-coded IDs!',
    '/leads',
    '{"test": true}'::jsonb
);
