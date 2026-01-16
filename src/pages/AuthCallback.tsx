import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"
import { Loader2 } from "lucide-react"

export function AuthCallback() {
  const navigate = useNavigate()
  const { getRedirectPath, acquireCallbackLock, releaseCallbackLock } = useAuthRedirect()
  const [status, setStatus] = useState<'processing' | 'initializing' | 'redirecting'>('processing')

  useEffect(() => {
    const handleSession = async () => {
      // Prevent double execution in React Strict Mode
      if (!acquireCallbackLock()) return

      try {
        // Allow time for Supabase to process OAuth result
        await new Promise((resolve) => setTimeout(resolve, 2000))

        const { data } = await supabase.auth.getSession()

        if (data?.session) {
          const userId = data.session.user.id
          
          // Initialize onboarding for user (handles new vs returning)
          setStatus('initializing')
          try {
            const { data: initData, error: initError } = await supabase
              .rpc('initialize_user_onboarding', { p_user_id: userId })
            
            if (initError) {
              console.error("Error initializing onboarding:", initError)
              // Continue anyway - will be initialized on first context load
            } else if (initData && initData.length > 0 && initData[0].is_new) {
              // New user - redirect to demo mode (home with walkthrough)
              console.log("New user detected, starting demo mode")
            }
          } catch (err) {
            console.error("Exception initializing onboarding:", err)
          }
          
          // Get user's onboarding state to determine where to route
          setStatus('redirecting')
          try {
            const { data: stateData } = await supabase
              .rpc('get_user_onboarding_state', { p_user_id: userId })
            
            if (stateData && stateData.length > 0) {
              const state = stateData[0]
              
              // Determine routing based on state
              if (state.has_subscription) {
                // Subscribed user - go to saved path or dashboard
                navigate(getRedirectPath(), { replace: true })
              } else if (state.all_limits_exhausted) {
                // Demo exhausted - go to paywall
                navigate("/paywall", { replace: true })
              } else if (state.demo_mode_active) {
                // Demo active - go to home with walkthrough
                navigate("/", { replace: true })
              } else if (!state.onboarding_completed && !state.onboarding_skipped) {
                // Needs onboarding
                navigate("/onboarding", { replace: true })
              } else {
                // Needs to subscribe
                navigate("/subscribe", { replace: true })
              }
              return
            }
          } catch (err) {
            console.error("Error checking onboarding state:", err)
          }
          
          // Fallback to saved redirect path
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

  const statusMessages = {
    processing: "Signing you in...",
    initializing: "Setting up your account...",
    redirecting: "Almost there..."
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{statusMessages[status]}</p>
      </div>
    </div>
  )
}
