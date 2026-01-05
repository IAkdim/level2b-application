import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Activity, AlertTriangle, Building2, TrendingUp, Database, Cpu, HardDrive } from 'lucide-react'
import { getDashboardStats, type DashboardStats } from '@/lib/api/devDashboard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export default function DevOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      setIsLoading(true)
      const data = await getDashboardStats()
      setStats(data)
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2 bg-slate-800" />
          <Skeleton className="h-5 w-96 bg-slate-800" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-slate-400 mt-1">
          Real-time metrics and system health
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Users */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">
              {stats?.total_users || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        {/* Active Users 24h */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Active Users (24h)
            </CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">
              {stats?.active_users_24h || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {/* TODO: Calculate percentage */}
              Last 24 hours
            </p>
          </CardContent>
        </Card>

        {/* Errors 24h */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Errors (24h)
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-100">
              {stats?.error_count_24h || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              System errors
            </p>
          </CardContent>
        </Card>

        {/* Organisations */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">
              Organisations
            </CardTitle>
            <Building className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {stats?.total_organizations || 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active organisations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">System Status</CardTitle>
          <CardDescription className="text-slate-400">
            Current health and operational metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-medium text-slate-200">
              {stats?.system_status || 'Unknown'}
            </span>
            <Badge variant="outline" className="ml-2 text-green-500 border-green-500">
              All Systems Operational
            </Badge>
          </div>
          
          <div className="text-sm text-slate-400">
            Last updated: {new Date().toLocaleString('nl-NL')}
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Cards - Coming Later */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Server Load - Placeholder */}
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Server Load
            </CardTitle>
            <Cpu className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-400">--</div>
            <p className="text-xs text-slate-500 mt-1">
              Coming later
            </p>
          </CardContent>
        </Card>

        {/* Database Size - Placeholder */}
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Database Size
            </CardTitle>
            <Database className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-400">--</div>
            <p className="text-xs text-slate-500 mt-1">
              Coming later
            </p>
          </CardContent>
        </Card>

        {/* Storage Usage - Placeholder */}
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">
              Storage Usage
            </CardTitle>
            <HardDrive className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-400">--</div>
            <p className="text-xs text-slate-500 mt-1">
              Coming later
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics - Placeholder */}
      <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
        <CardHeader>
          <CardTitle className="text-slate-200 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Metrics
          </CardTitle>
          <CardDescription className="text-slate-400">
            Real-time performance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Coming later: Response times, throughput, latency graphs
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
