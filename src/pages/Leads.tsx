import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, Search, Plus, Mail, Calendar, User, Loader2, Edit2, Trash2, MoreVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLeads, useLeadStats, useDeleteLead } from "@/hooks/useLeads"
import { AddLeadDialog } from "@/components/AddLeadDialog"
import { EditLeadDialog } from "@/components/EditLeadDialog"
import type { Lead, LeadStatus } from "@/types/crm"
import { formatDistanceToNow } from "date-fns"

function getStatusVariant(status: LeadStatus) {
  const variants: Record<LeadStatus, string> = {
    new: 'default',
    contacted: 'secondary',
    replied: 'default',
    meeting_scheduled: 'default',
    closed: 'default',
    lost: 'secondary',
  }
  return variants[status] as any
}

function getSentimentVariant(sentiment: 'positive' | 'neutral' | 'negative') {
  return sentiment === 'positive' ? 'default' : sentiment === 'negative' ? 'secondary' : 'secondary'
}

function formatLastContact(date: string | null): string {
  if (!date) return 'Never'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return 'Never'
  }
}

export function Leads() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // Fetch leads with filters
  const { data: leadsData, isLoading: leadsLoading } = useLeads(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  )

  // Fetch lead stats
  const { data: stats } = useLeadStats()

  // Delete mutation
  const deleteLead = useDeleteLead()

  // Client-side filtering for search
  const filteredLeads = (leadsData?.data || []).filter(lead => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return lead.name.toLowerCase().includes(search) ||
           lead.email.toLowerCase().includes(search) ||
           (lead.company?.toLowerCase() || '').includes(search)
  })

  const handleDelete = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(`Are you sure you want to delete ${lead.name}? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteLead.mutateAsync(lead.id)
    } catch (error) {
      console.error("Failed to delete lead:", error)
      alert("Failed to delete lead")
    }
  }

  const handleEdit = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingLead(lead)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground">
            Beheer je prospects en volg de status van je outreach
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.by_status?.contacted || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replied</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.by_status?.replied || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meetings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.by_status?.meeting_scheduled || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <Label htmlFor="search-leads" className="sr-only">
                Search leads
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  id="search-leads"
                  type="text"
                  placeholder="Search leads..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="status-filter" className="sr-only">
                Filter by status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-border/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Leads</CardTitle>
              <CardDescription className="mt-1">
                {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'}
                {searchTerm && ' matching your search'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {leadsLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-16 px-4">
              <User className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium mb-1">
                {searchTerm || statusFilter !== "all"
                  ? "No leads found"
                  : "No leads yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Click 'Add Lead' to create your first lead"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40">
                    <TableHead className="font-semibold">Contact</TableHead>
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Last Contact</TableHead>
                    <TableHead className="font-semibold">Sentiment</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors border-border/30"
                      onClick={() => navigate(`/outreach/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{lead.name}</span>
                          <span className="text-sm text-muted-foreground">{lead.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {lead.company ? (
                            <>
                              <span className="font-medium text-sm">{lead.company}</span>
                              {lead.title && (
                                <span className="text-xs text-muted-foreground">{lead.title}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusVariant(lead.status)}
                          className="font-normal"
                        >
                          {lead.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastContact(lead.last_contact_at)}
                      </TableCell>
                      <TableCell>
                        {lead.sentiment ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              lead.sentiment === 'positive' ? 'bg-green-500' :
                              lead.sentiment === 'negative' ? 'bg-red-500' :
                              'bg-yellow-500'
                            }`} />
                            <span className="text-sm capitalize">{lead.sentiment}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-muted"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => navigate(`/outreach/leads/${lead.id}`)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => handleEdit(lead, e)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleDelete(lead, e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Dialog */}
      <AddLeadDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      {/* Edit Lead Dialog */}
      <EditLeadDialog
        open={!!editingLead}
        onOpenChange={(open) => !open && setEditingLead(null)}
        lead={editingLead}
      />
    </div>
  )
}