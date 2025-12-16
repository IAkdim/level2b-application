-- Create multiple test notifications with different types

INSERT INTO notifications (user_id, org_id, type, title, message, action_url, metadata)
VALUES 
-- Success notification
('3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid, '08050c27-a50e-4cdd-b513-38aabb1e09af'::uuid, 'success', 'Taak voltooid', 'Je hebt de taak "Contact opnemen" succesvol afgerond!', '/leads', '{"test": true}'::jsonb),

-- Warning notification
('3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid, '08050c27-a50e-4cdd-b513-38aabb1e09af'::uuid, 'warning', 'Taak vervalt binnenkort', 'De taak "Follow-up email" vervalt over 2 uur!', '/leads', '{"test": true}'::jsonb),

-- Error notification
('3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid, '08050c27-a50e-4cdd-b513-38aabb1e09af'::uuid, 'error', 'Email bounced', 'Email naar john@example.com kon niet worden bezorgd', '/leads', '{"test": true}'::jsonb),

-- Lead status changed
('3b77433c-f8f6-45d3-a143-2a63891c60ce'::uuid, '08050c27-a50e-4cdd-b513-38aabb1e09af'::uuid, 'lead_status_changed', 'Lead status gewijzigd', 'Sarah Johnson is nu qualified!', '/leads', '{"test": true}'::jsonb);
