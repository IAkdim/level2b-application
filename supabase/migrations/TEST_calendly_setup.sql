-- TEST QUERY: Verify organization_settings and calendly link
-- Run this in Supabase SQL Editor to check if your data exists

-- Check if organization_settings table exists and has data
SELECT 
  os.id,
  os.org_id,
  os.company_name,
  os.calendly_scheduling_url,
  o.name as org_name
FROM organization_settings os
JOIN organizations o ON o.id = os.org_id
LIMIT 5;

-- Check user_orgs to see if your user is linked to an organization
SELECT 
  uo.user_id,
  uo.org_id,
  uo.role,
  o.name as org_name
FROM user_orgs uo
JOIN organizations o ON o.id = uo.org_id
LIMIT 5;

-- EXPECTED RESULT:
-- If both queries return data, your setup is correct.
-- If organization_settings is empty, you need to insert a row with calendly_scheduling_url
-- If user_orgs is empty, you need to link your user to an organization

-- To insert a test Calendly link for your organization:
-- (Replace YOUR_ORG_ID and YOUR_CALENDLY_LINK)
/*
INSERT INTO organization_settings (org_id, calendly_scheduling_url)
VALUES ('YOUR_ORG_ID', 'https://calendly.com/your-username/meeting')
ON CONFLICT (org_id) 
DO UPDATE SET calendly_scheduling_url = EXCLUDED.calendly_scheduling_url;
*/
