import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Settings as SettingsIcon, Wrench, AlertCircle } from 'lucide-react'
import { getSystemSettings, updateSystemSetting, type SystemSetting } from '@/lib/api/devDashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function DevSettings() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingSettings, setUpdatingSettings] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await getSystemSettings()
      setSettings(data)
    } catch (error) {
      console.error('Error loading system settings:', error)
      toast.error('Failed to load system settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (key: string, currentValue: boolean) => {
    try {
      setUpdatingSettings((prev) => new Set(prev).add(key))
      await updateSystemSetting(key, !currentValue)
      toast.success(`${key} ${!currentValue ? 'enabled' : 'disabled'}`)
      loadSettings() // Reload
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('Failed to update setting')
    } finally {
      setUpdatingSettings((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const getSettingValue = (key: string): boolean => {
    const setting = settings.find((s) => s.key === key)
    return setting?.value === true || setting?.value === 'true'
  }

  const getSetting = (key: string): SystemSetting | undefined => {
    return settings.find((s) => s.key === key)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 bg-slate-800" />
        <Skeleton className="h-64 bg-slate-800" />
      </div>
    )
  }

  const maintenanceMode = getSettingValue('maintenance_mode')
  const debugMode = getSettingValue('debug_mode')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-slate-400 mt-1">
          Global configuration and system controls
        </p>
      </div>

      {/* Warning Banner */}
      {maintenanceMode && (
        <div className="p-4 rounded-lg bg-orange-950/20 border border-orange-900/50">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <div>
              <div className="font-semibold text-orange-400">Maintenance Mode Active</div>
              <div className="text-sm text-orange-400/80 mt-0.5">
                The application is currently in maintenance mode. Users cannot access the app.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Core Settings */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Core Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Essential system-wide configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Maintenance Mode */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Label htmlFor="maintenance_mode" className="text-base font-medium text-slate-200">
                  Maintenance Mode
                </Label>
                {maintenanceMode && (
                  <Badge variant="destructive">Active</Badge>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {getSetting('maintenance_mode')?.description ||
                  'Disables user access for system maintenance'}
              </p>
              {getSetting('maintenance_mode')?.updated_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Last updated: {new Date(getSetting('maintenance_mode')!.updated_at).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
            <Switch
              id="maintenance_mode"
              checked={maintenanceMode}
              onCheckedChange={() => handleToggle('maintenance_mode', maintenanceMode)}
              disabled={updatingSettings.has('maintenance_mode')}
            />
          </div>

          <Separator className="bg-slate-800" />

          {/* Debug Mode */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Label htmlFor="debug_mode" className="text-base font-medium text-slate-200">
                  Debug Mode
                </Label>
                {debugMode && (
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    Enabled
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {getSetting('debug_mode')?.description ||
                  'Enables verbose logging for troubleshooting'}
              </p>
              {getSetting('debug_mode')?.updated_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Last updated: {new Date(getSetting('debug_mode')!.updated_at).toLocaleString('nl-NL')}
                </p>
              )}
            </div>
            <Switch
              id="debug_mode"
              checked={debugMode}
              onCheckedChange={() => handleToggle('debug_mode', debugMode)}
              disabled={updatingSettings.has('debug_mode')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Cards - Coming Later */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Environment Variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Manage environment variables and secrets
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Advanced Security</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Rate limiting, IP whitelisting, API key management
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
