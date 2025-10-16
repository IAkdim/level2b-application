import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazy, Suspense } from "react"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
import { ProtectedRoute } from "@/components/ProtectedRoute"

// Lazy load pages
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const Leads = lazy(() => import("@/pages/Leads").then(m => ({ default: m.Leads })))
const EmailThreads = lazy(() => import("@/pages/EmailThreads").then(m => ({ default: m.EmailThreads })))
const Templates = lazy(() => import("@/pages/Templates").then(m => ({ default: m.Templates })))
const Meetings = lazy(() => import("@/pages/Meetings").then(m => ({ default: m.Meetings })))
const Analytics = lazy(() => import("@/pages/Analytics").then(m => ({ default: m.Analytics })))
const Configuration = lazy(() => import("@/pages/Configuration").then(m => ({ default: m.Configuration })))
const OutreachLayout = lazy(() => import("@/pages/Outreach"))
const Login = lazy(() => import("@/pages/Login").then(m => ({ default: m.Login })))
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then(m => ({ default: m.AuthCallback })))

const queryClient = new QueryClient()

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
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
                  <div>
                    <TopBar />
                    <div className="flex h-[calc(100vh-56px)]">
                      <AppSidebar />
                      <main className="flex-1 overflow-auto p-8 bg-muted/30">
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/outreach" element={<OutreachLayout />}>
                              <Route index element={<Navigate to="leads" replace />} />
                              <Route path="leads" element={<Leads />} />
                              <Route path="email-threads" element={<EmailThreads />} />
                              <Route path="templates" element={<Templates />} />
                            </Route>
                            <Route path="/meetings" element={<Meetings />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/configuration" element={<Configuration />} />
                          </Routes>
                        </Suspense>
                      </main>
                    </div>
                  </div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  )
}

export default App
