import { supabase } from '../supabaseClient'

// ============================================
// TYPES
// ============================================

export interface DashboardStats {
  total_users: number
  active_users_24h: number
  error_count_24h: number
  total_organizations: number
  system_status: string
}

export interface AdminUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  is_suspended: boolean
  organization_count: number
}

export interface UserDetails {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  is_suspended: boolean
  banned_until: string | null
  organizations: Array<{
    id: string
    name: string
    role: string
    joined_at: string
  }>
}

export interface SystemLog {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  source: string | null
  user_id: string | null
  created_at: string
}

export interface FeatureFlag {
  id: string
  name: string
  key: string
  description: string | null
  enabled: boolean
  rollout_percentage: number
  updated_at: string
}

export interface SystemSetting {
  key: string
  value: any
  description: string | null
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  admin_email: string
  action: string
  resource_type: string
  resource_id: string | null
  old_value: any
  new_value: any
  created_at: string
}

// ============================================
// ADMIN API FUNCTIONS
// ============================================

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data, error } = await supabase.rpc('is_admin', { user_id: user.id })
    
    if (error) {
      console.error('Error checking admin status:', error)
      return false
    }
    
    return data === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Get current user's role
 */
export async function getUserRole(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('get_user_role')
    
    if (error) {
      console.error('Error getting user role:', error)
      return 'user'
    }
    
    return data || 'user'
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'user'
  }
}

/**
 * Get dashboard overview stats
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('admin_get_dashboard_stats')
  
  if (error) {
    console.error('Error fetching dashboard stats:', error)
    throw new Error(error.message)
  }
  
  return data
}

/**
 * Get all users with pagination
 */
export async function getUsers(
  limit: number = 50,
  offset: number = 0,
  search?: string
): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_get_users', {
    p_limit: limit,
    p_offset: offset,
    p_search: search || null
  })
  
  if (error) {
    console.error('Error fetching users:', error)
    throw new Error(error.message)
  }
  
  return data || []
}

/**
 * Get user details
 */
export async function getUserDetails(userId: string): Promise<UserDetails> {
  const { data, error } = await supabase.rpc('admin_get_user_details', {
    p_user_id: userId
  })
  
  if (error) {
    console.error('Error fetching user details:', error)
    throw new Error(error.message)
  }
  
  return data
}

/**
 * Suspend a user
 */
export async function suspendUser(userId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_suspend_user', {
    p_user_id: userId,
    p_reason: reason || null
  })
  
  if (error) {
    console.error('Error suspending user:', error)
    throw new Error(error.message)
  }
}

/**
 * Unsuspend a user
 */
export async function unsuspendUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unsuspend_user', {
    p_user_id: userId
  })
  
  if (error) {
    console.error('Error unsuspending user:', error)
    throw new Error(error.message)
  }
}

/**
 * Get system logs
 */
export async function getSystemLogs(
  limit: number = 100,
  offset: number = 0,
  level?: string
): Promise<SystemLog[]> {
  const { data, error } = await supabase.rpc('admin_get_system_logs', {
    p_limit: limit,
    p_offset: offset,
    p_level: level || null
  })
  
  if (error) {
    console.error('Error fetching system logs:', error)
    throw new Error(error.message)
  }
  
  return data || []
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.rpc('admin_get_feature_flags')
  
  if (error) {
    console.error('Error fetching feature flags:', error)
    throw new Error(error.message)
  }
  
  return data || []
}

/**
 * Toggle a feature flag
 */
export async function toggleFeatureFlag(flagId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_toggle_feature_flag', {
    p_flag_id: flagId,
    p_enabled: enabled
  })
  
  if (error) {
    console.error('Error toggling feature flag:', error)
    throw new Error(error.message)
  }
}

/**
 * Get system settings
 */
export async function getSystemSettings(): Promise<SystemSetting[]> {
  const { data, error } = await supabase.rpc('admin_get_system_settings')
  
  if (error) {
    console.error('Error fetching system settings:', error)
    throw new Error(error.message)
  }
  
  return data || []
}

/**
 * Update a system setting
 */
export async function updateSystemSetting(key: string, value: any): Promise<void> {
  const { error } = await supabase.rpc('admin_update_system_setting', {
    p_key: key,
    p_value: value
  })
  
  if (error) {
    console.error('Error updating system setting:', error)
    throw new Error(error.message)
  }
}

/**
 * Get admin audit log
 */
export async function getAuditLog(
  limit: number = 100,
  offset: number = 0
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.rpc('admin_get_audit_log', {
    p_limit: limit,
    p_offset: offset
  })
  
  if (error) {
    console.error('Error fetching audit log:', error)
    throw new Error(error.message)
  }
  
  return data || []
}

/**
 * Create a system log entry
 */
export async function createSystemLog(
  level: 'info' | 'warning' | 'error' | 'critical',
  message: string,
  context?: any,
  source?: string
): Promise<void> {
  const { error } = await supabase.rpc('create_system_log', {
    p_level: level,
    p_message: message,
    p_context: context ? JSON.stringify(context) : null,
    p_source: source || 'frontend'
  })
  
  if (error) {
    console.error('Error creating system log:', error)
  }
}
