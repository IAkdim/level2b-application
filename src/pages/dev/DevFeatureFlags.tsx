import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Flag, Percent } from 'lucide-react'
import { getFeatureFlags, toggleFeatureFlag, type FeatureFlag } from '@/lib/api/devDashboard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function DevFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [togglingFlags, setTogglingFlags] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadFlags()
  }, [])

  const loadFlags = async () => {
    try {
      setIsLoading(true)
      const data = await getFeatureFlags()
      setFlags(data)
    } catch (error) {
      console.error('Error loading feature flags:', error)
      toast.error('Failed to load feature flags')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (flagId: string, currentValue: boolean) => {
    try {
      setTogglingFlags((prev) => new Set(prev).add(flagId))
      await toggleFeatureFlag(flagId, !currentValue)
      toast.success(`Feature flag ${!currentValue ? 'enabled' : 'disabled'}`)
      loadFlags() // Reload
    } catch (error) {
      console.error('Error toggling feature flag:', error)
      toast.error('Failed to toggle feature flag')
    } finally {
      setTogglingFlags((prev) => {
        const next = new Set(prev)
        next.delete(flagId)
        return next
      })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
        <p className="text-slate-400 mt-1">
          Control feature rollouts and A/B tests
        </p>
      </div>

      {/* Feature Flags List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">All Flags ({flags.length})</CardTitle>
          <CardDescription className="text-slate-400">
            Toggle features on/off globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {flags.length === 0 ? (
              <p className="text-slate-400 text-center py-8">No feature flags defined</p>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag.id}
                  className="p-4 rounded-lg bg-slate-800 border border-slate-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Flag className="h-5 w-5 text-slate-400" />
                        <div>
                          <div className="font-medium text-slate-200">{flag.name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            {flag.key}
                          </div>
                        </div>
                        {flag.enabled ? (
                          <Badge variant="outline" className="text-green-500 border-green-500">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-600">
                            Disabled
                          </Badge>
                        )}
                      </div>

                      {flag.description && (
                        <p className="text-sm text-slate-400 mt-2 ml-8">
                          {flag.description}
                        </p>
                      )}

                      {/* Rollout percentage - Coming later indicator */}
                      {flag.rollout_percentage > 0 && flag.rollout_percentage < 100 && (
                        <div className="mt-2 ml-8 flex items-center gap-2 text-xs text-slate-500">
                          <Percent className="h-3 w-3" />
                          Rollout: {flag.rollout_percentage}% (Coming later: per-user targeting)
                        </div>
                      )}

                      <div className="text-xs text-slate-500 mt-2 ml-8">
                        Last updated: {new Date(flag.updated_at).toLocaleString('nl-NL')}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <Label htmlFor={`flag-${flag.id}`} className="text-sm text-slate-400">
                        {flag.enabled ? 'On' : 'Off'}
                      </Label>
                      <Switch
                        id={`flag-${flag.id}`}
                        checked={flag.enabled}
                        onCheckedChange={() => handleToggle(flag.id, flag.enabled)}
                        disabled={togglingFlags.has(flag.id)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Cards - Coming Later */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Per-User Targeting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Enable flags for specific users or organizations
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Gradual Rollouts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Progressive rollout with percentage controls
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
