// src/lib/api/settings.ts
// Organization settings with localStorage (no database)

const SETTINGS_KEY = 'level2b_company_settings'

export interface CompanySettings {
  company_name?: string
  company_description?: string
  product_service?: string
  unique_selling_points?: string[]
  target_audience?: string
  industry?: string
  website_url?: string
  contact_email?: string
  contact_phone?: string
  calendly_link?: string
}

/**
 * Get company settings from localStorage
 */
export function getCompanySettings(): CompanySettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return null
    return JSON.parse(stored) as CompanySettings
  } catch (error) {
    console.error('Error loading company settings:', error)
    return null
  }
}

/**
 * Save company settings to localStorage
 */
export function saveCompanySettings(settings: CompanySettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Error saving company settings:', error)
    throw error
  }
}

/**
 * Check if company settings are complete for template generation
 * Works with both CompanySettings (localStorage) and OrganizationSettings (Supabase)
 */
export function validateSettingsForTemplateGeneration(
  settings: CompanySettings | { company_name?: string; product_service?: string; target_audience?: string } | null
): { isValid: boolean; missingFields: string[] } {
  const requiredFields = [
    'company_name',
    'product_service',
    'target_audience',
  ]

  if (!settings) {
    return {
      isValid: false,
      missingFields: requiredFields,
    }
  }

  const missingFields: string[] = []

  if (!settings.company_name || settings.company_name.trim() === '') {
    missingFields.push('company_name')
  }
  if (!settings.product_service || settings.product_service.trim() === '') {
    missingFields.push('product_service')
  }
  if (!settings.target_audience || settings.target_audience.trim() === '') {
    missingFields.push('target_audience')
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Get field labels for UI
 */
export function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    company_name: 'Company name',
    company_description: 'Company description',
    product_service: 'Product/Service',
    unique_selling_points: 'Unique Selling Points (USPs)',
    target_audience: 'Target audience',
    industry: 'Industry',
    website_url: 'Website',
    contact_email: 'Contact Email',
    contact_phone: 'Phone number',
    calendly_link: 'Calendly Link',
  }
  return labels[fieldName] || fieldName
}
