import { Navigate, useLocation } from "react-router-dom"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"
import { useAuth } from "@/contexts/AuthContext"
import { useOrganization } from "@/contexts/OrganizationContext"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireOrganization?: boolean
}

/**
 * Protected route component - requires authentication
 * Organization is now OPTIONAL by default (user-centric model)
 */
export function ProtectedRoute({ children, requireOrganization = false }: ProtectedRouteProps) {
  const location = useLocation()
  const { saveRedirectPath } = useAuthRedirect()
  const { user, loading: authLoading } = useAuth()
  const { selectedOrg, loading: orgLoading } = useOrganization()

  // Wait for auth to load
  if (authLoading) return null

  // Wait for org loading only if org is required
  if (requireOrganization && orgLoading) return null

  // Redirect to login if not authenticated
  if (!user) {
    saveRedirectPath(location.pathname + location.search)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // If organization is explicitly required and not selected, redirect to organization selection
  if (requireOrganization && !selectedOrg) {
    return <Navigate to="/select-organization" replace />
  }

  return <>{children}</>
}
