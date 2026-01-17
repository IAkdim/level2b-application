import { Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"
import { isAdmin } from "@/lib/api/devDashboard"

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [adminStatus, setAdminStatus] = useState<boolean>(false)
  const location = useLocation()
  const { saveRedirectPath } = useAuthRedirect()

  useEffect(() => {
    const checkAccess = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)

      if (data.session) {
        try {
          const admin = await isAdmin()
          setAdminStatus(admin)
        } catch (error) {
          console.error('Error checking admin status:', error)
          setAdminStatus(false)
        }
      }
      
      setLoading(false)
    }
    
    checkAccess()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) {
        isAdmin().then(setAdminStatus).catch(() => setAdminStatus(false))
      }
    })
    
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-slate-400">Checking permissions...</div>
      </div>
    )
  }

  if (!session) {
    saveRedirectPath(location.pathname + location.search)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!adminStatus) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-4">You don't have admin privileges</p>
          <a href="/" className="text-blue-500 hover:underline">Return to Dashboard</a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
