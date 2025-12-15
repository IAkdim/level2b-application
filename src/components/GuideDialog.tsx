// src/components/GuideDialog.tsx
// Guide/tutorial component for Level2b

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  Mail, 
  Calendar, 
  BarChart3, 
  Settings,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { eventBus } from '@/lib/eventBus'

export function GuideDialog() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    eventBus.on('guide:open', handleOpen)
    return () => eventBus.off('guide:open', handleOpen)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Level2b Platform Guide</DialogTitle>
          <DialogDescription>
            Leer hoe je Level2b effectief kunt gebruiken voor je sales en outreach
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Welkom bij Level2b!</h3>
                <p className="text-muted-foreground">
                  Level2b is jouw complete CRM platform voor sales en outreach. Deze guide helpt je om snel aan de slag te gaan.
                </p>
              </div>

              <div className="grid gap-4">
                <FeatureCard
                  icon={<Users className="h-6 w-6" />}
                  title="Lead Management"
                  description="Beheer al je leads op één plek met filtering, tags, en status tracking."
                />
                <FeatureCard
                  icon={<Sparkles className="h-6 w-6" />}
                  title="AI Email Templates"
                  description="Genereer overtuigende cold emails met AI op basis van jouw bedrijfsinfo."
                />
                <FeatureCard
                  icon={<Calendar className="h-6 w-6" />}
                  title="Meeting Scheduling"
                  description="Synchroniseer Calendly meetings en houd alle afspraken bij."
                />
                <FeatureCard
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="Analytics & Insights"
                  description="Krijg inzicht in je sales performance met real-time analytics."
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Quick Start Checklist
                </h4>
                <ul className="space-y-2 ml-7 text-sm">
                  <li>✅ Configureer je bedrijfsinformatie in Settings</li>
                  <li>✅ Voeg je eerste leads toe</li>
                  <li>✅ Genereer een email template met AI</li>
                  <li>✅ Plan je eerste meeting</li>
                  <li>✅ Bekijk je analytics dashboard</li>
                </ul>
              </div>
            </TabsContent>

            {/* Leads Tab */}
            <TabsContent value="leads" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  Lead Management
                </h3>
                <p className="text-muted-foreground">
                  Beheer en organiseer al je prospects en klanten effectief.
                </p>
              </div>

              <GuideSection
                title="Leads Toevoegen"
                steps={[
                  'Klik op "Nieuwe Lead" in de Leads pagina',
                  'Vul naam, email, bedrijf en andere details in',
                  'Voeg tags toe voor betere organisatie (bijv. "webdesigner", "mkb")',
                  'Stel een status in (New, Contacted, Meeting Scheduled, etc.)',
                ]}
              />

              <GuideSection
                title="Leads Organiseren"
                steps={[
                  'Filter op status, sentiment, of tags via de sidebar',
                  'Gebruik de zoekbalk om snel leads te vinden',
                  'Sorteer op naam, bedrijf, of datum',
                  'Gebruik bulk acties voor efficiënt beheer',
                ]}
              />

              <GuideSection
                title="Lead Details"
                steps={[
                  'Klik op een lead om details te bekijken',
                  'Voeg notities toe voor belangrijke info',
                  'Bekijk activiteiten en interacties',
                  'Beheer taken en follow-ups',
                ]}
              />
            </TabsContent>

            {/* Outreach Tab */}
            <TabsContent value="outreach" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-6 w-6" />
                  Outreach & Templates
                </h3>
                <p className="text-muted-foreground">
                  Creëer effectieve cold emails met AI-ondersteuning.
                </p>
              </div>

              <GuideSection
                title="Email Templates Genereren"
                steps={[
                  'Ga naar Outreach → Templates',
                  'Klik op "Nieuwe Template Genereren"',
                  'Vul je bedrijfsinformatie in (wordt opgeslagen voor volgende keer)',
                  'Voeg optioneel extra context toe (specifieke use case, recente resultaten)',
                  'Klik op "Genereer Template"',
                  'Review en pas aan indien nodig',
                  'Klik op "Opslaan" om de template te bewaren',
                ]}
              />

              <GuideSection
                title="Templates Gebruiken"
                steps={[
                  'Opgeslagen templates verschijnen in de lijst',
                  'Klik op "Kopieer Template" om naar clipboard te kopiëren',
                  'Plak in je email client',
                  'Personaliseer voor specifieke lead',
                  'Usage wordt automatisch bijgehouden',
                ]}
              />

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Template Tips
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>• Wees specifiek in je bedrijfsomschrijving</li>
                  <li>• Voeg concrete USPs toe (niet alleen "innovatief")</li>
                  <li>• Gebruik de extra context voor specifieke situaties</li>
                  <li>• Vergeet je Calendly link niet voor directe boekingen</li>
                </ul>
              </div>
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-6 w-6" />
                  Meetings & Calendly
                </h3>
                <p className="text-muted-foreground">
                  Synchroniseer en beheer al je meetings op één plek.
                </p>
              </div>

              <GuideSection
                title="Calendly Synchronisatie"
                steps={[
                  'Configureer je Calendly API key in Settings',
                  'Meetings worden automatisch gesynchroniseerd',
                  'Bekijk alle geplande en voltooide meetings',
                  'Filter op status (Active/Canceled)',
                ]}
              />

              <GuideSection
                title="Meeting Details"
                steps={[
                  'Zie lead naam, email, en contactinfo',
                  'Bekijk meeting tijdstip en locatie',
                  'Vragen en antwoorden van de lead',
                  'Link direct naar je lead profile',
                ]}
              />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Meeting Best Practices</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Voeg je Calendly link toe aan email templates</li>
                  <li>• Check meetings dagelijks voor voorbereiding</li>
                  <li>• Maak notities na elk gesprek in de lead details</li>
                  <li>• Update lead status na meeting (bijv. naar "Proposal")</li>
                </ul>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6" />
                  Analytics & Reporting
                </h3>
                <p className="text-muted-foreground">
                  Krijg inzicht in je sales performance en optimaliseer je aanpak.
                </p>
              </div>

              <GuideSection
                title="Key Metrics"
                steps={[
                  'Total Leads - Totaal aantal leads in het systeem',
                  'New This Month - Groei van je lead database',
                  'Meeting Scheduled - Conversie naar meetings',
                  'Response Rate - Effectiviteit van je outreach',
                ]}
              />

              <GuideSection
                title="Visualisaties"
                steps={[
                  'Lead Status Distribution - Waar zitten je leads in de funnel?',
                  'Monthly Trends - Groei over tijd',
                  'Source Performance - Welke kanalen werken het best?',
                  'Sentiment Analysis - Hoe receptief zijn je leads?',
                ]}
              />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Analytics Tips</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Check weekly voor trends en patronen</li>
                  <li>• Focus op conversie ratio naar meetings</li>
                  <li>• Optimaliseer je aanpak op basis van sentiment</li>
                  <li>• Gebruik source tags om beste kanalen te identificeren</li>
                </ul>
              </div>
            </TabsContent>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Vragen? Gebruik de Feedback knop!</span>
            </div>
            <Button onClick={() => setIsOpen(false)}>
              Sluiten
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode
  title: string
  description: string 
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card">
      <div className="text-primary">{icon}</div>
      <div>
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function GuideSection({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-primary" />
        {title}
      </h4>
      <ol className="space-y-2 ml-6">
        {steps.map((step, index) => (
          <li key={index} className="text-sm text-muted-foreground">
            {index + 1}. {step}
          </li>
        ))}
      </ol>
    </div>
  )
}
