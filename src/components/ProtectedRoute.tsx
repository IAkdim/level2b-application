import { Navigate, useLocation } from "react-router-dom"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"
import { useAuth } from "@/contexts/AuthContext"

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Protected route component - requires authentication
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const { saveRedirectPath } = useAuthRedirect()
  const { user, loading: authLoading } = useAuth()

  // Wait for auth to load
  if (authLoading) return null

  // Redirect to login if not authenticated
  if (!user) {
    saveRedirectPath(location.pathname + location.search)
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
