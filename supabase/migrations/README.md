# Database Migrations

This directory contains all database migrations for the Level2B CRM application.

## Migration Order

Migrations should be applied in the following order:

1. **20251016_00_foundation.sql** - Foundation schema
   - Creates users and organizations tables
   - Sets up multi-tenancy infrastructure
   - Establishes auth triggers and RLS policies

2. **20251016_create_crm_tables.sql** - CRM tables
   - Creates leads, activities, tasks, notes, and deals tables
   - Sets up indexes for performance
   - Establishes RLS policies for data isolation

3. **20251016_complete_setup.sql** - Complete setup
   - Additional configurations and helper functions
   - Completes the RLS policy setup
   - Sets up triggers for updated_at timestamps

4. **20251017_source_to_tags.sql** - Source array migration
   - Converts `source` from TEXT to TEXT[] for multi-tag support
   - Migrates existing data to array format
   - Adds GIN index for efficient array queries
   - Creates helper function `get_org_sources()`

## Applying Migrations

### Using Supabase CLI

```bash
# Apply all pending migrations
supabase db push

# Or apply migrations individually
supabase migration up
```

### Manual Application

If you need to apply migrations manually through the Supabase dashboard:

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of each migration file in order
3. Execute each migration one by one

## Key Features

- **Multi-tenancy**: All tables are isolated by `org_id`
- **Row Level Security (RLS)**: Every table has proper RLS policies
- **Array-based tags**: Leads support multiple source tags
- **GIN indexes**: Efficient array operations for filtering
- **Helper functions**: `get_org_sources()` for autocomplete

## Schema Overview

### Core Tables
- `users` - User profiles linked to Supabase auth
- `organizations` - Multi-tenant workspaces
- `user_organizations` - User-to-org memberships with roles
- `leads` - CRM leads with contact info and tracking
- `activities` - Timeline of interactions with leads
- `tasks` - To-do items linked to leads
- `notes` - Lead-specific notes
- `deals` - Pipeline tracking for leads
