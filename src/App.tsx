import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { lazy, Suspense } from "react"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AdminRoute } from "@/components/AdminRoute"
import { GuideDialog } from "@/components/GuideDialog"
import { FirstVisitModal } from "@/components/FirstVisitModal"
import { OrganizationProvider } from "@/contexts/OrganizationContext"
import { SubscriptionProvider } from "@/contexts/SubscriptionContext"
import { OnboardingProvider } from "@/contexts/OnboardingContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { Toaster } from "@/components/ui/sonner"
import { SubscriptionGate } from "@/components/SubscriptionGate"
import { DemoGate } from "@/components/DemoGate"
import { GuidedWalkthrough } from "@/components/GuidedWalkthrough"
import { DemoUsageTracker } from "@/components/DemoUsageTracker"

// Lazy load pages
const Dashboard = lazy(() => import("@/pages/Dashboard").then(m => ({ default: m.Dashboard })))
const Leads = lazy(() => import("@/pages/Leads").then(m => ({ default: m.Leads })))
const LeadDetail = lazy(() => import("@/pages/LeadDetail").then(m => ({ default: m.LeadDetail })))
const EmailThreads = lazy(() => import("@/pages/EmailThreads").then(m => ({ default: m.EmailThreads })))
const Templates = lazy(() => import("@/pages/Templates"))
const Meetings = lazy(() => import("@/pages/Meetings").then(m => ({ default: m.Meetings })))
const Analytics = lazy(() => import("@/pages/Analytics").then(m => ({ default: m.Analytics })))
const ApiMonitoring = lazy(() => import("@/pages/ApiMonitoring"))
const Configuration = lazy(() => import("@/pages/Configuration").then(m => ({ default: m.Configuration })))
const OrganizationManagement = lazy(() => import("@/pages/OrganizationManagement").then(m => ({ default: m.OrganizationManagement })))
const Profile = lazy(() => import("@/pages/Profile").then(m => ({ default: m.Profile })))
const OutreachLayout = lazy(() => import("@/pages/Outreach"))
const Login = lazy(() => import("@/pages/Login").then(m => ({ default: m.Login })))
const AuthCallback = lazy(() => import("@/pages/AuthCallback").then(m => ({ default: m.AuthCallback })))
const SelectOrganization = lazy(() => import("@/pages/SelectOrganization").then(m => ({ default: m.SelectOrganization })))
const Subscribe = lazy(() => import("@/pages/Subscribe"))
const SubscribeSuccess = lazy(() => import("@/pages/SubscribeSuccess"))
const BillingSettings = lazy(() => import("@/pages/BillingSettings"))

// Onboarding pages
const OnboardingForm = lazy(() => import("@/pages/OnboardingForm"))
const DemoPaywall = lazy(() => import("@/components/DemoPaywall"))
const ThankYou = lazy(() => import("@/pages/ThankYou"))

// Dev Dashboard pages
const DevDashboardLayout = lazy(() => import("@/components/DevDashboardLayout"))
const DevOverview = lazy(() => import("@/pages/dev/DevOverview"))
const DevUsers = lazy(() => import("@/pages/dev/DevUsers"))
const DevUserDetail = lazy(() => import("@/pages/dev/DevUserDetail"))
const DevLogs = lazy(() => import("@/pages/dev/DevLogs"))
const DevFeatureFlags = lazy(() => import("@/pages/dev/DevFeatureFlags"))
const DevSettings = lazy(() => import("@/pages/dev/DevSettings"))

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
          <OrganizationProvider>
            <SubscriptionProvider>
            <OnboardingProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Organization selection - requires auth but not org */}
              <Route
                path="/select-organization"
                element={
                  <ProtectedRoute requireOrganization={false}>
                    <SelectOrganization />
                  </ProtectedRoute>
                }
              />

              {/* Onboarding flow routes - requires auth but not subscription */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/paywall"
                element={
                  <ProtectedRoute>
                    <DemoPaywall />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/thank-you"
                element={
                  <ProtectedRoute>
                    <ThankYou />
                  </ProtectedRoute>
                }
              />

              {/* Subscription pages - requires auth and org but not subscription */}
              <Route
                path="/subscribe"
                element={
                  <ProtectedRoute>
                    <Subscribe />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscribe/success"
                element={
                  <ProtectedRoute>
                    <SubscribeSuccess />
                  </ProtectedRoute>
                }
              />

              {/* Developer Dashboard - admin only */}
              <Route
                path="/dev/*"
                element={
                  <AdminRoute>
                    <DevDashboardLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<DevOverview />} />
                <Route path="users" element={<DevUsers />} />
                <Route path="users/:userId" element={<DevUserDetail />} />
                <Route path="logs" element={<DevLogs />} />
                <Route path="flags" element={<DevFeatureFlags />} />
                <Route path="settings" element={<DevSettings />} />
              </Route>

            {/* Protected app routes - requires subscription OR demo mode */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DemoGate>
                  <div className="min-h-screen bg-background">
                    <TopBar />
                    {/* Demo usage tracker - shown in demo mode */}
                    <div className="px-4 py-2">
                      <DemoUsageTracker variant="compact" />
                    </div>
                    <div className="flex h-[calc(100vh-56px-52px)]">
                      <AppSidebar />
                      <main className="flex-1 overflow-auto bg-muted/30">
                        <div className="p-6 lg:p-8">
                          <Suspense fallback={<PageLoader />}>
                            <Routes>
                              <Route path="/" element={<Dashboard />} />
                              <Route path="/outreach" element={<OutreachLayout />}>
                                <Route index element={<Navigate to="templates" replace />} />
                                <Route path="templates" element={<Templates />} />
                                <Route path="leads" element={<Leads />} />
                                <Route path="leads/:leadId" element={<LeadDetail />} />
                                <Route path="email-threads" element={<EmailThreads />} />
                              </Route>
                              <Route path="/meetings" element={<Meetings />} />
                              <Route path="/analytics" element={<Analytics />} />
                              <Route path="/api-monitoring" element={<ApiMonitoring />} />
                              <Route path="/configuration" element={<Configuration />} />
                              <Route path="/organization" element={<OrganizationManagement />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/settings/billing" element={<BillingSettings />} />
                            </Routes>
                          </Suspense>
                        </div>
                      </main>
                    </div>
                    {/* Guide Dialog - globally available */}
                    <GuideDialog />
                    {/* Guided walkthrough for demo users */}
                    <GuidedWalkthrough />
                    {/* First visit onboarding modal - for subscribed users */}
                    <FirstVisitModal />
                  </div>
                  </DemoGate>
                </ProtectedRoute>
              }
            />
              </Routes>
            </Suspense>
            <Toaster />
            </OnboardingProvider>
            </SubscriptionProvider>
          </OrganizationProvider>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
