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
            Learn how to use Level2b effectively for your sales and outreach
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="outreach">Outreach</TabsTrigger>
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Welcome to Level2b!</h3>
                <p className="text-muted-foreground">
                  Level2b is your complete CRM platform for sales and outreach. This guide will help you get started quickly.
                </p>
              </div>

              <div className="grid gap-4">
                <FeatureCard
                  icon={<Users className="h-6 w-6" />}
                  title="Lead Management"
                  description="Manage all your leads in one place with filtering, tags, and status tracking."
                />
                <FeatureCard
                  icon={<Sparkles className="h-6 w-6" />}
                  title="AI Email Templates"
                  description="Generate convincing cold emails with AI based on your company info."
                />
                <FeatureCard
                  icon={<Calendar className="h-6 w-6" />}
                  title="Meeting Scheduling"
                  description="Synchronise Calendly meetings and track all appointments."
                />
                <FeatureCard
                  icon={<BarChart3 className="h-6 w-6" />}
                  title="Analytics & Insights"
                  description="Gain insight into your sales performance with real-time analytics."
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Quick Start Checklist
                </h4>
                <ul className="space-y-2 ml-7 text-sm">
                  <li>✅ Configure your company information in Settings</li>
                  <li>✅ Add your first leads</li>
                  <li>✅ Generate an email template with AI</li>
                  <li>✅ Schedule your first meeting</li>
                  <li>✅ View your analytics dashboard</li>
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
                  Manage and organise all your prospects and customers effectively.
                </p>
              </div>

              <GuideSection
                title="Adding Leads"
                steps={[
                  'Click "New Lead" in the Leads page',
                  'Fill in name, email, company and other details',
                  'Add tags for better organisation (e.g. "webdesigner", "SME")',
                  'Set a status (New, Contacted, Meeting Scheduled, etc.)',
                ]}
              />

              <GuideSection
                title="Organising Leads"
                steps={[
                  'Filter by status, sentiment, or tags via the sidebar',
                  'Use the search bar to quickly find leads',
                  'Sort by name, company, or date',
                  'Use bulk actions for efficient management',
                ]}
              />

              <GuideSection
                title="Lead Details"
                steps={[
                  'Click on a lead to view details',
                  'Add notes for important info',
                  'View activities and interactions',
                  'Manage tasks and follow-ups',
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
                  Create effective cold emails with AI support.
                </p>
              </div>

              <GuideSection
                title="Generate Email Templates"
                steps={[
                  'Go to Outreach → Templates',
                  'Click "Generate New Template"',
                  'Fill in your company information (saved for next time)',
                  'Optionally add extra context (specific use case, recent results)',
                  'Click "Generate Template"',
                  'Review and adjust if needed',
                  'Click "Save" to save the template',
                ]}
              />

              <GuideSection
                title="Using Templates"
                steps={[
                  'Saved templates appear in the list',
                  'Click "Copy Template" to copy to clipboard',
                  'Paste in your email client',
                  'Personalise for specific lead',
                  'Usage is automatically tracked',
                ]}
              />

              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Template Tips
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>• Be specific in your company description</li>
                  <li>• Add concrete USPs (not just "innovative")</li>
                  <li>• Use the extra context for specific situations</li>
                  <li>• Don't forget your Calendly link for direct bookings</li>
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
                  Synchronise and manage all your meetings in one place.
                </p>
              </div>

              <GuideSection
                title="Calendly Synchronisation"
                steps={[
                  'Configure your Calendly API key in Settings',
                  'Meetings are automatically synchronised',
                  'View all scheduled and completed meetings',
                  'Filter by status (Active/Cancelled)',
                ]}
              />

              <GuideSection
                title="Meeting Details"
                steps={[
                  'See lead name, email, and contact info',
                  'View meeting time and location',
                  'Questions and answers from the lead',
                  'Link directly to your lead profile',
                ]}
              />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Meeting Best Practices</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Add your Calendly link to email templates</li>
                  <li>• Check meetings daily for preparation</li>
                  <li>• Make notes after each conversation in the lead details</li>
                  <li>• Update lead status after meeting (e.g. to "Proposal")</li>
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
                  Gain insight into your sales performance and optimise your approach.
                </p>
              </div>

              <GuideSection
                title="Key Metrics"
                steps={[
                  'Total Leads - Total number of leads in the system',
                  'New This Month - Growth of your lead database',
                  'Meeting Scheduled - Conversion to meetings',
                  'Response Rate - Effectiveness of your outreach',
                ]}
              />

              <GuideSection
                title="Visualisations"
                steps={[
                  'Lead Status Distribution - Where are your leads in the funnel?',
                  'Monthly Trends - Growth over time',
                  'Source Performance - Which channels work best?',
                  'Sentiment Analysis - How receptive are your leads?',
                ]}
              />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Analytics Tips</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Check weekly for trends and patterns</li>
                  <li>• Focus on conversion ratio to meetings</li>
                  <li>• Optimise your approach based on sentiment</li>
                  <li>• Use source tags to identify best channels</li>
                </ul>
              </div>
            </TabsContent>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span>Questions? Use the Feedback button!</span>
            </div>
            <Button onClick={() => setIsOpen(false)}>
              Close
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
