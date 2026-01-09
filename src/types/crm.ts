// TypeScript types for CRM entities

export type LeadStatus = 'new' | 'contacted' | 'replied' | 'meeting_scheduled' | 'closed' | 'lost'
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
export type Language = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it' | 'pt'

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
  source?: string[] // Changed to array for multiple tags
  language?: Language // Language for outreach (en, nl, de, fr, es, it, pt)

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
  source?: string[] // Changed to array for multiple tags
  language?: Language
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
  source?: string[] // Changed to array for multiple tags
  notes?: string
  metadata?: Record<string, any>
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
// EMAIL TEMPLATE
// ============================================================================
export interface EmailTemplate {
  id: string
  org_id: string
  
  // Template content
  name: string
  subject: string
  body: string
  language?: Language // Language the template is written in
  
  // Generation metadata
  company_info?: Record<string, any>
  additional_context?: string
  
  // Usage tracking
  times_used: number
  last_used_at?: string
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface CreateEmailTemplateInput {
  name: string
  subject: string
  body: string
  language?: Language
  company_info?: Record<string, any>
  additional_context?: string
}

export interface UpdateEmailTemplateInput {
  name?: string
  subject?: string
  body?: string
  company_info?: Record<string, any>
  additional_context?: string
}

// ============================================================================
// FEEDBACK
// ============================================================================
export type FeedbackType = 'bug' | 'feature' | 'improvement' | 'other'
export type FeedbackStatus = 'new' | 'in_review' | 'planned' | 'completed' | 'rejected'

export interface Feedback {
  id: string
  org_id: string
  user_id?: string
  
  // Feedback content
  type: FeedbackType
  message: string
  rating?: number
  
  // Optional metadata
  page_url?: string
  user_agent?: string
  metadata?: Record<string, any>
  
  // Status tracking
  status: FeedbackStatus
  admin_notes?: string
  
  // Timestamps
  created_at: string
  updated_at: string
}

export interface CreateFeedbackInput {
  type: FeedbackType
  message: string
  rating?: number
  page_url?: string
  metadata?: Record<string, any>
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
  sentiment?: Sentiment | Sentiment[]
  search?: string
  source?: string[] // Changed to array for multi-tag filtering
  sortBy?: 'name' | 'company' | 'created_at' | 'last_contact_at' | 'status'
  sortOrder?: 'asc' | 'desc'
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[]
  priority?: TaskPriority
  assigned_to?: string
  lead_id?: string
  due_before?: string
  due_after?: string
}
