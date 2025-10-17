// TypeScript types for CRM entities

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'meeting_scheduled' | 'closed' | 'lost'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'status_change' | 'task'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'

// ============================================================================
// LEAD
// ============================================================================
export interface Lead {
  id: string
  org_id: string

  // Contact Information
  name: string
  email: string
  phone?: string
  company?: string
  title?: string

  // Status & Tracking
  status: LeadStatus
  sentiment?: Sentiment
  source?: string

  // Additional Data
  notes?: string
  metadata?: Record<string, any>

  // Timestamps
  created_at: string
  updated_at: string
  last_contact_at?: string
}

export interface CreateLeadInput {
  name: string
  email: string
  phone?: string
  company?: string
  title?: string
  status?: LeadStatus
  sentiment?: Sentiment
  source?: string
  notes?: string
  metadata?: Record<string, any>
}

export interface UpdateLeadInput {
  name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  status?: LeadStatus
  sentiment?: Sentiment
  source?: string
  notes?: string
  metadata?: Record<string, any>
}

// ============================================================================
// ACTIVITY
// ============================================================================
export interface Activity {
  id: string
  org_id: string
  lead_id: string

  // Activity Details
  type: ActivityType
  subject?: string
  content?: string
  metadata?: Record<string, any>

  // Timestamps
  created_at: string
  created_by?: string
  scheduled_at?: string

  // Joined data (not in DB)
  creator?: {
    id: string
    full_name?: string
    email?: string
  }
}

export interface CreateActivityInput {
  lead_id: string
  type: ActivityType
  subject?: string
  content?: string
  metadata?: Record<string, any>
  scheduled_at?: string
}

// ============================================================================
// TASK
// ============================================================================
export interface Task {
  id: string
  org_id: string
  lead_id?: string

  // Task Details
  title: string
  description?: string

  // Status & Priority
  status: TaskStatus
  priority: TaskPriority

  // Assignment
  assigned_to?: string

  // Timestamps
  due_date?: string
  completed_at?: string
  created_at: string
  created_by?: string
  updated_at: string

  // Joined data (not in DB)
  lead?: {
    id: string
    name: string
    email: string
    company?: string
  }
  assignee?: {
    id: string
    full_name?: string
    email?: string
  }
}

export interface CreateTaskInput {
  title: string
  description?: string
  lead_id?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigned_to?: string
  due_date?: string
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigned_to?: string
  due_date?: string
  completed_at?: string
}

// ============================================================================
// NOTE
// ============================================================================
export interface Note {
  id: string
  org_id: string
  lead_id: string

  // Note Content
  content: string
  is_pinned: boolean

  // Timestamps
  created_at: string
  created_by?: string
  updated_at: string

  // Joined data (not in DB)
  creator?: {
    id: string
    full_name?: string
    email?: string
  }
}

export interface CreateNoteInput {
  lead_id: string
  content: string
  is_pinned?: boolean
}

export interface UpdateNoteInput {
  content?: string
  is_pinned?: boolean
}

// ============================================================================
// DEAL
// ============================================================================
export interface Deal {
  id: string
  org_id: string
  lead_id: string

  // Deal Information
  title: string
  value?: number
  currency: string

  // Pipeline Stage
  stage: DealStage
  probability?: number

  // Dates
  expected_close_date?: string
  actual_close_date?: string

  // Additional Info
  notes?: string
  lost_reason?: string

  // Timestamps
  created_at: string
  created_by?: string
  updated_at: string

  // Joined data (not in DB)
  lead?: {
    id: string
    name: string
    email: string
    company?: string
  }
}

export interface CreateDealInput {
  lead_id: string
  title: string
  value?: number
  currency?: string
  stage?: DealStage
  probability?: number
  expected_close_date?: string
  notes?: string
}

export interface UpdateDealInput {
  title?: string
  value?: number
  currency?: string
  stage?: DealStage
  probability?: number
  expected_close_date?: string
  actual_close_date?: string
  notes?: string
  lost_reason?: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface LeadFilters {
  status?: LeadStatus | LeadStatus[]
  sentiment?: Sentiment
  search?: string
  source?: string
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[]
  priority?: TaskPriority
  assigned_to?: string
  lead_id?: string
  due_before?: string
  due_after?: string
}

export interface ActivityFilters {
  type?: ActivityType | ActivityType[]
  lead_id?: string
  created_after?: string
  created_before?: string
}
