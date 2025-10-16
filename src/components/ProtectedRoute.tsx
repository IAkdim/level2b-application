import { Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const location = useLocation()
  const { saveRedirectPath } = useAuthRedirect()

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }
    getSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return null

  if (!session) {
    saveRedirectPath(location.pathname + location.search)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
