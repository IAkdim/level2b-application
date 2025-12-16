# Calendly Integration Deployment Guide

Deze guide helpt je de volledige Calendly integratie te deployen en te configureren.

## Overzicht

De Calendly integratie gebruikt **OAuth 2.0** voor authenticatie en de **Calendly API** voor meeting synchronisatie. Er zijn **geen webhooks nodig** - meetings worden gesynchroniseerd via de API met een handige sync knop.

### Wat je krijgt:
- ✅ 1-click OAuth verbinding met Calendly
- ✅ Automatisch scheduling links in cold emails
- ✅ Handmatige sync van meetings naar CRM
- ✅ Lead matching op basis van email
- ✅ Automatische status updates

---

## Stap 1: Database Migratie Uitvoeren

### Via Supabase Dashboard:
1. Ga naar je Supabase project: https://supabase.com/dashboard
2. Navigeer naar **SQL Editor**
3. Klik **New Query**
4. Open het bestand: `supabase/migrations/20251208_calendly_integration.sql`
5. Kopieer de volledige inhoud
6. Plak in de SQL Editor
7. Klik **Run** (rechtsonder)
8. Wacht tot de migratie succesvol is uitgevoerd

### Verwachte Resultaten:
✅ Nieuwe tabel: `organization_settings`
✅ Nieuwe tabel: `meetings`  
✅ RLS policies geconfigureerd
✅ Helper functions aangemaakt

---

## Stap 2: Edge Functions Deployen

Je hebt 4 Edge Functions nodig:

### 2.1 Deploy Functions via Supabase CLI

```bash
cd level2b-application

# Deploy alle functions
supabase functions deploy calendly-oauth-init
supabase functions deploy calendly-oauth-callback  
supabase functions deploy calendly-get-event-types
supabase functions deploy calendly-sync-meetings
```

**Opmerking**: De `calendly-webhook-handler` is optioneel en niet nodig als je alleen API sync gebruikt.

### 2.2 Verificatie
Ga naar Supabase Dashboard → **Edge Functions** en controleer of alle 4 functions de status **Active** hebben.

---

## Stap 3: Calendly OAuth Configureren

### 3.1 Calendly Developer Account
Als je nog geen Calendly Developer account hebt:
1. Ga naar: https://calendly.com/integrations/api_webhooks
2. Log in met je Calendly account
3. Navigeer naar **API & Webhooks**

### 3.2 OAuth Application Maken
1. Klik **Create New App** (of vergelijkbaar)
2. Vul in:
   - **App Name**: `Level2B CRM`
   - **Description**: `CRM integration for meeting sync`
   - **Redirect URI**: `https://nfqkrsvqyzfjinzlfuii.supabase.co/functions/v1/calendly-oauth-callback`
     
     ⚠️ **Belangrijk**: Vervang `nfqkrsvqyzfjinzlfuii` met je eigen Supabase project ID!

3. Klik **Create** of **Save**
4. Je ontvangt:
   - **Client ID** (bijv. `XlFZXEc-Jbofw68...`)
   - **Client Secret** (bijv. `QDJLQCvgaX6KKX...`)

### 3.3 Credentials Toevoegen aan .env
De credentials staan al in je `.env` file:

```env
CALENDLY_CLIENT_ID=XlFZXEc-Jbofw68-_tlE04knRVnuZJccPT_kunPx5xM
CALENDLY_CLIENT_SECRET=QDJLQCvgaX6KKXmjxek4XXv_rF9lf_pS5ycHHF8FzMg
CALENDLY_WEBHOOK_SIGNING_KEY=2lybknFl--U_CDzZWEvCB6bYWtHI1fKT-8pdx6R2NXc
```

✅ Deze zijn al geconfigureerd!

### 3.4 Secrets Uploaden naar Supabase
```bash
# Upload secrets naar Supabase Edge Functions (alleen CLIENT_ID en SECRET nodig)
supabase secrets set CALENDLY_CLIENT_ID=XlFZXEc-Jbofw68-_tlE04knRVnuZJccPT_kunPx5xM
supabase secrets set CALENDLY_CLIENT_SECRET=QDJLQCvgaX6KKXmjxek4XXv_rF9lf_pS5ycHHF8FzMg
```

**Opmerking**: De webhook signing key is niet nodig als je geen webhooks gebruikt.

---

## Stap 4: Frontend Testen (Geen Webhook Configuratie Nodig!)
```bash
cd level2b-application
npm run dev
```

