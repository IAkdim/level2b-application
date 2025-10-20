import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, Search, Plus, Mail, Calendar, User, Loader2, Edit2, Trash2, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLeads, useLeadStats, useDeleteLead } from "@/hooks/useLeads"
import { useDebounce } from "@/hooks/useDebounce"
import { AddLeadDialog } from "@/components/AddLeadDialog"
import { EditLeadDialog } from "@/components/EditLeadDialog"
import { LeadsFilterSidebar } from "@/components/LeadsFilterSidebar"
import type { Lead, LeadStatus, Sentiment } from "@/types/crm"
import { formatRelativeTime, getStatusVariant } from "@/lib/utils/formatters"

type SortColumn = 'name' | 'company' | 'created_at' | 'last_contact_at' | 'status'

export function Leads() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<LeadStatus[]>([])
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortColumn>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch leads with server-side filters and sorting
  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    status: statusFilter.length > 0 ? statusFilter : undefined,
    sentiment: sentimentFilter.length > 0 ? sentimentFilter : undefined,
    source: sourceFilter.length > 0 ? sourceFilter : undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder
  })

  // Fetch lead stats
  const { data: stats } = useLeadStats()

  // Delete mutation
  const deleteLead = useDeleteLead()

  const leads = leadsData?.data || []

  const clearFilters = () => {
    setStatusFilter([])
    setSentimentFilter([])
    setSourceFilter([])
  }

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 ml-1.5 opacity-40" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 ml-1.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 ml-1.5" />
    )
  }

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
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar - Filters */}
      <LeadsFilterSidebar
        statusFilter={statusFilter}
        sentimentFilter={sentimentFilter}
        sourceFilter={sourceFilter}
        onStatusChange={setStatusFilter}
        onSentimentChange={setSentimentFilter}
        onSourceChange={setSourceFilter}
        onClearAll={clearFilters}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
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

          {/* Leads Table */}
          <Card className="border-border/30">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Leads</CardTitle>
                  <CardDescription className="mt-1">
                    {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
                    {searchTerm && ' matching your search'}
                  </CardDescription>
                </div>
                {/* Search */}
                <div className="flex-1 max-w-md relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    type="text"
                    placeholder="Search by name, email, company, phone..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {leadsLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <User className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium mb-1">
                    {searchTerm || statusFilter.length > 0
                      ? "No leads found"
                      : "No leads yet"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || statusFilter.length > 0
                      ? "Try adjusting your filters"
                      : "Click 'Add Lead' to create your first lead"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/40">
                        <TableHead className="font-semibold">
                          <button
                            onClick={() => handleSort('name')}
                            className="flex items-center hover:text-foreground transition-colors"
                          >
                            Contact
                            {getSortIcon('name')}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold">
                          <button
                            onClick={() => handleSort('company')}
                            className="flex items-center hover:text-foreground transition-colors"
                          >
                            Company
                            {getSortIcon('company')}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold">
                          <button
                            onClick={() => handleSort('status')}
                            className="flex items-center hover:text-foreground transition-colors"
                          >
                            Status
                            {getSortIcon('status')}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold">
                          <button
                            onClick={() => handleSort('last_contact_at')}
                            className="flex items-center hover:text-foreground transition-colors"
                          >
                            Last Contact
                            {getSortIcon('last_contact_at')}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold">Sentiment</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
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
                            {formatRelativeTime(lead.last_contact_at)}
                          </TableCell>
                          <TableCell className="min-w-[120px]">
                            {lead.sentiment ? (
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lead.sentiment === 'positive' ? 'bg-green-500' :
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
      </div>
    </div>
  )
}
