# Migration Plan: Organization-Centric to User-Centric Architecture

## Executive Summary

This document outlines the migration from the current **organization-centric multi-tenancy** model to a **user-centric** model where individual users own their data and can optionally collaborate through organizations.

**Target User:** Individual sales reps (prosumer) who occasionally collaborate with teammates.

---

## Part 1: Current System (Organization-Centric)

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ORGANIZATION (primary)                    │
│  - All data belongs to the organization                     │
│  - Users must select an org before accessing any data       │
│  - Data isolation is enforced by org_id on every table      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
│  - Users belong to organizations via user_orgs              │
│  - Users can have roles: owner, admin, member               │
│  - Users can belong to multiple organizations               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Ownership Model

| Entity | Owner | Access Control |
|--------|-------|----------------|
| Leads | Organization | All org members can view/edit |
| Deals | Organization | All org members can view/edit |
| Tasks | Organization | All org members can view/edit |
| Notes | Organization | All org members can view/edit |
| Email Templates | Organization | All org members can view/edit |
| Activities | Organization | All org members can view |
| Pipeline Stages | Organization | All org members can view/edit |

### 1.3 Database Schema (Current)

**Core Tables with org_id (required):**
- `leads` - org_id NOT NULL
- `deals` - org_id NOT NULL
- `tasks` - org_id NOT NULL
- `notes` - org_id NOT NULL
- `activities` - org_id NOT NULL
- `attachments` - org_id NOT NULL
- `email_templates` - org_id NOT NULL
- `pipeline_stages` - org_id NOT NULL
- `daily_usage` - org_id NOT NULL
- `notifications` - org_id NOT NULL
- `calendly_meetings` - org_id NOT NULL
- `feedback` - org_id NOT NULL
- `analytics_events` - org_id NOT NULL
- `email_tracking` - org_id NOT NULL
- `lead_status_history` - org_id NOT NULL

**Organization & User Tables:**
- `organizations` - Multi-tenant workspaces
- `users` - User profiles (extends auth.users)
- `user_orgs` - Junction table (user_id, org_id, role)
- `user_settings` - Per-user, per-org settings
- `organization_settings` - Org-level settings & integrations

**Billing Tables (org-scoped):**
- `subscriptions` - org_id NOT NULL
- `stripe_customers` - org_id NOT NULL
- `billing_history` - org_id NOT NULL

### 1.4 Application Flow (Current)

```
1. User logs in (Google OAuth)
        │
        ▼
2. Check user_orgs for memberships
        │
        ├── No orgs → Redirect to /select-organization
        │                    │
        │                    ├── Create new org (becomes owner)
        │                    └── Join existing org (becomes member)
        │
        └── Has orgs → Auto-select (from localStorage or first org)
                │
                ▼
3. All data queries include .eq('org_id', selectedOrg.id)
        │
        ▼
4. RLS policies enforce: org_id IN (user's organizations)
```

### 1.5 Key Code Patterns (Current)

**OrganizationContext.tsx:**
```typescript
// All components access org via context
const { selectedOrg } = useOrganization()

// Queries are blocked without org selection
if (!selectedOrg) throw new Error('No organization selected')
```

**Data Queries (e.g., leads.ts):**
```typescript
// Every query filters by org_id
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('org_id', orgId)  // Required filter
```

**Protected Routes:**
```typescript
// Routes require both auth AND organization
<ProtectedRoute requireOrganization={true}>
  <Dashboard />
</ProtectedRoute>
```

### 1.6 RLS Policies (Current)

```sql
-- Typical pattern: user must be member of the org
CREATE POLICY "leads_select" ON leads FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  )
);
```

### 1.7 Problems with Current Model for Prosumer Use Case

1. **Forced Organization:** Users must create/join an org even if working solo
2. **No Personal Data:** Everything belongs to org, not the individual
3. **Data Portability:** If user leaves org, they lose all their data
4. **Overhead:** Solo users deal with unnecessary org management UI
5. **Collaboration Friction:** Can't easily share specific items; it's all-or-nothing

