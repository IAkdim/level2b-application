import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Activity, TrendingUp, Clock, AlertCircle, CheckCircle2, XCircle, Zap } from 'lucide-react'
import { getApiUsageStats, getRateLimitInfo, getApiUsageLogs, type ApiUsageStats, type RateLimitInfo, type ApiUsageLog } from '@/lib/api/apiMonitoring'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export default function ApiMonitoring() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ApiUsageStats | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null)
  const [logs, setLogs] = useState<ApiUsageLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    fetchUserId()
  }, [])

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id || !userId) return

      try {
        setIsLoading(true)
        const [statsData, rateLimitData, logsData] = await Promise.all([
          getApiUsageStats(user.id, 7),
          getRateLimitInfo(userId, user.id),
          getApiUsageLogs(user.id, 50)
        ])

        setStats(statsData)
        setRateLimit(rateLimitData)
        setLogs(logsData)
      } catch (error) {
        console.error('Error loading monitoring data:', error)
        toast.error('Failed to load API monitoring data')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user?.id, userId])

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Please log in to view API monitoring</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading monitoring data...</p>
        </div>
      </div>
    )
  }

  const successRate = stats && stats.total_calls > 0
    ? ((stats.successful_calls / stats.total_calls) * 100).toFixed(1)
    : '0'

  const nextResetTime = rateLimit?.hour_start 
    ? new Date(new Date(rateLimit.hour_start).getTime() + 60 * 60 * 1000)
    : new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Track lead generation usage, rate limits, and performance
        </p>
      </div>

      {/* Rate Limit Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Hourly Rate Limit
                </h3>
                <p className="text-sm text-blue-800 mt-0.5">
                  {rateLimit?.limit_remaining || 0} leads remaining this hour
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {rateLimit?.limit_remaining || 0}/50
              </div>
              <p className="text-xs text-blue-700 mt-1">
                Resets at {nextResetTime.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min(100, ((rateLimit?.leads_generated || 0) / 50) * 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Warning when close to limit */}
          {(rateLimit?.limit_remaining || 0) <= 10 && (rateLimit?.limit_remaining || 0) > 0 && (
            <p className="text-xs text-blue-700 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Only {rateLimit?.limit_remaining} leads left this hour
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_calls || 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats?.successful_calls || 0} / {stats?.total_calls || 0} calls
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Generated</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_leads_generated || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_leads_requested || 0} requested
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avg_duration_ms ? (stats.avg_duration_ms / 1000).toFixed(1) : 0}s
            </div>
            <p className="text-xs text-muted-foreground">Per API call</p>
          </CardContent>
        </Card>
      </div>

      {/* Methods Breakdown */}
      {stats?.calls_by_method && Object.keys(stats.calls_by_method).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Methods</CardTitle>
            <CardDescription>Breakdown by method type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.calls_by_method).map(([method, count]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {method === 'google_maps' ? 'Google Maps' : 'Social Media'}
                    </Badge>
                  </div>
                  <span className="font-semibold">{count} calls</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent API Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
          <CardDescription>Last 50 lead generation attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No API calls yet
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.success ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs">Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs" title={log.error_message}>Failed</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {log.method === 'google_maps' ? 'Google Maps' : 'Social Media'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.leads_generated} / {log.leads_requested}
                    </TableCell>
                    <TableCell>
                      {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(log.created_at).toLocaleString('nl-NL')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
