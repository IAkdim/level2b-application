import { supabase } from "@/lib/supabaseClient"

/**
 * Custom error class for authentication failures
 */
export class AuthenticationError extends Error {
  constructor(message: string = "Google re-authentication required") {
    super(message)
    this.name = "AuthenticationError"
  }
}

/**
 * Check if an error is an authentication error
 */
export function isAuthenticationError(error: unknown): boolean {
  if (error instanceof AuthenticationError) return true
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('niet geautoriseerd') || 
           message.includes('log opnieuw in') ||
           message.includes('authentication') ||
           message.includes('unauthorized') ||
           message.includes('401')
  }
  return false
}

/**
 * Trigger Google re-authentication without logging out
 * Opens a popup window for re-authentication
 */
export async function reAuthenticateWithGoogle(): Promise<void> {
  try {
    // Get current URL for redirect
    const currentUrl = window.location.href
    
    // Sign in with OAuth again to refresh tokens
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: currentUrl,
        scopes: 'email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent', // Force consent screen to refresh tokens
        },
        skipBrowserRedirect: false,
      },
    })
    
    if (error) {
      console.error("Re-authentication error:", error)
      throw new Error(error.message)
    }
  } catch (error) {
    console.error("Exception during re-authentication:", error)
    throw error
  }
}
