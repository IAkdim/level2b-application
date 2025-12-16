-- Get the correct org_id for your user
SELECT 
    uo.user_id,
    uo.org_id,
    o.name as org_name
FROM user_orgs uo
JOIN organizations o ON o.id = uo.org_id
WHERE uo.user_id = '3b77433c-f8f6-45d3-a143-2a63891c60ce';

-- After running above, use the org_id you get to run this:
INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
VALUES (
    '3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid,
    '08050c27-a50e-4cdd-b513-38aabb1e09af'::uuid,
    'info',
    'Test notificatie',
    'Deze notificatie zou moeten werken!',
    '/leads',
    '{"test": true}'::jsonb
);
