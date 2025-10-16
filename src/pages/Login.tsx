import { useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FcGoogle } from "react-icons/fc"
import { useAuthRedirect } from "@/hooks/useAuthRedirect"

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const isNavigating = useRef(false)
  const { getRedirectPath } = useAuthRedirect()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isNavigating.current) return

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      isNavigating.current = true
      navigate(getRedirectPath(), { replace: true })
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="flex items-center justify-center h-screen bg-muted/20">
      <form
        onSubmit={handleLogin}
        className="bg-background border rounded-lg p-8 w-full max-w-sm shadow"
      >
        <h1 className="text-2xl font-bold mb-4 text-center">Login</h1>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

        <Button type="submit" className="w-full mt-4">
          Sign In
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2"
        >
          <FcGoogle className="h-5 w-5" />
          Sign in with Google
        </Button>
      </form>
    </div>
  )
}