---

## Part 2: Future System (User-Centric)

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER (primary)                          │
│  - Users own their data directly                            │
│  - No organization required to use the app                  │
│  - Data follows the user if they leave a team               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (optional)
┌─────────────────────────────────────────────────────────────┐
│                 ORGANIZATION (optional team)                 │
│  - Workspace for collaboration                              │
│  - Users can share specific items with their team           │
│  - Shared billing for team plans (optional)                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Ownership Model (Future)

| Entity | Owner | Sharing |
|--------|-------|---------|
| Leads | `user_id` (creator) | Optional: share with org via `org_id` |
| Deals | `user_id` (creator) | Optional: share with org via `org_id` |
| Tasks | `user_id` (creator) | Optional: assign to teammate |
| Notes | `user_id` (creator) | Inherits from parent lead/deal |
| Email Templates | `user_id` (creator) | Optional: share with org |
| Activities | `user_id` | Follows parent entity |
| Pipeline Stages | `user_id` OR `org_id` | Personal or shared pipelines |

### 2.3 Database Schema (Future)

**Modified Tables:**

```sql
-- leads: Add user_id as owner, make org_id optional
ALTER TABLE leads ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE leads ALTER COLUMN org_id DROP NOT NULL;

-- deals: Add user_id as owner, make org_id optional
ALTER TABLE deals ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE deals ALTER COLUMN org_id DROP NOT NULL;

-- tasks: Already has created_by, add user_id for ownership
ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE tasks ALTER COLUMN org_id DROP NOT NULL;

-- notes: Already has created_by, add user_id for ownership
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE notes ALTER COLUMN org_id DROP NOT NULL;

-- email_templates: Add user_id as owner, make org_id optional
ALTER TABLE email_templates ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE email_templates ALTER COLUMN org_id DROP NOT NULL;

-- activities: Add user_id for ownership (already has user_id for actor)
ALTER TABLE activities ALTER COLUMN org_id DROP NOT NULL;

-- Similar pattern for other tables...
```

**New Indexes:**
```sql
-- Index on user_id for fast lookups (primary query pattern)
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_email_templates_user_id ON email_templates(user_id);
```

### 2.4 Application Flow (Future)

```
1. User logs in (Google OAuth)
        │
        ▼
2. User lands directly on Dashboard (no org selection required)
        │
        ├── Solo mode: See only user's own data
        │
        └── Team mode (optional):
                │
                ├── Join/create organization
                │
                └── Toggle "Show team data" to see shared items
        │
        ▼
3. Data queries default to .eq('user_id', auth.uid())
        │
        ▼
4. RLS policies: user_id = auth.uid() OR (shared AND org member)
```

### 2.5 Key Code Patterns (Future)

**No Required Organization Context:**
```typescript
// User context replaces organization context as primary
const { user } = useAuth()

// Organization is optional for collaboration
const { selectedOrg } = useOrganization() // Can be null
```

**Data Queries (Future):**
```typescript
// Default: user's own data
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('user_id', user.id)

// With team data (optional)
const { data } = await supabase
  .from('leads')
  .select('*')
  .or(`user_id.eq.${user.id},org_id.eq.${selectedOrg?.id}`)
```

**Protected Routes (Simplified):**
```typescript
// Only auth required, org is optional
<ProtectedRoute requireOrganization={false}>
  <Dashboard />
</ProtectedRoute>
```

### 2.6 RLS Policies (Future)

```sql
-- User owns record OR record is shared with user's org
CREATE POLICY "leads_select" ON leads FOR SELECT USING (
  user_id = auth.uid()
  OR (
    org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  )
);

-- User can only modify their own records
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
  user_id = auth.uid()
);

-- User can only delete their own records
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (
  user_id = auth.uid()
);

-- Insert always assigns to current user
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
```

