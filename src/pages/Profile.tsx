// src/pages/Profile.tsx
// User profile page

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Mail, Calendar, Building2, Save, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { useOrganization } from '@/contexts/OrganizationContext'

export function Profile() {
  const { selectedOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState({
    full_name: '',
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        setUser(user)
        setProfile({
          full_name: user.user_metadata?.full_name || '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Could not load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
        }
      })

      if (error) throw error

      toast.success('Profile updated!')
      loadProfile() // Reload to get updated data
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Could not update profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your name
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Account Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Account created</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('nl-NL', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              {selectedOrg && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Current Organisation</p>
                      <p className="text-sm text-muted-foreground">{selectedOrg.name}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
