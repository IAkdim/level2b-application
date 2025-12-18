# Which Approach Should I Use?

## Quick Decision Guide

### Do you have an existing database with data? ✅

**Use: Incremental Migrations (001-010)**

Run all 10 migration files in order. They will:
- ✅ Keep all your existing data
- ✅ Add new columns to existing tables
- ✅ Create new tables (activities, emails, attachments)
- ✅ Add all new features without breaking changes

```bash
for file in supabase/migrations/redesign/0[0-9]*.sql; do
  supabase db execute --file "$file"
done
```

### Starting fresh with a new database? 🆕

**Use: Complete Schema (00_complete_schema_from_scratch.sql)**

Run one single file that creates everything:
- ✅ All foundation tables
- ✅ All CRM tables with redesign features built-in
- ✅ No need for separate migrations
- ✅ Everything configured from the start

```bash
supabase db execute --file supabase/migrations/redesign/00_complete_schema_from_scratch.sql
```

---

## Detailed Comparison

| Aspect | Incremental (001-010) | From Scratch (00_) |
|--------|----------------------|-------------------|
| **Use Case** | Upgrading existing DB | New database |
| **Existing Data** | ✅ Preserved | ❌ N/A |
| **Number of Files** | 10 migrations + rollback | 1 complete schema |
| **Execution Time** | 2-4 hours | 5-10 minutes |
| **Rollback** | ✅ Available | ⚠️ Drop schema |
| **Testing** | Recommended on staging | Can test locally |
| **Risk** | Low (incremental) | None (fresh start) |

## What Each Approach Creates

Both approaches create the **same final database schema**. The only difference is how you get there.

### Final Schema (Identical for Both)

**Foundation Tables:**
- `users` - User profiles
- `organizations` - Multi-tenant workspaces
- `user_orgs` - User-organization membership

**CRM Tables (with redesign features):**
- `leads` - Contact management
- `tasks` - Task tracking
- `notes` - Lead notes
- `deals` - Sales pipeline

**New Tables:**
- `activities` - Audit trail
- `email_threads` - Email conversations
- `email_messages` - Individual emails
- `attachments` - File metadata

**Views:**
- `lead_stats` - Lead analytics (materialized)
- `task_stats` - Task analytics (materialized)
- `deal_stats` - Pipeline analytics (materialized)

**Functions:**
- `soft_delete()` - Soft delete helper
- `restore_record()` - Restore deleted records
- `search_all()` - Full-text search
- `log_activity()` - Manual activity logging
- `refresh_all_stats()` - Refresh analytics
- `handle_new_user()` - Auto-create org on signup

## File Sizes

- **Incremental**: 10 files × ~200 lines = ~2,000 lines total
- **From Scratch**: 1 file × ~3,000 lines = ~3,000 lines total

The from-scratch file is larger because it includes foundation tables that already exist in your database.

## Examples

### Example 1: Production Database with 10,000 Leads

**Situation:**
- You have a production database
- 10,000 leads with notes and tasks
- You want to add the new features

**Solution:** ✅ Use Incremental Migrations

**Why:**
- Preserves all existing data
- Adds new features without disruption
- Tested rollback available if needed

**Execution:**
```bash
# 1. Backup first!
supabase db dump > backup.sql

# 2. Run migrations
for file in supabase/migrations/redesign/0[0-9]*.sql; do
  supabase db execute --file "$file"
done

# 3. Verify
supabase db execute --file supabase/migrations/redesign/verify.sql
```

### Example 2: Brand New Project

**Situation:**
- Starting a new CRM project
- No existing database
- Want all features from day 1

**Solution:** ✅ Use Complete Schema

**Why:**
- Faster setup (1 file vs 10)
- No migration complexity
- Everything configured optimally

**Execution:**
```bash
# 1. Run schema
supabase db execute --file supabase/migrations/redesign/00_complete_schema_from_scratch.sql

# 2. Verify
supabase db execute --file supabase/migrations/redesign/verify.sql

# 3. Start building!
```

### Example 3: Cloning Production to Staging

**Situation:**
- You want to test migrations on staging
- Clone production database
- Test before running on production

**Solution:** ✅ Use Incremental Migrations (on cloned DB)

**Why:**
- Simulates exact production scenario
- Tests data migration with real data
- Validates rollback works

**Execution:**
```bash
# 1. Clone production to staging
pg_dump production | psql staging

# 2. Run migrations on staging
for file in supabase/migrations/redesign/0[0-9]*.sql; do
  supabase db execute --file "$file"
done

# 3. Test thoroughly

# 4. If successful, run on production
```

### Example 4: Local Development Environment

**Situation:**
- Developer wants to set up local database
- No need for production data
- Want to develop against new schema

**Solution:** ✅ Use Complete Schema

**Why:**
- Fastest setup
- Clean slate
- Can reset easily

**Execution:**
```bash
# 1. Reset local database
supabase db reset

# 2. Run complete schema
supabase db execute --file supabase/migrations/redesign/00_complete_schema_from_scratch.sql

# 3. Seed with test data (optional)
```

## Common Questions

### Q: Can I use the complete schema on an existing database?

**A:** ⚠️ Not recommended. The complete schema uses `CREATE TABLE IF NOT EXISTS`, which means:
- It will skip existing tables
- But it won't add new columns to existing tables
- You'll end up with an incomplete schema

Use incremental migrations instead.

### Q: Can I run incremental migrations on a fresh database?

**A:** ❌ No. The incremental migrations use `ALTER TABLE` statements that require existing tables. You'll get errors like:
```
ERROR: relation "leads" does not exist
```

Use the complete schema instead.

### Q: What if I'm not sure which I have?

**A:** Check if tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('leads', 'tasks', 'notes', 'deals');
```

- **Returns rows?** → You have an existing database → Use incremental migrations
- **Returns nothing?** → You have a fresh database → Use complete schema

### Q: Can I switch approaches mid-migration?

**A:** ❌ No. Pick one approach and stick with it. If you start incremental migrations, complete all 10 files.

### Q: What if I ran the wrong approach?

**If you ran complete schema on existing database:**
- Tables weren't overwritten (IF NOT EXISTS)
- But new columns weren't added
- **Solution:** Run incremental migrations to add missing columns

**If you ran incremental migrations on fresh database:**
- Got errors immediately (tables don't exist)
- Database still empty
- **Solution:** Run complete schema instead

## Recommendation by Scenario

| Scenario | Recommended Approach |
|----------|---------------------|
| Production upgrade | Incremental (001-010) |
| New production setup | Complete (00_) |
| Staging clone | Incremental (001-010) |
| Local development | Complete (00_) |
| Testing migrations | Incremental (001-010) on clone |
| CI/CD fresh environment | Complete (00_) |
| Demo/POC database | Complete (00_) |

## Still Not Sure?

When in doubt, **use incremental migrations**. They are:
- ✅ Safer (rollback available)
- ✅ More thoroughly tested
- ✅ Better documented
- ✅ Work on both fresh and existing databases (if run in order)

The complete schema is a convenience for fresh databases, but incremental migrations are the primary supported approach.

## Need Help?

See:
- `QUICK_START.md` - Quick reference for both approaches
- `README.md` - Complete guide with examples
- `/docs/database-redesign-plan.md` - Full design document
