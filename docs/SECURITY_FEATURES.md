# Lead Generator Security Features

## 📋 Overzicht

Deze security features beschermen de Lead Generator tegen misbruik en geven inzicht in API usage.

## 🔒 Geïmplementeerde Features

### 1. Rate Limiting per Gebruiker
- **Limiet:** 50 leads per uur per gebruiker
- **Reset:** Automatisch elk uur (bijv. 14:00, 15:00)
- **Database:** `lead_generation_rate_limits` tabel
- **Functies:**
  - `get_hourly_rate_limit()` - Check huidige limiet
  - `increment_rate_limit()` - Increment na generatie
  - `cleanup_old_rate_limits()` - Cleanup oude records (>24u)

**Error message bij limiet:**
```
Rate limit exceeded. You can generate X more leads this hour. 
Limit resets at HH:00.
```

### 2. API Usage Monitoring
- **Database:** `api_usage_logs` tabel
- **Gelogde data:**
  - Organization ID en User ID
  - Endpoint en method (google_maps/social_media)
  - Leads requested vs generated
  - Success/failure met error message
  - Response tijd (duration_ms)
  - IP address en User-Agent
  - Timestamp

**Functies:**
- `get_api_usage_stats()` - Statistics (7 dagen)
  - Total calls, success rate
  - Leads requested vs generated
  - Average response time
  - Breakdown per method
  - Breakdown per dag

### 3. Monitoring Dashboard
- **Route:** `/api-monitoring`
- **Features:**
  - Real-time rate limit status
  - Usage statistics (7 dagen)
  - Success/failure rates
  - Performance metrics (avg response time)
  - Recent API calls tabel
  - Method breakdown (Google Maps vs Social Media)

## 🗄️ Database Schema

### Tabel: `api_usage_logs`
```sql
id                  UUID PRIMARY KEY
organization_id     UUID (FK)
user_id            UUID (FK)
endpoint           TEXT ('generate-leads')
method             TEXT ('google_maps'/'social_media')
leads_requested    INTEGER
leads_generated    INTEGER
success            BOOLEAN
error_message      TEXT (nullable)
duration_ms        INTEGER (nullable)
ip_address         TEXT (nullable)
user_agent         TEXT (nullable)
created_at         TIMESTAMPTZ
```

### Tabel: `lead_generation_rate_limits`
```sql
id                  UUID PRIMARY KEY
user_id            UUID (FK)
organization_id    UUID (FK)
leads_generated    INTEGER
hour_start         TIMESTAMPTZ (e.g., 2025-12-30 14:00:00)
created_at         TIMESTAMPTZ
updated_at         TIMESTAMPTZ

UNIQUE(user_id, organization_id, hour_start)
```

## 🚀 Deployment

### 1. Database Migratie Uitvoeren
```bash
cd level2b-application

# Via Supabase CLI
supabase db push

# Of handmatig in Supabase Dashboard
# → SQL Editor → Run migration file
```

### 2. Edge Function Deployen
```bash
npx supabase functions deploy generate-leads
```

### 3. Service Role Key Toevoegen
**Belangrijk:** De Edge Function heeft de service role key nodig voor rate limiting.

1. Ga naar Supabase Dashboard
2. Settings → Edge Functions → Secrets
3. Voeg toe: `SUPABASE_SERVICE_ROLE_KEY`
4. Waarde: Te vinden in Settings → API → `service_role` key

## 📊 Usage

### Frontend - Rate Limit Check
Automatisch gecontroleerd bij elke lead generation:
```typescript
// In GenerateLeadsDialog.tsx - al geïmplementeerd
const response = await generateLeads({...})
if (response.error?.includes('Rate limit exceeded')) {
  // Show error to user
}
```

### Frontend - Monitoring Dashboard
```typescript
// Open via sidebar: API Monitoring
// Of navigeer naar: /api-monitoring

// Toont:
// - Hourly rate limit status
// - 7-day usage statistics
// - Recent API calls
// - Success/failure breakdown
```

### Backend - Manual Queries
```sql
-- Check user's current hourly limit
SELECT * FROM get_hourly_rate_limit(
  'user-uuid-here',
  'org-uuid-here'
);

-- Get organization statistics
SELECT * FROM get_api_usage_stats(
  'org-uuid-here',
  7  -- days
);

-- View recent logs
SELECT * FROM api_usage_logs
WHERE organization_id = 'org-uuid-here'
ORDER BY created_at DESC
LIMIT 50;
```

## 🔧 Configuratie

### Rate Limit Aanpassen
In `20251230_lead_generator_security.sql`, regel 78:
```sql
v_max_leads_per_hour INTEGER := 50; -- Pas hier aan
```

