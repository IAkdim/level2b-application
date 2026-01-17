import { useState } from "react"
import { useOrganization } from "@/contexts/OrganizationContext"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Plus, Users } from "lucide-react"
import type { Organization } from "@/types/organization"

interface OrganizationSelectorProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  allowSkip?: boolean
  onSkip?: () => void
}

export function OrganizationSelector({ open, onOpenChange, trigger, allowSkip, onSkip }: OrganizationSelectorProps) {
  const { userOrgs, setOrganization, refreshOrganizations } = useOrganization()
  const [newOrgName, setNewOrgName] = useState("")
  const [joinOrgId, setJoinOrgId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) {
      setError("Organization name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError("You must be logged in to create an organization")
        return
      }

      // Use the helper function to create org and add user as owner atomically
      const { data: orgId, error: createError } = await supabase
        .rpc('create_organization_with_owner', {
          org_name: newOrgName.trim(),
          org_slug: null
        })

      if (createError) throw createError

      // Fetch the created organization
      const { data: org, error: fetchError } = await supabase
        .from("organizations")
        .select()
        .eq("id", orgId)
        .single()

      if (fetchError) throw fetchError

      // Refresh organizations and select the new one
      await refreshOrganizations()
      setOrganization(org as Organization)
      setNewOrgName("")

      if (onOpenChange) onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "Failed to create organization")
    } finally {
      setLoading(false)
    }
  }

  const handleJoinOrganization = async () => {
    if (!joinOrgId.trim()) {
      setError("Organization ID is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setError("You must be logged in to join an organization")
        return
      }

      // Check if organization exists
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select()
        .eq("id", joinOrgId.trim())
        .single()

      if (orgError || !org) {
        setError("Organization not found")
        return
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("user_orgs")
        .select()
        .eq("user_id", session.user.id)
        .eq("org_id", org.id)
        .single()

      if (existing) {
        setError("You are already a member of this organization")
        return
      }

      // Add user as member
      const { error: userOrgError } = await supabase
        .from("user_orgs")
        .insert({
          user_id: session.user.id,
          org_id: org.id,
          role: "member",
        })

      if (userOrgError) throw userOrgError

      // Refresh organizations and select the new one
      await refreshOrganizations()
      setOrganization(org as Organization)
      setJoinOrgId("")

      if (onOpenChange) onOpenChange(false)
    } catch (err: any) {
      setError(err.message || "Failed to join organization")
    } finally {
      setLoading(false)
    }
  }

  const handleSelectExisting = (orgId: string) => {
    const userOrg = userOrgs.find((uo) => uo.org_id === orgId)
    if (userOrg) {
      setOrganization(userOrg.organization)
      if (onOpenChange) onOpenChange(false)
    }
  }

  const dialogContent = (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Select Organization</DialogTitle>
        <DialogDescription>
          Organizations let you collaborate with your team. You can also continue without one.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="select" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="select">
            <Building2 className="h-4 w-4 mr-2" />
            Select
          </TabsTrigger>
          <TabsTrigger value="create">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </TabsTrigger>
          <TabsTrigger value="join">
            <Users className="h-4 w-4 mr-2" />
            Join
          </TabsTrigger>
        </TabsList>

        <TabsContent value="select" className="space-y-4">
          {userOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              You don't belong to any organizations yet. Create or join one to collaborate with your team.
            </p>
          ) : (
            <>
              <Label>Your Organizations</Label>
              <Select onValueChange={handleSelectExisting}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {userOrgs.map((userOrg) => (
                    <SelectItem key={userOrg.org_id} value={userOrg.org_id}>
                      {userOrg.organization.name}
                      <span className="text-xs text-muted-foreground ml-2">({userOrg.role})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="Enter organization name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateOrganization()}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleCreateOrganization}
            disabled={loading || !newOrgName.trim()}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Organization"}
          </Button>
        </TabsContent>

        <TabsContent value="join" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-id">Organization ID</Label>
            <Input
              id="org-id"
              placeholder="Enter organization ID"
              value={joinOrgId}
              onChange={(e) => setJoinOrgId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinOrganization()}
            />
            <p className="text-xs text-muted-foreground">
              Ask your organization admin for the organization ID
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleJoinOrganization}
            disabled={loading || !joinOrgId.trim()}
            className="w-full"
          >
            {loading ? "Joining..." : "Join Organization"}
          </Button>
        </TabsContent>
      </Tabs>

      {allowSkip && onSkip && (
        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            onClick={onSkip}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Continue without organization
          </Button>
        </div>
      )}
    </DialogContent>
  )

  if (trigger) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        {dialogContent}
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogContent}
    </Dialog>
  )
}
