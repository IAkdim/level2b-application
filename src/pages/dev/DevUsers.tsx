import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, UserX, UserCheck } from 'lucide-react'
import { getUsers, type AdminUser } from '@/lib/api/devDashboard'
import { Skeleton } from '@/components/ui/skeleton'

export default function DevUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setIsLoading(true)
      const data = await getUsers(100, 0, searchTerm || undefined)
      setUsers(data)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    loadUsers()
  }

  const handleUserClick = (userId: string) => {
    navigate(`/dev/users/${userId}`)
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
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-slate-400 mt-1">
          Manage user accounts and permissions
        </p>
      </div>

      {/* Search */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <Button onClick={handleSearch} variant="secondary">
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-200">All Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">User ID</TableHead>
                <TableHead className="text-slate-400">Email</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Organizations</TableHead>
                <TableHead className="text-slate-400">Created</TableHead>
                <TableHead className="text-slate-400">Last Sign In</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    onClick={() => handleUserClick(user.id)}
                    className="border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs text-slate-400">
                      {user.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-slate-200">{user.email}</TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {user.organization_count}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString('nl-NL')}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString('nl-NL')
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* TODO: Add pagination */}
    </div>
  )
}
