# Cold Email Template Generator - Deployment Guide (Simplified)

## ✅ Wat is er gemaakt:

### 1. Edge Function  
**Bestand:** `supabase/functions/generate-cold-email-template/index.ts`

AI-powered template generator:
- Gebruikt Claude Haiku voor creativiteit en nieuwsgierigheid
- Input: bedrijfsinformatie (company, service, USPs, target audience)
- Output: subject + body + tone + target segment
- Prompt geoptimaliseerd voor Nederlandse cold emails
- **Geen database opslag - alleen real-time generatie**

### 2. LocalStorage Settings
**Bestand:** `src/lib/api/settings.ts`

Company settings met localStorage:
- Bedrijfsinformatie lokaal opgeslagen in browser
- Geen Supabase database nodig
- Persistent tussen sessies

### 3. API Functions
**Bestand:** `src/lib/api/templates.ts`

Alleen template generatie functie:
- generateColdEmailTemplate() - roept Edge Function aan
- Geen CRUD operations - templates worden niet opgeslagen

### 4. UI Components
**Bestanden:**
- `src/pages/Templates.tsx` - Template generator met preview
- `src/components/CompanySettingsForm.tsx` - Bedrijfsinformatie formulier
- `src/pages/Configuration.tsx` - Uitgebreid met Company tab

## 🚀 Deployment Stappen:

### Stap 1: Edge Function Deployen

1. **Open Edge Functions**
   - Ga naar https://supabase.com/dashboard
   - Selecteer je project (nfqkrsvqyzfjinzlfuii)
   - Klik "Edge Functions" in het menu
   - Klik "Create a new function"

2. **Function Details**
   - **Name:** `generate-cold-email-template`
   - **Region:** Kies dichtstbijzijnde (Europe)

3. **Function Code**
   - Open `supabase/functions/generate-cold-email-template/index.ts`
   - Kopieer HELE bestand
   - Plak in de function editor

4. **Controleer CLAUDE_API_KEY**
   - Ga naar "Secrets" tab in Edge Functions
   - Controleer of `CLAUDE_API_KEY` bestaat
   - Zo niet: voeg toe met je Anthropic API key

5. **Deploy**
   - Klik "Deploy function"
   - Wacht tot status "Active" is

### Stap 2: Test de Functionaliteit

1. **Vul Bedrijfsinformatie In**
   - Ga naar `/configuration` in je app
   - Klik op "Bedrijfsinformatie" tab (eerste tab)
   - Vul minimaal in:
     - Bedrijfsnaam
     - Product/Service  
     - Doelgroep
   - Voeg ook USPs toe (aanbevolen)
   - Klik "Instellingen Opslaan"
   - ℹ️ **Informatie wordt lokaal opgeslagen in je browser**

2. **Genereer Template**
   - Ga naar `/templates`
   - Klik "Nieuwe Template Genereren"
   - Wacht 5-10 seconden (AI genereert)
   - Review en pas aan indien nodig
   - Klik "Kopieer" om te gebruiken

3. **Gebruik Template**
   - Laatst gegenereerde template wordt getoond
   - Klik "Bekijk" om preview te zien
   - Klik "Kopieer" om naar klembord te kopiëren
   - Genereer nieuwe template om vorige te vervangen

## 🧪 Test Checklist:

- [ ] Edge Function deployed en Active
- [ ] CLAUDE_API_KEY configured
- [ ] Bedrijfsinformatie invulbaar op Configuration
- [ ] Settings blijven opgeslagen na refresh (localStorage)
- [ ] Validatie werkt (verplichte velden)
- [ ] Template generatie werkt
- [ ] Template preview werkt
- [ ] Template kopiëren werkt

## 📝 Gebruikersinstructies:

### Voor Eerste Gebruik:

1. **Configureer Bedrijf** (VERPLICHT)
   - Ga naar Configuratie → Bedrijfsinformatie
   - Vul minimaal deze 3 velden in:
     - Bedrijfsnaam
     - Product/Service
     - Doelgroep
   
