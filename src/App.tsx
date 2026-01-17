import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazy, Suspense } from "react"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { GuideDialog } from "@/components/GuideDialog"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"

// Lazy load pages
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const Leads = lazy(() => import("@/pages/Leads").then(m => ({ default: m.Leads })))
const LeadDetail = lazy(() => import("@/pages/LeadDetail").then(m => ({ default: m.LeadDetail })))
const EmailThreads = lazy(() => import("@/pages/EmailThreads").then(m => ({ default: m.EmailThreads })))
const Templates = lazy(() => import("@/pages/Templates"))
const Meetings = lazy(() => import("@/pages/Meetings").then(m => ({ default: m.Meetings })))
const Analytics = lazy(() => import("@/pages/Analytics").then(m => ({ default: m.Analytics })))
const Configuration = lazy(() => import("@/pages/Configuration").then(m => ({ default: m.Configuration })))
const Profile = lazy(() => import("@/pages/Profile").then(m => ({ default: m.Profile })))
const OutreachLayout = lazy(() => import("@/pages/Outreach"))
const Login = lazy(() => import("@/pages/Login").then(m => ({ default: m.Login })))
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then(m => ({ default: m.AuthCallback })))

const queryClient = new QueryClient()

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
        </div>
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Protected app routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div className="min-h-screen bg-background">
                    <TopBar />
                    <div className="flex h-[calc(100vh-56px)]">
                      <AppSidebar />
                      <main className="flex-1 overflow-auto bg-muted/30">
                        <div className="p-6 lg:p-8">
                          <Suspense fallback={<PageLoader />}>
                            <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/outreach" element={<OutreachLayout />}>
                                <Route index element={<Navigate to="leads" replace />} />
                                <Route path="leads" element={<Leads />} />
                                <Route path="leads/:leadId" element={<LeadDetail />} />
                                <Route path="email-threads" element={<EmailThreads />} />
                                <Route path="templates" element={<Templates />} />
                              </Route>
                              <Route path="/meetings" element={<Meetings />} />
                              <Route path="/analytics" element={<Analytics />} />
                              <Route path="/configuration" element={<Configuration />} />
                              <Route path="/profile" element={<Profile />} />
                            </Routes>
                          </Suspense>
                        </div>
                      </main>
                    </div>
                    {/* Guide Dialog - globally available */}
                    <GuideDialog />
                  </div>
                </ProtectedRoute>
              }
            />
              </Routes>
            </Suspense>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
