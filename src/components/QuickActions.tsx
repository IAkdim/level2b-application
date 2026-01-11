import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { 
  Command,
  FileText, 
  Users, 
  Mail, 
  Calendar,
  Settings,
  Sparkles,
  Upload,
  Plus,
  Search,
  X,
  Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface QuickAction {
  id: string
  icon: any
  label: string
  description: string
  shortcut?: string
  action: () => void
  category: 'workflow' | 'navigation' | 'settings'
}

interface QuickActionsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickActions({ open, onOpenChange }: QuickActionsProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const actions: QuickAction[] = [
    // Workflow actions
    {
      id: 'new-template',
      icon: Sparkles,
      label: 'Create AI Template',
      description: 'Generate a new email template with AI',
      shortcut: '⌘T',
      action: () => { navigate('/outreach/templates'); onOpenChange(false) },
      category: 'workflow'
    },
    {
      id: 'add-lead',
      icon: Plus,
      label: 'Add Lead',
      description: 'Manually add a new lead',
      shortcut: '⌘N',
      action: () => { navigate('/outreach/leads'); onOpenChange(false) },
      category: 'workflow'
    },
    {
      id: 'import-leads',
      icon: Upload,
      label: 'Import Leads',
      description: 'Import leads from CSV file',
      shortcut: '⌘I',
      action: () => { navigate('/outreach/leads'); onOpenChange(false) },
      category: 'workflow'
    },
    {
      id: 'generate-leads',
      icon: Zap,
      label: 'Generate Leads with AI',
      description: 'Auto-generate leads from Google Maps',
      action: () => { navigate('/outreach/leads'); onOpenChange(false) },
      category: 'workflow'
    },
    // Navigation
    {
      id: 'go-templates',
      icon: FileText,
      label: 'Go to Templates',
      description: 'Manage your email templates',
      action: () => { navigate('/outreach/templates'); onOpenChange(false) },
      category: 'navigation'
    },
    {
      id: 'go-leads',
      icon: Users,
      label: 'Go to Leads',
      description: 'View and manage your leads',
      action: () => { navigate('/outreach/leads'); onOpenChange(false) },
      category: 'navigation'
    },
    {
      id: 'go-threads',
      icon: Mail,
      label: 'Go to Email Threads',
      description: 'View email conversations',
      action: () => { navigate('/outreach/email-threads'); onOpenChange(false) },
      category: 'navigation'
    },
    {
      id: 'go-meetings',
      icon: Calendar,
      label: 'Go to Meetings',
      description: 'View scheduled meetings',
      action: () => { navigate('/meetings'); onOpenChange(false) },
      category: 'navigation'
    },
    // Settings
    {
      id: 'go-config',
      icon: Settings,
      label: 'Settings',
      description: 'Configure your account',
      shortcut: '⌘,',
      action: () => { navigate('/configuration'); onOpenChange(false) },
      category: 'settings'
    },
  ]

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    action.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedActions = {
    workflow: filteredActions.filter(a => a.category === 'workflow'),
    navigation: filteredActions.filter(a => a.category === 'navigation'),
    settings: filteredActions.filter(a => a.category === 'settings')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">Quick Actions</DialogTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-0 focus-visible:ring-0 text-base"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="border-t max-h-[400px] overflow-y-auto">
          {groupedActions.workflow.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Actions
              </div>
              {groupedActions.workflow.map((action) => (
                <ActionItem key={action.id} action={action} />
              ))}
            </div>
          )}

          {groupedActions.navigation.length > 0 && (
            <div className="p-2 border-t">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Navigation
              </div>
              {groupedActions.navigation.map((action) => (
                <ActionItem key={action.id} action={action} />
              ))}
            </div>
          )}

          {groupedActions.settings.length > 0 && (
            <div className="p-2 border-t">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Settings
              </div>
              {groupedActions.settings.map((action) => (
                <ActionItem key={action.id} action={action} />
              ))}
            </div>
          )}

          {filteredActions.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p>No actions found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        <div className="border-t p-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↑↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">↵</kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ActionItem({ action }: { action: QuickAction }) {
  return (
    <button
      onClick={action.action}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted transition-colors text-left"
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <action.icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{action.label}</div>
        <div className="text-xs text-muted-foreground truncate">{action.description}</div>
      </div>
      {action.shortcut && (
        <kbd className="hidden sm:inline-flex px-2 py-1 rounded bg-muted text-xs font-mono text-muted-foreground">
          {action.shortcut}
        </kbd>
      )}
    </button>
  )
}

// Keyboard shortcut hook to open quick actions
export function useQuickActionsShortcut(onOpen: () => void) {
  // Could implement ⌘K shortcut here
}