### Cleanup Schedule
Optioneel: Maak een scheduled job voor cleanup:
```sql
-- In Supabase Dashboard → Database → Functions
-- Maak een cron job:
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 * * * *', -- Elk uur
  $$ SELECT cleanup_old_rate_limits(); $$
);
```

## 🔐 Row Level Security (RLS)

### `api_usage_logs`
- **SELECT:** Users kunnen alleen logs van hun eigen organizaties zien
- **INSERT:** Alleen service role (Edge Function) kan logs inserten

### `lead_generation_rate_limits`
- **SELECT:** Users kunnen alleen hun eigen rate limits zien
- **ALL:** Service role heeft volledige toegang

## 📈 Performance

### Indexes
```sql
-- api_usage_logs
idx_api_usage_logs_org        (organization_id, created_at DESC)
idx_api_usage_logs_user       (user_id, created_at DESC)
idx_api_usage_logs_endpoint   (endpoint, created_at DESC)

-- lead_generation_rate_limits
idx_rate_limits_user_hour     (user_id, organization_id, hour_start DESC)
```

### Query Performance
- Rate limit check: **~5ms** (indexed, single record)
- Usage stats: **~50ms** (7 days aggregation)
- Recent logs: **~10ms** (indexed, 50 records)

## 🛡️ Security Best Practices

### ✅ Geïmplementeerd
- Rate limiting per user (50/hour)
- API call logging met IP + User-Agent
- RLS policies op alle tabellen
- Service role key voor admin operations
- Error messages zonder sensitive data

### ⚠️ Extra Aanbevelingen

#### 1. IP Restricties op Google API Keys
**In Google Cloud Console:**
1. Ga naar APIs & Services → Credentials
2. Selecteer je API key
3. Scroll naar "Application restrictions"
4. Kies "IP addresses"
5. Voeg Supabase Edge Function IPs toe

**Supabase IPs ophalen:**
```bash
# Via Supabase support ticket
# Of test met:
curl https://[your-project].supabase.co/functions/v1/generate-leads
# Check response headers voor IP
```

#### 2. Organization-Level Rate Limiting
Optioneel: Voeg ook org-level limits toe naast user-level:
```sql
-- In get_hourly_rate_limit():
v_max_leads_per_hour_org INTEGER := 200; -- 200 per org
```

#### 3. Cost Monitoring Alerts
**Supabase Dashboard:**
1. Settings → Billing
2. Set up alerts voor:
   - Database size
   - Edge Function invocations
   - Bandwidth usage

**Google Cloud:**
1. Console → Billing → Budgets & Alerts
2. Create budget voor Maps API / Custom Search API
3. Set threshold (bijv. €10/maand)

#### 4. Anomaly Detection
Optioneel: Monitor voor abnormale patronen:
```sql
-- Detecteer users die vaak falen (mogelijk attacks)
SELECT 
  user_id,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE success = false) as failed_calls,
  (COUNT(*) FILTER (WHERE success = false)::FLOAT / COUNT(*)) as failure_rate
FROM api_usage_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) FILTER (WHERE success = false)::FLOAT / COUNT(*) > 0.5
ORDER BY total_calls DESC;
```

## 🐛 Troubleshooting

### Rate Limit Werkt Niet
1. Check of migratie is uitgevoerd:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name = 'lead_generation_rate_limits';
   ```

2. Check of functie bestaat:
   ```sql
   SELECT * FROM pg_proc 
   WHERE proname = 'get_hourly_rate_limit';
   ```

3. Check service role key in Edge Function secrets

### Logs Verschijnen Niet
1. Check RLS policies:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'api_usage_logs';
   ```

2. Check of service role key correct is

3. Check Edge Function logs:
   ```bash
   supabase functions logs generate-leads
   ```

### Monitoring Dashboard Laadt Niet
1. Check of gebruiker in een organization zit
2. Check browser console voor errors
3. Check of RPC functions werken:
   ```sql
   SELECT * FROM get_api_usage_stats('org-uuid', 7);
   ```

## 📝 Changelog

### 2025-12-30 - Initial Release
- ✅ Rate limiting (50 leads/hour/user)
- ✅ API usage logging
- ✅ Monitoring dashboard
- ✅ Database migration
- ✅ RLS policies
- ✅ Performance indexes
- ✅ Cleanup functions
- ✅ Statistics aggregation

## 🔗 Gerelateerde Files

- `/supabase/migrations/20251230_lead_generator_security.sql` - Database schema
- `/supabase/functions/generate-leads/index.ts` - Edge Function met rate limiting
- `/src/lib/api/apiMonitoring.ts` - Frontend API wrapper
- `/src/pages/ApiMonitoring.tsx` - Monitoring dashboard UI
- `/src/components/AppSidebar.tsx` - Navigation met API Monitoring link
