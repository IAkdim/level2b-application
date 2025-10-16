import { Navigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"
import { useOrganization } from "@/contexts/OrganizationContext"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

export function ProtectedRoute({ children, requireOrganization = true }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const location = useLocation()
  const { saveRedirectPath } = useAuthRedirect()
  const { selectedOrg, loading: orgLoading } = useOrganization()

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

  if (loading || orgLoading) return null

  if (!session) {
    saveRedirectPath(location.pathname + location.search)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // If organization is required and not selected, redirect to organization selection
  if (requireOrganization && !selectedOrg) {
    return <Navigate to="/select-organization" replace />
  }

  return <>{children}</>
}