### 5.2 Calendly Verbinden
1. Open app: http://localhost:5173
2. Ga naar **Configuration** → **Company** tab
3. Scroll naar **Calendly Integratie** sectie
4. Klik **Verbind Calendly**
5. Je wordt doorgestuurd naar Calendly OAuth
6. Log in en geef toestemming
7. Je wordt teruggestuurd naar de app met succes melding

### 4.2 Event Type Selecteren
1. Na succesvolle verbinding zie je een dropdown
2. Selecteer je standaard meeting type (bijv. "30 Min Meeting")
3. Klik **Instellingen Opslaan**

---

## Stap 5: Meetings Synchroniseren

### 5.1 Handmatige Sync
1. Ga naar **Meetings** tab
2. Klik op **Sync Calendly** knop (rechtsboven)
3. Meetings van de afgelopen 30 dagen en komende 90 dagen worden gesynchroniseerd
4. Je ziet een melding met aantal nieuwe meetings

### 5.2 Automatische Lead Matching
- Als een meeting attendee email overeenkomt met een lead in je database:
  - Meeting wordt automatisch gekoppeld
  - Lead status wordt "meeting_scheduled"
  - Activity wordt toegevoegd aan timeline

---

## Stap 6: End-to-End Test

### 6.1 Cold Email Template Genereren
1. Ga naar **Templates** tab
2. Vul bedrijfsinfo in (als nog niet gedaan)
3. Klik **Nieuwe Template Genereren**
4. De gegenereerde email zou je Calendly scheduling link moeten bevatten

### 6.2 Test Meeting Booking
1. Open de Calendly link uit de template
2. Boek een test meeting
3. Ga terug naar **Meetings** tab
4. Klik **Sync Calendly** knop
5. De meeting zou nu moeten verschijnen

### 6.3 Lead Matching
Als het email adres van de meeting attendee overeenkomt met een lead in je database:
- De meeting wordt automatisch gekoppeld aan die lead
- Lead status wordt bijgewerkt naar "meeting_scheduled"
- Er wordt een activity aangemaakt in de lead timeline

---

## Troubleshooting

### Issue: Calendly verbinding mislukt
**Oplossing**:
- Controleer of `CALENDLY_CLIENT_ID` en `CALENDLY_CLIENT_SECRET` correct zijn ingesteld
- Verificeer redirect URI in Calendly Developer settings
- Check Edge Function logs in Supabase Dashboard

### Issue: Meetings verschijnen niet na sync
**Oplossing**:
- Controleer of je meetings hebt binnen 30 dagen geleden tot 90 dagen vooruit
- Verificeer dat Calendly token nog geldig is
- Probeer opnieuw te verbinden via Configuration page
- Check Edge Function logs voor `calendly-sync-meetings`

### Issue: Event types worden niet geladen
**Oplossing**:
- Controleer of OAuth token nog geldig is
- Probeer opnieuw te verbinden via Configuration page
- Check of je actieve event types hebt in Calendly

---

## Checklist Deployment

- [ ] Database migratie uitgevoerd
- [ ] Alle 4 Edge Functions gedeployed
- [ ] Calendly OAuth app aangemaakt
- [ ] Client ID en Secret geconfigureerd
- [ ] Secrets geupload naar Supabase
- [ ] Frontend getest (OAuth flow)
- [ ] Event type geselecteerd
- [ ] Test meeting geboekt
- [ ] Meeting gesynchroniseerd en verschijnt in Meetings tab

---

## Hoe Meetings Syncen Werkt

### Via API (Geen Webhooks):
1. **Handmatige Trigger**: Gebruiker klikt "Sync Calendly" knop
2. **API Call**: Edge function haalt scheduled events op via Calendly API
3. **Timeframe**: Afgelopen 30 dagen + komende 90 dagen
4. **Deduplicatie**: Alleen nieuwe meetings worden toegevoegd
5. **Lead Matching**: Automatisch koppelen op basis van email
6. **Status Updates**: Lead status wordt bijgewerkt

### Voordelen van API Sync:
- ✅ Geen webhook configuratie nodig
- ✅ Simpeler om op te zetten
- ✅ Gebruiker heeft controle over sync timing
- ✅ Geen signing keys of HMAC verificatie
- ✅ Werkt met standaard OAuth 2.0

---

## Next Steps

Na succesvolle deployment kun je:
1. ✅ Cold emails genereren met Calendly links
2. ✅ Meetings syncen met één klik
3. ✅ Lead status automatisch updaten
4. ✅ Meeting overview in Meetings tab
5. ✅ Lead timeline met meeting activities

**Geniet van je nieuwe Calendly integratie! 🎉**
