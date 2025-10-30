import Papa from 'papaparse'
import type { CreateLeadInput, LeadStatus, Sentiment } from '@/types/crm'

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
  errors: Papa.ParseError[]
}

export interface ColumnMapping {
  name?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  status?: string
  sentiment?: string
  source?: string
  notes?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  lead?: CreateLeadInput
}

export interface ProcessedRow {
  rowIndex: number
  originalData: Record<string, string>
  result: 'success' | 'error'
  error?: string
  lead?: CreateLeadInput
}

// Column name variations for smart detection
const COLUMN_VARIATIONS: Record<string, string[]> = {
  name: ['name', 'full_name', 'fullname', 'contact_name', 'contactname', 'contact', 'lead_name'],
  email: ['email', 'e-mail', 'email_address', 'emailaddress', 'mail', 'contact_email'],
  phone: ['phone', 'telephone', 'tel', 'mobile', 'cell', 'phone_number', 'phonenumber', 'contact_phone'],
  company: ['company', 'organization', 'organisation', 'org', 'company_name', 'companyname', 'business'],
  title: ['title', 'job_title', 'jobtitle', 'position', 'role', 'job', 'job_position'],
  status: ['status', 'lead_status', 'leadstatus', 'stage', 'lead_stage'],
  sentiment: ['sentiment', 'mood', 'feeling', 'attitude'],
  source: ['source', 'tag', 'tags', 'lead_source', 'leadsource', 'origin', 'channel'],
  notes: ['notes', 'note', 'description', 'comments', 'comment', 'additional_info', 'info'],
}

/**
 * Parse CSV file into structured data
 */
export async function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data as Record<string, string>[],
          errors: results.errors,
        })
      },
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      },
    })
  })
}

/**
 * Detect column mapping from CSV headers
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''))

  for (const [field, variations] of Object.entries(COLUMN_VARIATIONS)) {
    const normalizedVariations = variations.map(v => v.toLowerCase().replace(/[_\s-]/g, ''))

    for (let i = 0; i < headers.length; i++) {
      const normalizedHeader = normalizedHeaders[i]
      if (normalizedVariations.includes(normalizedHeader)) {
        mapping[field as keyof ColumnMapping] = headers[i]
        break
      }
    }
  }

  return mapping
}

/**
 * Parse source tags - auto-detect comma-separated or single value
 */
export function parseSourceTags(value: string | undefined): string[] | undefined {
  if (!value || !value.trim()) {
    return undefined
  }

  const trimmed = value.trim()

  // Check if comma-separated
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
  }

  // Single value
  return [trimmed]
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Normalize status value
 */
function normalizeStatus(value: string | undefined): LeadStatus {
  if (!value) return 'new'

  const normalized = value.toLowerCase().replace(/[_\s-]/g, '')
  const statusMap: Record<string, LeadStatus> = {
    'new': 'new',
    'contacted': 'contacted',
    'replied': 'replied',
    'reply': 'replied',
    'meetingscheduled': 'meeting_scheduled',
    'meeting': 'meeting_scheduled',
    'scheduled': 'meeting_scheduled',
    'closed': 'closed',
    'closedwon': 'closed',
    'won': 'closed',
    'lost': 'lost',
    'closedlost': 'lost',
  }

  return statusMap[normalized] || 'new'
}

/**
 * Normalize sentiment value
 */
function normalizeSentiment(value: string | undefined): Sentiment | undefined {
  if (!value) return undefined

  const normalized = value.toLowerCase().trim()
  const sentimentMap: Record<string, Sentiment> = {
    'positive': 'positive',
    'pos': 'positive',
    'good': 'positive',
    'happy': 'positive',
    'neutral': 'neutral',
    'ok': 'neutral',
    'okay': 'neutral',
    'negative': 'negative',
    'neg': 'negative',
    'bad': 'negative',
    'unhappy': 'negative',
  }

  return sentimentMap[normalized]
}

/**
 * Validate and transform a CSV row into a lead
 */
export function validateLeadRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowIndex: number
): ValidationResult {
  const errors: string[] = []

  // Extract values using mapping
  const name = mapping.name ? row[mapping.name]?.trim() : undefined
  const email = mapping.email ? row[mapping.email]?.trim() : undefined
  const phone = mapping.phone ? row[mapping.phone]?.trim() : undefined
  const company = mapping.company ? row[mapping.company]?.trim() : undefined
  const title = mapping.title ? row[mapping.title]?.trim() : undefined
  const statusRaw = mapping.status ? row[mapping.status]?.trim() : undefined
  const sentimentRaw = mapping.sentiment ? row[mapping.sentiment]?.trim() : undefined
  const sourceRaw = mapping.source ? row[mapping.source]?.trim() : undefined
  const notes = mapping.notes ? row[mapping.notes]?.trim() : undefined

  // Validate required fields
  if (!name) {
    errors.push(`Row ${rowIndex}: Name is required`)
  }

  if (!email) {
    errors.push(`Row ${rowIndex}: Email is required`)
  } else if (!isValidEmail(email)) {
    errors.push(`Row ${rowIndex}: Invalid email format: ${email}`)
  }

  // If validation failed, return early
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // Transform to CreateLeadInput
  const lead: CreateLeadInput = {
    name: name!,
    email: email!,
    phone: phone || undefined,
    company: company || undefined,
    title: title || undefined,
    status: normalizeStatus(statusRaw),
    sentiment: normalizeSentiment(sentimentRaw),
    source: parseSourceTags(sourceRaw),
    notes: notes || undefined,
  }

  return { valid: true, errors: [], lead }
}

/**
 * Process all rows with validation
 */
export function processCSVRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ProcessedRow[] {
  return rows.map((row, index) => {
    const validation = validateLeadRow(row, mapping, index + 2) // +2 for 1-based index and header row

    if (validation.valid) {
      return {
        rowIndex: index + 2,
        originalData: row,
        result: 'success',
        lead: validation.lead,
      }
    } else {
      return {
        rowIndex: index + 2,
        originalData: row,
        result: 'error',
        error: validation.errors.join(', '),
      }
    }
  })
}

/**
 * Generate error report CSV
 */
export function generateErrorReportCSV(failedRows: ProcessedRow[]): string {
  const headers = ['Row', 'Error', 'Original Data']
  const rows = failedRows.map(row => [
    row.rowIndex.toString(),
    row.error || 'Unknown error',
    JSON.stringify(row.originalData),
  ])

  return Papa.unparse({
    fields: headers,
    data: rows,
  })
}

/**
 * Download text as file
 */
export function downloadTextAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
