# Calendly Integratie - Implementatie Samenvatting

## ✅ Wat is geïmplementeerd

### 1. Database Structuur
- **`organization_settings`** tabel met Calendly OAuth tokens en bedrijfsinfo
- **`meetings`** tabel voor meeting synchronisatie
- RLS policies voor beveiliging
- Helper functions voor lead matching
- Automatische triggers voor activity creation

**Migratie**: `supabase/migrations/20251208_calendly_integration.sql`

### 2. Edge Functions (4 stuks)

| Function | Doel | Gebruikt |
|----------|------|----------|
| `calendly-oauth-init` | Genereer OAuth URL | Bij OAuth start |
| `calendly-oauth-callback` | Handle OAuth callback, sla tokens op | Na OAuth toestemming |
| `calendly-get-event-types` | Haal scheduling links op | Event type selector |
| `calendly-sync-meetings` | Sync meetings via API | Sync knop in Meetings tab |

**Bonus**: `calendly-webhook-handler` (optioneel, niet nodig voor API sync)

### 3. Frontend Componenten

**CompanySettingsForm** (volledig vernieuwd):
- OAuth "Verbind Calendly" knop
- Connection status indicator (groen = verbonden, oranje = niet verbonden)
- Event type selector dropdown
- Disconnect optie
- Integratie met Supabase database (niet localStorage)

**Meetings Page** (geüpdatet):
- Real-time data uit database
- "Sync Calendly" knop voor handmatige sync
- Calendly connection warning
- Meeting statistics dashboard
- Lead/company informatie gekoppeld

### 4. API Layer

**`src/lib/api/calendly.ts`**:
- `getOrganizationSettings()` - Haal settings op
- `updateOrganizationSettings()` - Update settings
- `initiateCalendlyOAuth()` - Start OAuth flow
- `getCalendlyEventTypes()` - Haal event types op
- `disconnectCalendly()` - Verwijder verbinding
- `isCalendlyConnected()` - Check connection status

**`src/lib/api/meetings.ts`**:
- `getMeetings()` - Haal alle meetings op
- `getUpcomingMeetings()` - Haal komende meetings op
- `getMeetingById()` - Haal specifieke meeting op
- `createMeeting()` - Maak manual meeting
- `updateMeetingStatus()` - Update status
- `deleteMeeting()` - Verwijder meeting
- `syncCalendlyMeetings()` - Sync via API

---

## 🚀 Hoe het werkt

### OAuth Flow
```
1. User klikt "Verbind Calendly"
2. Edge Function genereert OAuth URL
3. User wordt doorgestuurd naar Calendly
4. User geeft toestemming
5. Calendly redirect naar callback function
6. Callback function:
   - Exchanged code voor access token
   - Haalt user info op
   - Slaat tokens op in database
7. User wordt teruggestuurd naar app
8. Success melding + event types laden
```

### Meeting Sync (Via API, Geen Webhooks!)
```
1. User klikt "Sync Calendly" knop
2. Edge function `calendly-sync-meetings`:
   - Haalt scheduled events op via Calendly API
   - Timeframe: -30 dagen tot +90 dagen
   - Voor elk event:
     * Check of al bestaat (skip duplicates)
     * Haal invitee details op
     * Zoek matching lead op email
     * Maak meeting record
     * Update lead status indien match
3. Return: {synced: X, skipped: Y, total: Z}
4. Toast notificatie toont resultaat
5. Meetings table wordt herladen
```

### Lead Matching Logic
```sql
SELECT id FROM leads
WHERE org_id = :orgId
AND LOWER(email) = LOWER(:attendee_email)
LIMIT 1
```

Als match gevonden:
- ✅ Meeting.lead_id = lead.id
- ✅ Lead.status = 'meeting_scheduled'
- ✅ Activity created in timeline
- ✅ Lead.last_contact_at updated

---

## 📋 Deployment Checklist

### Database
- [ ] Run `20251208_calendly_integration.sql` in Supabase SQL Editor
- [ ] Verify tables: `organization_settings`, `meetings`
- [ ] Check RLS policies active

