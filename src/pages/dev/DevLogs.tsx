import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Info, AlertCircle, XCircle, RefreshCw } from 'lucide-react'
import { getSystemLogs, type SystemLog } from '@/lib/api/devDashboard'
import { Skeleton } from '@/components/ui/skeleton'

const LEVEL_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500' },
  critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-600/10', border: 'border-red-600' },
}

export default function DevLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadLogs()
  }, [filter])

  const loadLogs = async () => {
    try {
      setIsLoading(true)
      const data = await getSystemLogs(100, 0, filter)
      setLogs(data)
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getLevelBadge = (level: SystemLog['level']) => {
    const config = LEVEL_CONFIG[level]
    const Icon = config.icon

    return (
      <Badge
        variant="outline"
        className={`${config.color} ${config.border} gap-1`}
      >
        <Icon className="h-3 w-3" />
        {level.toUpperCase()}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48 bg-slate-800" />
        <Skeleton className="h-96 bg-slate-800" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
          <p className="text-slate-400 mt-1">
            Application logs and error tracking
          </p>
        </div>

        <Button onClick={loadLogs} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              variant={filter === undefined ? 'secondary' : 'outline'}
              onClick={() => setFilter(undefined)}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={filter === 'info' ? 'secondary' : 'outline'}
              onClick={() => setFilter('info')}
              size="sm"
            >
              Info
            </Button>
            <Button
              variant={filter === 'warning' ? 'secondary' : 'outline'}
              onClick={() => setFilter('warning')}
              size="sm"
            >
              Warnings
            </Button>
            <Button
              variant={filter === 'error' ? 'secondary' : 'outline'}
              onClick={() => setFilter('error')}
              size="sm"
            >
              Errors
            </Button>
            <Button
              variant={filter === 'critical' ? 'secondary' : 'outline'}
              onClick={() => setFilter('critical')}
              size="sm"
            >
              Critical
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">Recent Logs ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400 w-[140px]">Timestamp</TableHead>
                <TableHead className="text-slate-400 w-[120px]">Level</TableHead>
                <TableHead className="text-slate-400">Message</TableHead>
                <TableHead className="text-slate-400 w-[120px]">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                    No logs found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-slate-800 hover:bg-slate-800/50"
                  >
                    <TableCell className="text-slate-400 text-xs font-mono">
                      {new Date(log.created_at).toLocaleString('nl-NL', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>{getLevelBadge(log.level)}</TableCell>
                    <TableCell className="text-slate-200 font-mono text-sm">
                      {log.message}
                    </TableCell>
                    <TableCell>
                      {log.source && (
                        <Badge variant="outline" className="text-xs">
                          {log.source}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Placeholder Cards - Coming Later */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Advanced Filtering</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Date range, source filter, user filter, regex search
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-slate-200">Stack Traces</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Coming later: Expandable stack traces for errors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TODO: Add pagination */}
    </div>
  )
}
