import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Organization, UserOrgWithDetails, OrganizationContextType } from "@/types/organization"

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

const STORAGE_KEY = "selectedOrgId"

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrgWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch user's organizations
  const fetchUserOrganizations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      console.log("Fetching orgs for user:", session?.user?.id)

      if (!session?.user) {
        setUserOrgs([])
        setLoading(false)
        return
      }

      // Fetch organizations the user belongs to
      const { data, error } = await supabase
        .from("user_orgs")
        .select(`
          user_id,
          org_id,
          role,
          created_at,
          organization:organizations(id, name, created_at, updated_at)
        `)
        .eq("user_id", session.user.id)

      console.log("Organization fetch result:", { data, error, dataLength: data?.length })

      if (error) {
        console.error("Error fetching organizations:", error)
        setUserOrgs([])
      } else {
        const formattedData = (data || []).map((item: any) => ({
          user_id: item.user_id,
          org_id: item.org_id,
          role: item.role,
          created_at: item.created_at,
          organization: item.organization,
        })) as UserOrgWithDetails[]

        setUserOrgs(formattedData)

        // Auto-select organization from localStorage or first available
        const storedOrgId = localStorage.getItem(STORAGE_KEY)
        if (storedOrgId) {
          const org = formattedData.find((uo) => uo.org_id === storedOrgId)
          if (org) {
            setSelectedOrg(org.organization)
          } else if (formattedData.length > 0) {
            // Stored org not found, select first available
            setSelectedOrg(formattedData[0].organization)
            localStorage.setItem(STORAGE_KEY, formattedData[0].org_id)
          }
        } else if (formattedData.length > 0) {
          // No stored org, select first available
          setSelectedOrg(formattedData[0].organization)
          localStorage.setItem(STORAGE_KEY, formattedData[0].org_id)
        }
      }
    } catch (error) {
      console.error("Error in fetchUserOrganizations:", error)
      setUserOrgs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserOrganizations()

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchUserOrganizations()
      } else if (event === "SIGNED_OUT") {
        setSelectedOrg(null)
        setUserOrgs([])
        localStorage.removeItem(STORAGE_KEY)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const setOrganization = (org: Organization) => {
    setSelectedOrg(org)
    localStorage.setItem(STORAGE_KEY, org.id)
  }

  const clearOrganization = () => {
    setSelectedOrg(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const refreshOrganizations = async () => {
    setLoading(true)
    await fetchUserOrganizations()
  }

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrg,
        userOrgs,
        loading,
        setOrganization,
        clearOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error("useOrganization must be used within OrganizationProvider")
  }
  return context
}
