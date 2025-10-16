import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { AppSidebar } from "@/components/AppSidebar"
import { TopBar } from "@/components/TopBar"
import { Dashboard } from "@/pages/Dashboard"
import { Leads } from "@/pages/Leads"
import { EmailThreads } from "@/pages/EmailThreads"
import { Templates } from "@/pages/Templates"
import { Meetings } from "@/pages/Meetings"
import { Analytics } from "@/pages/Analytics"
import { Configuration } from "@/pages/Configuration"
import OutreachLayout from "@/pages/Outreach"
import { FirstVisitModal } from "@/components/FirstVisitModal"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {/* TopBar spans full width at the top */}
        <TopBar />

        {/* Below it, flex layout for sidebar and content */}
        <div className="flex h-[calc(100vh-56px)] bg-background">
          <AppSidebar />
          <main className="flex-1 overflow-auto bg-muted/30 p-8">
            <FirstVisitModal />
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
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App