### 2.7 Sharing Model

**Option A: Simple org_id sharing (Recommended for MVP)**
- Set `org_id` on a record to share with entire org
- All org members can view shared records
- Only owner can modify/delete

**Option B: Granular sharing (Future enhancement)**
- Add `shared_with` JSONB column for specific user/team sharing
- More complex but more flexible

### 2.8 UI Changes

| Current | Future |
|---------|--------|
| Org selector in header (required) | Org selector (optional, for team features) |
| /select-organization (required step) | Removed or optional onboarding |
| All data is "org data" | "My Data" vs "Team Data" toggle |
| Create org to start | Start immediately, create team later |

---

## Part 3: Migration Plan

### Phase 1: Database Schema Changes (Non-Breaking)

**Goal:** Add user ownership columns without breaking existing functionality.

**Migration 1.1: Add user_id columns**
```sql
-- Add user_id to all data tables (nullable initially)
ALTER TABLE leads ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE deals ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE email_templates ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE activities ADD COLUMN owner_user_id UUID REFERENCES users(id);
ALTER TABLE pipeline_stages ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE daily_usage ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE calendly_meetings ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE feedback ADD COLUMN owner_user_id UUID REFERENCES users(id);
ALTER TABLE analytics_events ADD COLUMN owner_user_id UUID REFERENCES users(id);
ALTER TABLE email_tracking ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE lead_status_history ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE attachments ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE notifications ADD COLUMN user_id_owner UUID REFERENCES users(id);
```

**Migration 1.2: Create indexes**
```sql
CREATE INDEX idx_leads_user_id ON leads(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_deals_user_id ON deals(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_tasks_user_id ON tasks(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notes_user_id ON notes(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_email_templates_user_id ON email_templates(user_id) WHERE user_id IS NOT NULL;
```

**Migration 1.3: Backfill user_id from existing data**
```sql
-- For leads: assign to first org owner, or first member
UPDATE leads l
SET user_id = (
  SELECT uo.user_id
  FROM user_orgs uo
  WHERE uo.org_id = l.org_id
  ORDER BY
    CASE uo.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
    uo.created_at
  LIMIT 1
)
WHERE user_id IS NULL;

-- For tasks: use created_by if available, otherwise org owner
UPDATE tasks t
SET user_id = COALESCE(
  t.created_by,
  (SELECT uo.user_id FROM user_orgs uo WHERE uo.org_id = t.org_id ORDER BY uo.created_at LIMIT 1)
)
WHERE user_id IS NULL;

-- For notes: use created_by
UPDATE notes n
SET user_id = COALESCE(
  n.created_by,
  (SELECT uo.user_id FROM user_orgs uo WHERE uo.org_id = n.org_id ORDER BY uo.created_at LIMIT 1)
)
WHERE user_id IS NULL;

-- For deals: use created_by if available
UPDATE deals d
SET user_id = COALESCE(
  d.created_by,
  (SELECT uo.user_id FROM user_orgs uo WHERE uo.org_id = d.org_id ORDER BY uo.created_at LIMIT 1)
)
WHERE user_id IS NULL;

-- For email_templates: assign to first org member
UPDATE email_templates et
SET user_id = (
  SELECT uo.user_id FROM user_orgs uo WHERE uo.org_id = et.org_id ORDER BY uo.created_at LIMIT 1
)
WHERE user_id IS NULL;

-- Similar for other tables...
```

### Phase 2: Add Dual RLS Policies

**Goal:** Support both old (org-based) and new (user-based) access patterns.

