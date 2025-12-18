# Migrations Directory

This directory is for **future migrations** only.

## Current Status

✅ All historical migrations have been applied to production and archived
🔄 Redesign migrations are pending in `migrations_pending/`

## Recent Migrations

- `20251218104912_fix_organization_join_rls_policies.sql` - Fixed RLS policies to enable users to join organizations
- `20251218105825_fix_organization_members_visibility.sql` - Fixed members list to show all team members, not just yourself
- `20251218110158_fix_users_visibility_for_org_members.sql` - Fixed users table policy to allow viewing teammate profiles
- `20251218111500_enable_rls_on_critical_tables.sql` - **CRITICAL FIX**: Enabled RLS on users and user_orgs tables

## Adding New Migrations

When you need to make new database changes:

```bash
# Create a new migration
supabase migration new your_migration_name

# This will create a timestamped file in this directory
# Edit the file and add your SQL changes

# Push to production when ready
supabase db push
```

## Folder Structure

- `migrations/` (here) - Future migrations
- `migrations_archive/` - Applied historical migrations (reference only)
- `migrations_pending/` - Redesign migrations (not yet applied)

## See Also

- [Redesign Documentation](../docs/database/README.md)
- [Applied Migrations Archive](../migrations_archive/README.md)
- [Pending Migrations](../migrations_pending/README.md)
