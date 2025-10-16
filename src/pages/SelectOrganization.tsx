import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useOrganization } from "@/contexts/OrganizationContext"
import { OrganizationSelector } from "@/components/OrganizationSelector"
import { Building2 } from "lucide-react"

export function SelectOrganization() {
  const { selectedOrg, loading } = useOrganization()
  const navigate = useNavigate()

  useEffect(() => {
    // If an organization is already selected, redirect to dashboard
    if (!loading && selectedOrg) {
      navigate("/", { replace: true })
    }
  }, [selectedOrg, loading, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-muted/20">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-muted/20">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <Building2 className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Welcome to Level2B</h1>
        <p className="text-muted-foreground">
          Select or create an organization to get started
        </p>
      </div>

      <OrganizationSelector open={true} onOpenChange={() => {}} />
    </div>
  )
}