**Migration 2.1: Update RLS policies to support both patterns**
```sql
-- Drop existing policies
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

-- New policies supporting both patterns
CREATE POLICY "leads_select" ON leads FOR SELECT USING (
  -- User owns the record
  user_id = auth.uid()
  OR
  -- Legacy: user is member of the org (for backward compatibility)
  (org_id IS NOT NULL AND org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (
  -- New records must have user_id set to current user
  user_id = auth.uid()
  OR
  -- Legacy: allow org-based insert during transition
  (org_id IS NOT NULL AND org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
  -- Only owner can update
  user_id = auth.uid()
  OR
  -- Legacy: org members can update during transition
  (org_id IS NOT NULL AND org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "leads_delete" ON leads FOR DELETE USING (
  -- Only owner can delete
  user_id = auth.uid()
);

-- Repeat for deals, tasks, notes, email_templates, etc.
```

### Phase 3: Application Code Updates

**Goal:** Update frontend to use user-centric queries while maintaining backward compatibility.

**3.1: Update API functions**

```typescript
// src/lib/api/leads.ts

// Old signature (deprecated but still works)
export async function getLeads(orgId: string, ...): Promise<...> {
  // ... existing implementation
}

// New signature (user-centric)
export async function getUserLeads(
  userId: string,
  options?: { includeShared?: boolean; orgId?: string }
): Promise<...> {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })

  if (options?.includeShared && options?.orgId) {
    // User's leads + shared with org
    query = query.or(`user_id.eq.${userId},org_id.eq.${options.orgId}`)
  } else {
    // Only user's leads
    query = query.eq('user_id', userId)
  }

  // ... rest of implementation
}
```

**3.2: Update hooks**

```typescript
// src/hooks/useLeads.ts

export function useLeads(options?: { includeShared?: boolean }) {
  const { user } = useAuth()
  const { selectedOrg } = useOrganization() // Now optional

  return useQuery({
    queryKey: ['leads', user?.id, selectedOrg?.id, options?.includeShared],
    queryFn: () => {
      if (!user) throw new Error('Not authenticated')
      return leadsApi.getUserLeads(user.id, {
        includeShared: options?.includeShared,
        orgId: selectedOrg?.id
      })
    },
    enabled: !!user,
  })
}
```

**3.3: Update mutations to set user_id**

```typescript
// src/lib/api/leads.ts

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...input,
      user_id: user.id,  // Always set owner
      org_id: input.org_id || null  // Optional sharing
    })
    .select()
    .single()

  // ...
}
```

**3.4: Update OrganizationContext**

```typescript
// src/contexts/OrganizationContext.tsx

// Make organization optional
const OrganizationContext = createContext<{
  selectedOrg: Organization | null  // Can be null
  userOrgs: UserOrg[]
  setOrganization: (org: Organization | null) => void
  // ...
}>()

// Don't block app usage without org
export function OrganizationProvider({ children }) {
  // ... existing logic but don't redirect if no org
}
```

**3.5: Update ProtectedRoute**

```typescript
// src/components/ProtectedRoute.tsx

export function ProtectedRoute({
  children,
  requireOrganization = false  // Changed default to false
}) {
  // Only require authentication, not organization
}
```

**3.6: Update routing**

```typescript
// src/App.tsx

// Remove forced redirect to /select-organization
// Make it an optional settings/onboarding step
```

### Phase 4: Make org_id Nullable

**Goal:** Allow records to exist without organization association.

**Migration 4.1: Make org_id nullable**
```sql
-- Only after Phase 3 is deployed and working
ALTER TABLE leads ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE deals ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE notes ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE email_templates ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE activities ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE pipeline_stages ALTER COLUMN org_id DROP NOT NULL;
-- Continue for other tables...
```

**Migration 4.2: Make user_id required for new records**
```sql
-- Add NOT NULL constraint with default
ALTER TABLE leads ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE deals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE notes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE email_templates ALTER COLUMN user_id SET NOT NULL;
```

### Phase 5: Final RLS Policies (User-Centric)

**Goal:** Finalize RLS for user-owned data with optional sharing.

