import { useQuery } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/OrganizationContext'
import * as usersApi from '@/lib/api/users'

/**
 * Hook to fetch users in the current organization
 */
export function useOrgUsers() {
  const { selectedOrg } = useOrganization()

  return useQuery({
    queryKey: ['org-users', selectedOrg?.id],
    queryFn: () => {
      if (!selectedOrg) throw new Error('No organization selected')
      return usersApi.getOrgUsers(selectedOrg.id)
    },
    enabled: !!selectedOrg,
  })
}
