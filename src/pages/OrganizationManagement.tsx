import { useState, useEffect } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Trash2, UserPlus, Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface OrgMember {
  user_id: string
  org_id: string
  role: "owner" | "admin" | "member"
  created_at: string
  user: {
    id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
}

export function OrganizationManagement() {
  const { selectedOrg, userOrgs, refreshOrganizations } = useOrganization()
  const [orgName, setOrgName] = useState("")
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null)
  const [copied, setCopied] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "admin" | "member">("member")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const initPage = async () => {
      // Get current user ID
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setCurrentUserId(session.user.id)
      }

      if (selectedOrg) {
        setOrgName(selectedOrg.name)
        fetchMembers()

        // Get current user's role
        const userOrg = userOrgs.find((uo) => uo.org_id === selectedOrg.id)
        if (userOrg) {
          setCurrentUserRole(userOrg.role)
        }
      }
    }

    initPage()
  }, [selectedOrg, userOrgs])

  const fetchMembers = async () => {
    if (!selectedOrg) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("user_orgs")
        .select(`
          user_id,
          org_id,
          role,
          created_at,
          user:users(id, full_name, email, avatar_url)
        `)
        .eq("org_id", selectedOrg.id)
        .order("created_at", { ascending: true })

      if (error) throw error

      // Map the data to fix the user object structure
      const formattedMembers = (data || []).map((item: any) => ({
        user_id: item.user_id,
        org_id: item.org_id,
        role: item.role,
        created_at: item.created_at,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
      })) as OrgMember[]

      setMembers(formattedMembers)
    } catch (error: any) {
      console.error("Error fetching members:", error)
      toast.error("Failed to load members")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateOrgName = async () => {
    if (!selectedOrg || !orgName.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("organizations")
        .update({ name: orgName.trim(), updated_at: new Date().toISOString() })
        .eq("id", selectedOrg.id)

      if (error) throw error

      await refreshOrganizations()
      toast.success("Organization name updated")
    } catch (error: any) {
      console.error("Error updating organization:", error)
      toast.error("Failed to update organization name")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateMemberRole = async (userId: string, newRole: "owner" | "admin" | "member") => {
    if (!selectedOrg) return

    try {
      const { error } = await supabase
        .from("user_orgs")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("org_id", selectedOrg.id)

      if (error) throw error

      await fetchMembers()
      toast.success("Member role updated")
    } catch (error: any) {
      console.error("Error updating role:", error)
      toast.error("Failed to update member role")
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedOrg || !memberToRemove) return

    try {
      const { error } = await supabase
        .from("user_orgs")
        .delete()
        .eq("user_id", memberToRemove.user_id)
        .eq("org_id", selectedOrg.id)

      if (error) throw error

      await fetchMembers()
      toast.success("Member removed from organization")
      setDeleteDialogOpen(false)
      setMemberToRemove(null)
    } catch (error: any) {
      console.error("Error removing member:", error)
      toast.error("Failed to remove member")
    }
  }

  const handleCopyOrgId = () => {
    if (selectedOrg) {
      navigator.clipboard.writeText(selectedOrg.id)
      setCopied(true)
      toast.success("Organization ID copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default"
      case "admin":
        return "secondary"
      default:
        return "outline"
    }
  }

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin"
  const canEditSettings = currentUserRole === "owner"

  if (!selectedOrg) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No organization selected</p>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings and members
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-8">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
            <div>
              <h2 className="text-base font-semibold">Organization Details</h2>
              <p className="text-sm text-muted-foreground">
                Update your organization name and view organization information
              </p>
            </div>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="org-name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    disabled={!canEditSettings}
                    placeholder="Enter organization name"
                  />
                  <Button
                    onClick={handleUpdateOrgName}
                    disabled={saving || !canEditSettings || orgName === selectedOrg.name}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
                {!canEditSettings && (
                  <p className="text-sm text-muted-foreground">
                    Only organization owners can update the name
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Organization ID</Label>
                <div className="flex gap-2">
                  <Input value={selectedOrg.id} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={handleCopyOrgId}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this ID with others to invite them to your organization
                </p>
              </div>

              <div className="space-y-2">
                <Label>Created</Label>
                <Input
                  value={new Date(selectedOrg.created_at).toLocaleDateString()}
                  readOnly
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-6">
          <div className="space-y-6 bg-muted/30 rounded-lg p-8 border border-border/30">
            <div>
              <h2 className="text-base font-semibold">Team Members</h2>
              <p className="text-sm text-muted-foreground">
                Manage who has access to this organization
              </p>
            </div>
            <div className="space-y-4">
              {!canManageMembers && (
                <div className="p-3 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg border border-amber-500/20">
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    Only owners and admins can manage members
                  </p>
                </div>
              )}

              <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-start gap-3">
                  <UserPlus className="h-4 w-4 text-primary mt-1" />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Invite New Members</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share your Organization ID with team members so they can join:
                    </p>
                    <div className="flex gap-2 mt-3">
                      <code className="flex-1 px-3 py-2 bg-background rounded-md border font-mono text-xs">
                        {selectedOrg.id}
                      </code>
                      <Button variant="outline" size="sm" onClick={handleCopyOrgId}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Team members can join using the "Join Organization" option in the organization selector
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading members...</div>
              ) : (
                <div className="rounded-lg border border-border/30 bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {canManageMembers && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const isCurrentUser = currentUserId && member.user_id === currentUserId

                      return (
                        <TableRow key={member.user_id}>
                          <TableCell className="font-medium">
                            {member.user.full_name || "Unknown"}
                            {isCurrentUser && (
                              <Badge variant="outline" className="ml-2">You</Badge>
                            )}
                          </TableCell>
                          <TableCell>{member.user.email}</TableCell>
                          <TableCell>
                            {canManageMembers && member.role !== "owner" ? (
                              <Select
                                value={member.role}
                                onValueChange={(value: "owner" | "admin" | "member") =>
                                  handleUpdateMemberRole(member.user_id, value)
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="member">Member</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="owner">Owner</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={getRoleBadgeVariant(member.role)}>
                                {member.role}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(member.created_at).toLocaleDateString()}
                          </TableCell>
                          {canManageMembers && (
                            <TableCell className="text-right">
                              {member.role !== "owner" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setMemberToRemove(member)
                                    setDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user?.full_name || "this member"} from
              the organization? They will lose access to all organization data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemove(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