```sql
-- Final leads policies
DROP POLICY IF EXISTS "leads_select" ON leads;
DROP POLICY IF EXISTS "leads_insert" ON leads;
DROP POLICY IF EXISTS "leads_update" ON leads;
DROP POLICY IF EXISTS "leads_delete" ON leads;

-- Select: own records + shared with my orgs
CREATE POLICY "leads_select" ON leads FOR SELECT USING (
  user_id = auth.uid()
  OR (
    org_id IS NOT NULL
    AND org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  )
);

-- Insert: must be owner
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Update: only owner can modify
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
  user_id = auth.uid()
);

-- Delete: only owner can delete
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (
  user_id = auth.uid()
);
```

### Phase 6: Cleanup (Optional)

**Goal:** Remove deprecated patterns and simplify.

**6.1: Simplify organization-related tables**
- Consider merging `organization_settings` into `organizations.settings`
- Consider if `user_settings` should be per-user only (not per-org)

**6.2: Update onboarding flow**
- Remove required org selection step
- Add optional "Create a team" in settings

**6.3: Update UI**
- Remove org selector from required header position
- Add "My Data" / "Team Data" toggle (if user has orgs)
- Add "Share with team" option on individual records

---

## Part 4: Migration Checklist

### Pre-Migration
- [x] Backup production database
- [x] Test migrations on staging/branch database
- [x] Review all RLS policies
- [x] Document rollback procedures

### Phase 1: Schema Changes ✅ COMPLETED (2026-01-15)
- [x] Apply Migration 1.1 (add user_id columns)
- [x] Apply Migration 1.2 (create indexes)
- [x] Apply Migration 1.3 (backfill user_id)
- [x] Verify all records have user_id populated

### Phase 2: Dual RLS ✅ COMPLETED (2026-01-15)
- [x] Apply Migration 2.1 (dual RLS policies)
- [x] Test that existing app still works
- [x] Test that new user-based queries work

### Phase 3: Application Updates ✅ COMPLETED (2026-01-15)
- [x] Create AuthContext for user authentication
- [x] Update API functions with new signatures (getUserLeads, createLead, etc.)
- [x] Update hooks to use user-centric queries (useLeads, useLeadStats, etc.)
- [x] Update mutations to set user_id
- [x] Make OrganizationContext optional
- [x] Update ProtectedRoute defaults (requireOrganization=false)
- [x] Update Dashboard to use user-centric queries
- [x] Wrap App with AuthProvider

### Phase 4: Make org_id Nullable
- [ ] Apply Migration 4.1 (nullable org_id)
- [ ] Apply Migration 4.2 (required user_id)
- [ ] Test creating records without org

### Phase 5: Final RLS
- [ ] Apply final RLS policies
- [ ] Remove legacy org-only policies
- [ ] Full security audit

### Phase 6: Cleanup
- [ ] Simplify settings tables
- [ ] Update onboarding flow
- [ ] Update UI components
- [ ] Remove deprecated code

---

## Part 5: Rollback Plan

If issues arise, rollback in reverse order:

1. **Phase 5/6:** Restore previous RLS policies from backup
2. **Phase 4:** Re-add NOT NULL constraint on org_id (if data allows)
3. **Phase 3:** Deploy previous app version
4. **Phase 2:** Restore previous RLS policies
5. **Phase 1:** Columns can remain (no harm), or drop if needed

**Critical:** Always maintain database backups before each phase.

---

## Part 6: Timeline Estimate

| Phase | Complexity | Dependencies |
|-------|------------|--------------|
| Phase 1 | Low | None |
| Phase 2 | Medium | Phase 1 |
| Phase 3 | High | Phase 2, significant code changes |
| Phase 4 | Low | Phase 3 deployed and stable |
| Phase 5 | Medium | Phase 4 |
| Phase 6 | Low | Phase 5 |

**Recommendation:** Deploy phases incrementally with monitoring between each phase. Phase 3 is the most complex and should be thoroughly tested.