### Edge Functions
```bash
supabase functions deploy calendly-oauth-init
supabase functions deploy calendly-oauth-callback
supabase functions deploy calendly-get-event-types
supabase functions deploy calendly-sync-meetings
```

### Secrets (reeds in .env)
```bash
supabase secrets set CALENDLY_CLIENT_ID=XlFZXEc-Jbofw68-_tlE04knRVnuZJccPT_kunPx5xM
supabase secrets set CALENDLY_CLIENT_SECRET=QDJLQCvgaX6KKXmjxek4XXv_rF9lf_pS5ycHHF8FzMg
```

### Calendly Developer Console
1. Ga naar: https://calendly.com/integrations/api_webhooks
2. Maak nieuwe OAuth app
3. Set redirect URI: `https://[PROJECT].supabase.co/functions/v1/calendly-oauth-callback`
4. Kopieer Client ID & Secret
5. Upload naar Supabase secrets

### Test Flow
1. ✅ Open app → Configuration → Company tab
2. ✅ Klik "Verbind Calendly"
3. ✅ OAuth flow completen
4. ✅ Event type selecteren
5. ✅ Settings opslaan
6. ✅ Ga naar Templates tab
7. ✅ Genereer cold email (bevat Calendly link)
8. ✅ Boek test meeting via Calendly link
9. ✅ Ga naar Meetings tab
10. ✅ Klik "Sync Calendly"
11. ✅ Verify meeting verschijnt

---

## 🔑 Belangrijke Verschillen met Webhooks

| Aspect | API Sync (Geïmplementeerd) | Webhooks (Niet nodig) |
|--------|----------------------------|------------------------|
| Setup | ✅ Simpel, alleen OAuth | ❌ Complex, extra configuratie |
| Credentials | ✅ Client ID + Secret | ❌ + Signing Key |
| Sync Trigger | ✅ User controlled (knop) | ❌ Automatic (push) |
| Latency | ✅ On-demand (seconden) | ❌ Real-time (instant) |
| Debugging | ✅ Eenvoudig via logs | ❌ Moeilijk, async |
| Maintenance | ✅ Minimaal | ❌ Webhook expiry, rotation |

**Conclusie**: Voor Level2b gebruik cases is API sync meer dan voldoende. Meetings worden gesynchroniseerd wanneer de gebruiker dat wil, zonder complexe webhook configuratie.

---

## 🎯 Gebruiksscenario's

### Scenario 1: Cold Email met Calendly Link
```
1. User genereert cold email template
2. Template bevat Calendly scheduling link
3. Prospect ontvangt email
4. Prospect boekt meeting via link
5. User klikt "Sync Calendly" in app
6. Meeting verschijnt in Meetings tab
7. Als prospect email = lead email → auto-koppeling
```

### Scenario 2: Meeting Overview
```
1. User gaat naar Meetings tab
2. Ziet alle meetings (gesynchroniseerd)
3. Meetings tonen:
   - Titel & beschrijving
   - Attendee naam & email
   - Datum & tijd
   - Status (gepland/voltooid/geannuleerd)
   - Link naar Calendly event
   - Gekoppelde lead (indien match)
```

### Scenario 3: Lead Timeline
```
1. Lead boekt meeting
2. User synct meetings
3. Meeting wordt gekoppeld aan lead
4. Lead detail page toont:
   - Status: "meeting_scheduled"
   - Activity: "Meeting scheduled: [Titel]"
   - Last contact: [Meeting datum]
```

---

## 📞 Support & Documentatie

**Deployment Guide**: `CALENDLY_DEPLOYMENT_GUIDE.md`
**Migratie**: `supabase/migrations/20251208_calendly_integration.sql`
**Edge Functions**: `supabase/functions/calendly-*/index.ts`

**Calendly API Docs**: https://developer.calendly.com/
**OAuth 2.0 Flow**: https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-authentication

---

**Status**: ✅ Ready for deployment
**Laatst geüpdatet**: 11 december 2025
