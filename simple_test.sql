-- Simple test - Run this first
-- You should see your user_id below the query after clicking RUN

SELECT auth.uid() as my_user_id;

-- If that works, run this to see your organization:
-- SELECT * FROM user_orgs WHERE user_id = auth.uid();
