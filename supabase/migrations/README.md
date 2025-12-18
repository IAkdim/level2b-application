# Migrations Directory

This directory is for **future migrations** only.

## Current Status

✅ All historical migrations have been applied to production and archived
🔄 Redesign migrations are pending in `migrations_pending/`

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
