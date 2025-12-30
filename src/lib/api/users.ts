import { supabase } from '../supabaseClient'

export interface OrgUser {
  user_id: string
  full_name?: string
  email?: string
  role: 'owner' | 'admin' | 'member'
}

/**
 * Fetch all users in an organization
 */
export async function getOrgUsers(orgId: string): Promise<OrgUser[]> {
  const { data, error } = await supabase
    .from('user_orgs')
    .select(`
      user_id,
      role,
      profiles:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('org_id', orgId)

  if (error) throw error

  // Transform the data to flatten the structure
  return (data || []).map((item: any) => ({
    user_id: item.user_id,
    role: item.role,
    full_name: item.profiles?.full_name,
    email: item.profiles?.email,
  }))
}