2. **Voeg Extra Info Toe** (Aanbevolen)
   - Bedrijfsomschrijving
   - 3-5 USPs
   - Calendly link (voor meeting requests)
   - Industrie

### Template Genereren:

1. Ga naar "Templates" pagina
2. Klik "Nieuwe Template Genereren"
3. AI genereert binnen 10 seconden een template
4. Review en pas aan:
   - Template naam
   - Onderwerp
   - Email body
5. Klik "Kopieer" om te gebruiken

### Template Gebruiken:

- **Bekijk**: Full preview van subject + body
- **Kopiëren**: Kopieer naar klembord voor gebruik
- **Nieuw Genereren**: Genereer nieuwe variant (vervangt vorige)

## 🎨 AI Prompt Strategie:

De Edge Function gebruikt een geoptimaliseerde prompt voor Nederlandse cold emails:

**Kenmerken:**
- ✅ Wekt nieuwsgierigheid op (geen harde verkoop)
- ✅ Focus op hun probleem (niet jouw product)
- ✅ Kort en bondig (max 120 woorden)
- ✅ Zachte CTA (geen pushy taal)
- ✅ Persoonlijk en relevant
- ✅ Professioneel maar toegankelijk
- ✅ GEEN placeholders of handtekeningen

**Input gebruikt:**
- Bedrijfsnaam en beschrijving
- Product/service
- Unique Selling Points
- Target audience
- Industry
- Calendly link (optioneel)

## 🔧 Troubleshooting:

### "Fout bij genereren template"
- Check Edge Function logs in Supabase Dashboard
- Controleer CLAUDE_API_KEY secret
- Check Claude API limits/credits

### "Vul eerst bedrijfsinformatie in"
- Ga naar Configuration → Bedrijfsinformatie
- Vul minimaal verplichte velden in
- Sla op en probeer opnieuw

### Settings verdwijnen na refresh
- Controleer of localStorage enabled is in browser
- Check browser console voor errors
- Probeer in andere browser

### Edge Function timeout
- Templates genereren kan 5-10 seconden duren
- Bij timeout: check Supabase Edge Function logs
- Mogelijk Claude API rate limiting

## 💡 Tips:

1. **USPs zijn krachtig**: Hoe meer USPs, hoe beter de template
2. **Test meerdere varianten**: Genereer 3-4 templates en kies de beste
3. **Personaliseer**: Pas gegenereerde templates aan voor specifieke segmenten
4. **Calendly link**: Verhoogt conversie voor meeting requests
5. **Kopieer naar document**: Bewaar goede templates in eigen systeem

## 📊 Data Model:

```
localStorage (browser)
  └─ level2b_company_settings
      ├─ company_name (required)
      ├─ product_service (required)
      ├─ target_audience (required)
      ├─ company_description
      ├─ unique_selling_points (array)
      ├─ industry
      ├─ calendly_link
      └─ contact info

Edge Function (real-time, geen storage)
  └─ generate-cold-email-template
      Input: CompanySettings
      Output: GeneratedTemplate
          ├─ templateName
          ├─ subject
          ├─ body
          ├─ tone
          └─ targetSegment
```

## 🔐 Security:

- ✅ Claude API key server-side only (niet in browser)
- ✅ Edge Function authentication via Supabase session
- ✅ Company settings lokaal in browser (geen server opslag)
- ✅ Geen PII of gevoelige data in database

## ✨ Klaar!

Het cold email template systeem is nu volledig operationeel. Gebruikers kunnen:
- Bedrijfsinformatie configureren (lokaal opgeslagen)
- AI templates genereren on-demand
- Templates kopiëren voor gebruik
- Nieuwe templates genereren wanneer nodig

**Belangrijkste verschil:** Geen database tables nodig! Alles werkt met localStorage en real-time AI generatie.

Voor vragen of problemen: check de browser console en Supabase Edge Function logs!


