// Organization type definitions

export interface Organization {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export interface UserOrg {
  user_id: string
  org_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

export interface UserOrgWithDetails extends UserOrg {
  organization: Organization
}

export interface OrganizationContextType {
  selectedOrg: Organization | null
  userOrgs: UserOrgWithDetails[]
  loading: boolean
  setOrganization: (org: Organization) => void
  clearOrganization: () => void
  refreshOrganizations: () => Promise<void>
}
