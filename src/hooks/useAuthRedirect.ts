import { useCallback } from "react"

const REDIRECT_KEY = "redirectAfterLogin"
const CALLBACK_LOCK_KEY = "auth-callback-lock"

export function useAuthRedirect() {
  const saveRedirectPath = useCallback((path: string) => {
    // Don't save public routes
    if (path.startsWith("/login") || path.startsWith("/auth/callback")) {
      return
    }
    localStorage.setItem(REDIRECT_KEY, path)
  }, [])

  const getRedirectPath = useCallback((): string => {
    const path = localStorage.getItem(REDIRECT_KEY)
    if (path) {
      localStorage.removeItem(REDIRECT_KEY)
      return path
    }
    return "/"
  }, [])

  const acquireCallbackLock = useCallback((): boolean => {
    if (sessionStorage.getItem(CALLBACK_LOCK_KEY)) {
      return false
    }
    sessionStorage.setItem(CALLBACK_LOCK_KEY, "true")
    return true
  }, [])

  const releaseCallbackLock = useCallback(() => {
    sessionStorage.removeItem(CALLBACK_LOCK_KEY)
  }, [])

  return {
    saveRedirectPath,
    getRedirectPath,
    acquireCallbackLock,
    releaseCallbackLock,
  }
}
