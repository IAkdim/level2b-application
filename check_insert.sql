-- Check if the SELECT part works
SELECT 
    auth.uid() as user_id,
    uo.org_id,
    'info'::text as type,
    'Test notificatie'::text as title
FROM user_orgs uo
WHERE uo.user_id = auth.uid();

-- If the above returns a row, try direct INSERT:
-- Replace these UUIDs with the values from the query above
-- INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
-- VALUES (
--     'YOUR-USER-ID-HERE'::uuid,
--     'YOUR-ORG-ID-HERE'::uuid,
--     'info',
--     'Direct insert test',
--     'Deze notificatie is direct toegevoegd!',
--     '/leads',
--     '{"test": true}'::jsonb
-- );
