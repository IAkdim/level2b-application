import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"

export function AuthCallback() {
  const navigate = useNavigate()
  const { getRedirectPath, acquireCallbackLock, releaseCallbackLock } = useAuthRedirect()

  useEffect(() => {
    const handleSession = async () => {
      // Prevent double execution in React Strict Mode
      if (!acquireCallbackLock()) return

      try {
        // Allow time for Supabase to process OAuth result
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const { data } = await supabase.auth.getSession()

        if (data?.session) {
          navigate(getRedirectPath(), { replace: true })
        } else {
          navigate("/login", { replace: true })
        }
      } catch (error) {
        console.error("Auth callback error:", error)
        navigate("/login", { replace: true })
      } finally {
        releaseCallbackLock()
      }
    }

    handleSession()
  }, [navigate, getRedirectPath, acquireCallbackLock, releaseCallbackLock])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-muted-foreground">Signing you in...</p>
    </div>
  )
}