AI-powered template generator:
- Gebruikt Claude Haiku voor creativiteit en nieuwsgierigheid
- Input: bedrijfsinformatie (company, service, USPs, target audience)
- Output: subject + body + tone + target segment
- Prompt geoptimaliseerd voor Nederlandse cold emails

### 3. API Functions
**Bestanden:**
- `src/lib/api/templates.ts` - CRUD operations voor templates
- `src/lib/api/settings.ts` - Settings management en validatie

### 4. UI Components
**Bestanden:**
- `src/pages/Templates.tsx` - Template library met generator
- `src/components/CompanySettingsForm.tsx` - Bedrijfsinformatie formulier
- `src/pages/Configuration.tsx` - Uitgebreid met Company tab

## 🚀 Deployment Stappen:

### Stap 1: Database Migratie Uitvoeren

1. **Open Supabase Dashboard** 
   - Ga naar https://supabase.com/dashboard
   - Selecteer je project (nfqkrsvqyzfjinzlfuii)

2. **SQL Editor**
   - Klik op "SQL Editor" in het menu
   - Klik op "New query"

3. **Kopieer en Run Migratie**
   - Open `supabase/migrations/20251127_email_templates.sql`
   - Kopieer HELE bestand (alle regels)
   - Plak in SQL Editor
   - Klik "Run" onderaan

4. **Verificatie**
   Controleer of de tables zijn aangemaakt:
   ```sql
   SELECT * FROM organization_settings LIMIT 1;
   SELECT * FROM email_templates LIMIT 1;
   ```

### Stap 2: Edge Function Deployen

1. **Open Edge Functions**
   - In Supabase Dashboard → "Edge Functions"
   - Klik "Create a new function"

2. **Function Details**
   - **Name:** `generate-cold-email-template`
   - **Region:** Kies dichtstbijzijnde (Europe)

3. **Function Code**
   - Open `supabase/functions/generate-cold-email-template/index.ts`
   - Kopieer HELE bestand
   - Plak in de function editor

4. **Controleer CLAUDE_API_KEY**
   - Ga naar "Secrets" tab in Edge Functions
   - Controleer of `CLAUDE_API_KEY` bestaat
   - Zo niet: voeg toe met je Anthropic API key

5. **Deploy**
   - Klik "Deploy function"
   - Wacht tot status "Active" is

### Stap 3: Test de Functionaliteit

1. **Vul Bedrijfsinformatie In**
   - Ga naar `/configuration` in je app
   - Klik op "Bedrijfsinformatie" tab (eerste tab)
   - Vul minimaal in:
     - Bedrijfsnaam
     - Product/Service  
     - Doelgroep
   - Voeg ook USPs toe (aanbevolen)
   - Klik "Instellingen Opslaan"

2. **Genereer Template**
   - Ga naar `/templates`
   - Klik "Nieuwe Template Genereren"
   - Wacht 5-10 seconden (AI genereert)
   - Review en pas aan indien nodig
   - Klik "Template Opslaan"

3. **Gebruik Template**
   - Template verschijnt in grid
   - Klik "Bekijk" om preview te zien
   - Klik "Kopiëren" om te gebruiken
   - Templates zijn herbruikbaar

## 🧪 Test Checklist:

- [ ] Database tables aangemaakt (organization_settings, email_templates)
- [ ] Edge Function deployed en Active
- [ ] CLAUDE_API_KEY configured
- [ ] Bedrijfsinformatie invulbaar op Configuration
- [ ] Validatie werkt (verplichte velden)
- [ ] Template generatie werkt
- [ ] Template preview werkt
- [ ] Template opslaan werkt
- [ ] Template kopiëren werkt
- [ ] Template activeren/deactiveren werkt
- [ ] Template verwijderen werkt

## 📝 Gebruikersinstructies:

### Voor Eerste Gebruik:

