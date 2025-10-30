import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { FcGoogle } from "react-icons/fc"
import { Calendar, Mail, TrendingUp, Users, Zap } from "lucide-react"

export function Login() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleGoogleLogin() {
    setError(null)
    setIsLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      })
      
      if (error) {
        setError(error.message)
        setIsLoading(false)
      }
    } catch (err) {
      setError("Er is iets misgegaan. Probeer het opnieuw.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-terracotta-50 via-background to-terracotta-100">
      {/* Left side - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-terracotta-600 to-terracotta-800 p-12 flex-col justify-between text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-terracotta-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-terracotta-600" />
            </div>
            <span className="text-3xl font-bold">Level2b</span>
          </div>

          {/* Tagline */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">
              Automatiseer je sales meetings en verhoog je conversie
            </h1>
            <p className="text-terracotta-100 text-lg">
              Level2b helpt je om efficiënter te werken met slimme automatisering en intelligente lead management.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Geautomatiseerde Email Outreach</h3>
              <p className="text-sm text-terracotta-100">Stuur gepersonaliseerde emails op schaal</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Smart Meeting Scheduling</h3>
              <p className="text-sm text-terracotta-100">Plan meetings automatisch met je leads</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Real-time Analytics</h3>
              <p className="text-sm text-terracotta-100">Inzicht in je sales performance</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Team Collaboration</h3>
              <p className="text-sm text-terracotta-100">Werk samen aan je sales doelen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-terracotta-600 to-terracotta-800 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-terracotta-600 to-terracotta-800 bg-clip-text text-transparent">
              Level2b
            </span>
          </div>

          <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welkom terug
              </h2>
              <p className="text-muted-foreground">
                Log in om verder te gaan met Level2b
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 h-12 text-base font-medium border-2 hover:bg-muted transition-all"
            >
              <FcGoogle className="w-6 h-6" />
              {isLoading ? "Bezig met inloggen..." : "Inloggen met Google"}
            </Button>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-center text-muted-foreground leading-relaxed">
                Door in te loggen ga je akkoord met onze{" "}
                <a href="#" className="text-primary hover:underline">
                  Algemene Voorwaarden
                </a>{" "}
                en{" "}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>

          {/* Additional info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen account?{" "}
              <button className="text-primary font-medium hover:underline">
                Neem contact op voor een demo
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
