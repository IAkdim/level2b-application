import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, UserX, UserCheck, Mail, Calendar, Building2, Shield } from 'lucide-react'
import {
  getUserDetails,
  suspendUser,
  unsuspendUser,
  type UserDetails,
} from '@/lib/api/devDashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function DevUserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (userId) {
      loadUserDetails()
    }
  }, [userId])

  const loadUserDetails = async () => {
    if (!userId) return

    try {
      setIsLoading(true)
      const data = await getUserDetails(userId)
      setUser(data)
    } catch (error) {
      console.error('Error loading user details:', error)
      toast.error('Failed to load user details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuspend = async () => {
    if (!userId) return

    try {
      setIsSubmitting(true)
      await suspendUser(userId, suspendReason)
      toast.success('User suspended successfully')
      setShowSuspendDialog(false)
      setSuspendReason('')
      loadUserDetails() // Reload
    } catch (error) {
      console.error('Error suspending user:', error)
      toast.error('Failed to suspend user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnsuspend = async () => {
    if (!userId) return

    try {
      setIsSubmitting(true)
      await unsuspendUser(userId)
      toast.success('User unsuspended successfully')
      loadUserDetails() // Reload
    } catch (error) {
      console.error('Error unsuspending user:', error)
      toast.error('Failed to unsuspend user')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 bg-slate-800" />
        <Skeleton className="h-64 bg-slate-800" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/dev/users')}
          className="text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Users
        </Button>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6 text-center text-slate-400">
            User not found
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/dev/users')}
        className="text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Users
      </Button>

      {/* User Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{user.email}</h1>
          <p className="text-slate-400 mt-1 font-mono text-sm">ID: {user.id}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {user.is_suspended ? (
            <Button
              onClick={handleUnsuspend}
              disabled={isSubmitting}
              variant="outline"
              className="border-green-500 text-green-500 hover:bg-green-500/10"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Unsuspend User
            </Button>
          ) : (
            <Button
              onClick={() => setShowSuspendDialog(true)}
              disabled={isSubmitting}
              variant="outline"
              className="border-red-500 text-red-500 hover:bg-red-500/10"
            >
              <UserX className="mr-2 h-4 w-4" />
              Suspend User
            </Button>
          )}
        </div>
      </div>

      {/* User Info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Basic Info */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-slate-400">Status</div>
              <div className="mt-1">
                {user.is_suspended ? (
                  <Badge variant="destructive" className="gap-1">
                    <UserX className="h-3 w-3" />
                    Suspended
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-500 border-green-500 gap-1">
                    <UserCheck className="h-3 w-3" />
                    Active
                  </Badge>
                )}
              </div>
            </div>

            {user.banned_until && (
              <div>
                <div className="text-sm text-slate-400">Banned Until</div>
                <div className="mt-1 text-slate-200">
                  {new Date(user.banned_until).toLocaleString('nl-NL')}
                </div>
              </div>
            )}

            <Separator className="bg-slate-800" />

            <div>
              <div className="text-sm text-slate-400">Email</div>
              <div className="mt-1 text-slate-200">{user.email}</div>
            </div>

            <div>
              <div className="text-sm text-slate-400">Created At</div>
              <div className="mt-1 text-slate-200">
                {new Date(user.created_at).toLocaleString('nl-NL')}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">Last Sign In</div>
              <div className="mt-1 text-slate-200">
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString('nl-NL')
                  : 'Never'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organisations */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <Building className="h-5 w-5" />
              Organisations ({user.organizations?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!user.organizations || user.organizations.length === 0 ? (
              <p className="text-slate-400 text-sm">No organisations</p>
            ) : (
              <div className="space-y-3">
                {user.organizations.map((org) => (
                  <div
                    key={org.id}
                    className="p-3 rounded-md bg-slate-800 border border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-200">{org.name}</div>
                      <Badge variant="outline" className="text-xs">
                        {org.role}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Joined: {new Date(org.joined_at).toLocaleDateString('nl-NL')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Placeholder Sections - Coming Later */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Coming later: Plan, billing, usage</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Usage Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Coming later: API calls, storage, activity</p>
          </CardContent>
        </Card>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Suspend User</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will immediately prevent the user from accessing the application.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-slate-200">
                Reason (optional)
              </Label>
              <Textarea
                id="reason"
                placeholder="Enter suspension reason..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                rows={3}
              />
            </div>

            <div className="p-3 rounded-md bg-red-950/20 border border-red-900/50">
              <p className="text-sm text-red-400">
                <strong>Warning:</strong> The user will be immediately logged out and unable to sign in.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSuspendDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Suspending...' : 'Suspend User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