1. **Configureer Bedrijf** (VERPLICHT)
   - Ga naar Configuratie → Bedrijfsinformatie
   - Vul minimaal deze 3 velden in:
     - Bedrijfsnaam
     - Product/Service
     - Doelgroep
   
2. **Voeg Extra Info Toe** (Aanbevolen)
   - Bedrijfsomschrijving
   - 3-5 USPs
   - Calendly link (voor meeting requests)
   - Industrie

### Template Genereren:

1. Ga naar "Templates" pagina
2. Klik "Nieuwe Template Genereren"
3. AI genereert binnen 10 seconden een template
4. Review en pas aan:
   - Template naam
   - Onderwerp
   - Email body
5. Klik "Template Opslaan"

### Template Gebruiken:

- **Bekijk**: Full preview van subject + body
- **Kopiëren**: Kopieer naar klembord voor gebruik
- **Activeren/Deactiveren**: Toggle actieve status
- **Verwijderen**: Permanent verwijderen (met bevestiging)

## 🎨 AI Prompt Strategie:

De Edge Function gebruikt een geoptimaliseerde prompt voor Nederlandse cold emails:

**Kenmerken:**
- ✅ Wekt nieuwsgierigheid op (geen harde verkoop)
- ✅ Focus op hun probleem (niet jouw product)
- ✅ Kort en bondig (max 120 woorden)
- ✅ Zachte CTA (geen pushy taal)
- ✅ Persoonlijk en relevant
- ✅ Professioneel maar toegankelijk
- ✅ GEEN placeholders of handtekeningen

**Input gebruikt:**
- Bedrijfsnaam en beschrijving
- Product/service
- Unique Selling Points
- Target audience
- Industry
- Calendly link (optioneel)

## 🔧 Troubleshooting:

### "Fout bij genereren template"
- Check Edge Function logs in Supabase Dashboard
- Controleer CLAUDE_API_KEY secret
- Check Claude API limits/credits

### "Vul eerst bedrijfsinformatie in"
- Ga naar Configuration → Bedrijfsinformatie
- Vul minimaal verplichte velden in
- Sla op en probeer opnieuw

### Templates niet zichtbaar
- Check browser console voor errors
- Refresh pagina (Ctrl+Shift+R)
- Check Supabase RLS policies (zijn automatisch ingesteld)

### Edge Function timeout
- Templates genereren kan 5-10 seconden duren
- Bij timeout: check Supabase Edge Function logs
- Mogelijk Claude API rate limiting

## 💡 Tips:

1. **USPs zijn krachtig**: Hoe meer USPs, hoe beter de template
2. **Test meerdere varianten**: Genereer 3-4 templates en kies de beste
3. **Personaliseer**: Pas gegenereerde templates aan voor specifieke segmenten
4. **Calendly link**: Verhoogt conversie voor meeting requests
5. **Track resultaten**: Gebruik de use_count om effectiviteit te meten

## 🔐 Security:

- ✅ Row Level Security (RLS) enabled op alle tables
- ✅ Users kunnen alleen hun eigen org data zien/bewerken
- ✅ Claude API key server-side only (niet in browser)
- ✅ Edge Function authentication via Supabase session

## 📊 Data Model:

```
organization_settings (1:1 met organization)
  ├─ company_name (required)
  ├─ product_service (required)
  ├─ target_audience (required)
  ├─ company_description
  ├─ unique_selling_points (array)
  ├─ industry
  ├─ calendly_link
  └─ contact info

email_templates (many:1 met organization)
  ├─ template_name
  ├─ subject
  ├─ body
  ├─ template_type (cold_email/follow_up/meeting_request)
  ├─ is_active
  ├─ use_count
  ├─ last_used_at
  └─ metadata (tone, targetSegment)
```

## ✨ Klaar!

Het cold email template systeem is nu volledig operationeel. Gebruikers kunnen:
- Bedrijfsinformatie configureren
- AI templates genereren
- Templates beheren en hergebruiken
- Templates kopiëren voor gebruik

Voor vragen of problemen: check de browser console en Supabase logs!
