// Prompt Injection Protection Utilities
// Implements multi-layered defense against prompt injection attacks

/**
 * Input validation and sanitization
 */

// Maximum length limits for different input types
export const INPUT_LIMITS = {
  COMPANY_NAME: 20,
  PRODUCT_SERVICE: 500,
  TARGET_AUDIENCE: 300,
  INDUSTRY: 100,
  COMPANY_DESCRIPTION: 1000,
  USP: 200, // Per USP
  MAX_USPS: 10,
  ADDITIONAL_CONTEXT: 2000,
  CALENDLY_URL: 200,
} as const

// Forbidden patterns that indicate injection attempts
const INJECTION_PATTERNS = [
  // System instruction override attempts
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|directives?)/i,
  /disregard\s+(previous|prior|above|system)/i,
  /forget\s+(all\s+)?(previous|prior|above)/i,
  /override\s+(system|instructions?)/i,
  
  // Role manipulation
  /you\s+are\s+(now\s+)?a\s+/i,
  /act\s+as\s+(a\s+)?/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /simulate\s+(being|a)/i,
  /roleplay\s+as/i,
  
  // Instruction injection
  /new\s+instructions?:/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /\[system\]/i,
  /\[instructions?\]/i,
  
  // Prompt leakage attempts
  /show\s+(me\s+)?(your|the)\s+(prompt|instructions?|system\s+message)/i,
  /reveal\s+(your|the)\s+(prompt|instructions?|rules)/i,
  /what\s+(are|is)\s+your\s+(instructions?|prompt|rules|guidelines)/i,
  /print\s+(your|the)\s+prompt/i,
  
  // Code execution attempts
  /<script[^>]*>/i,
  /<iframe[^>]*>/i,
  /javascript:/i,
  /data:text\/html/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  
  // Delimiter manipulation
  /```[a-z]*\s*\n/i, // Code blocks
  /<\/?[a-z][^>]*>/i, // HTML tags (basic check)
] as const

// Suspicious keywords that may indicate injection (warnings, not blocks)
const SUSPICIOUS_KEYWORDS = [
  'bypass', 'jailbreak', 'DAN', 'developer mode',
  'root access', 'admin', 'sudo', 'privilege',
  'confidential', 'secret', 'password', 'token',
  'API key', 'credentials'
] as const

/**
 * Sanitizes user input by removing or escaping potentially dangerous characters
 */
export function sanitizeInput(input: string, maxLength: number): string {
  if (!input) return ''
  
  // Trim and limit length
  let sanitized = input.trim().slice(0, maxLength)
  
  // Remove null bytes and control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  
  // Normalize whitespace (collapse multiple spaces, but preserve newlines)
  sanitized = sanitized.replace(/[^\S\r\n]+/g, ' ')
  
  // Remove excessive newlines (max 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n')
  
  return sanitized
}

/**
 * Validates input against injection patterns
 * Returns { isValid: boolean, reason?: string }
 */
export function validateAgainstInjection(input: string): { 
  isValid: boolean
  reason?: string
  warnings?: string[]
} {
  if (!input) return { isValid: true }
  
  const warnings: string[] = []
  
  // Check against forbidden patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isValid: false,
        reason: 'Input contains forbidden instructions or patterns that could compromise system security'
      }
    }
  }
  
  // Check for suspicious keywords (warn but don't block)
  const lowerInput = input.toLowerCase()
  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      warnings.push(`Contains suspicious keyword: "${keyword}"`)
    }
  }
  
  // Check for excessive special characters (may indicate obfuscation)
  const specialCharRatio = (input.match(/[^a-zA-Z0-9\s]/g) || []).length / input.length
  if (specialCharRatio > 0.3) {
    warnings.push('High ratio of special characters detected')
  }
  
  // Check for repeated instruction-like patterns
  if (/(\w+\s*:\s*){3,}/i.test(input)) {
    warnings.push('Multiple instruction-like patterns detected')
  }
  
  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

/**
 * Validates a URL (specifically for Calendly links)
 */
export function validateCalendlyUrl(url: string): { isValid: boolean, reason?: string } {
  if (!url) return { isValid: true }
  
  try {
    const parsed = new URL(url)
    
    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { isValid: false, reason: 'Calendly URL must use HTTPS' }
    }
    
    // Must be calendly.com domain
    if (!parsed.hostname.endsWith('calendly.com')) {
      return { isValid: false, reason: 'URL must be from calendly.com domain' }
    }
    
    // No javascript: or data: in any part
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return { isValid: false, reason: 'URL contains forbidden protocol' }
    }
    
    return { isValid: true }
  } catch {
    return { isValid: false, reason: 'Invalid URL format' }
  }
}

/**
 * Validates all company info inputs
 */
export function validateCompanyInfo(companyInfo: {
  companyName: string
  companyDescription?: string
  productService: string
  uniqueSellingPoints?: string[]
  targetAudience: string
  industry?: string
  calendlyLink?: string
  additionalContext?: string
}): { isValid: boolean, errors: string[], warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Validate required fields
  if (!companyInfo.companyName?.trim()) {
    errors.push('Company name is required')
  }
  if (!companyInfo.productService?.trim()) {
    errors.push('Product/Service is required')
  }
  if (!companyInfo.targetAudience?.trim()) {
    errors.push('Target audience is required')
  }
  
  // Validate company name
  if (companyInfo.companyName) {
    if (companyInfo.companyName.length > INPUT_LIMITS.COMPANY_NAME) {
      errors.push(`Company name exceeds maximum length of ${INPUT_LIMITS.COMPANY_NAME} characters`)
    }
    const validation = validateAgainstInjection(companyInfo.companyName)
    if (!validation.isValid) {
      errors.push(`Company name: ${validation.reason}`)
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings.map(w => `Company name: ${w}`))
    }
  }
  
  // Validate product/service
  if (companyInfo.productService) {
    if (companyInfo.productService.length > INPUT_LIMITS.PRODUCT_SERVICE) {
      errors.push(`Product/Service exceeds maximum length of ${INPUT_LIMITS.PRODUCT_SERVICE} characters`)
    }
    const validation = validateAgainstInjection(companyInfo.productService)
    if (!validation.isValid) {
      errors.push(`Product/Service: ${validation.reason}`)
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings.map(w => `Product/Service: ${w}`))
    }
  }
  
  // Validate target audience
  if (companyInfo.targetAudience) {
    if (companyInfo.targetAudience.length > INPUT_LIMITS.TARGET_AUDIENCE) {
      errors.push(`Target audience exceeds maximum length of ${INPUT_LIMITS.TARGET_AUDIENCE} characters`)
    }
    const validation = validateAgainstInjection(companyInfo.targetAudience)
    if (!validation.isValid) {
      errors.push(`Target audience: ${validation.reason}`)
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings.map(w => `Target audience: ${w}`))
    }
  }
  
  // Validate optional fields
  if (companyInfo.companyDescription) {
    if (companyInfo.companyDescription.length > INPUT_LIMITS.COMPANY_DESCRIPTION) {
      errors.push(`Company description exceeds maximum length of ${INPUT_LIMITS.COMPANY_DESCRIPTION} characters`)
    }
    const validation = validateAgainstInjection(companyInfo.companyDescription)
    if (!validation.isValid) {
      errors.push(`Company description: ${validation.reason}`)
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings.map(w => `Company description: ${w}`))
    }
  }
  
  if (companyInfo.industry && companyInfo.industry.length > INPUT_LIMITS.INDUSTRY) {
    errors.push(`Industry exceeds maximum length of ${INPUT_LIMITS.INDUSTRY} characters`)
  }
  
  // Validate USPs
  if (companyInfo.uniqueSellingPoints) {
    if (companyInfo.uniqueSellingPoints.length > INPUT_LIMITS.MAX_USPS) {
      errors.push(`Maximum ${INPUT_LIMITS.MAX_USPS} USPs allowed`)
    }
    companyInfo.uniqueSellingPoints.forEach((usp, index) => {
      if (usp.length > INPUT_LIMITS.USP) {
        errors.push(`USP #${index + 1} exceeds maximum length of ${INPUT_LIMITS.USP} characters`)
      }
      const validation = validateAgainstInjection(usp)
      if (!validation.isValid) {
        errors.push(`USP #${index + 1}: ${validation.reason}`)
      }
      if (validation.warnings) {
        warnings.push(...validation.warnings.map(w => `USP #${index + 1}: ${w}`))
      }
    })
  }
  
  // Validate additional context (highest risk area)
  if (companyInfo.additionalContext) {
    if (companyInfo.additionalContext.length > INPUT_LIMITS.ADDITIONAL_CONTEXT) {
      errors.push(`Additional context exceeds maximum length of ${INPUT_LIMITS.ADDITIONAL_CONTEXT} characters`)
    }
    const validation = validateAgainstInjection(companyInfo.additionalContext)
    if (!validation.isValid) {
      errors.push(`Additional context: ${validation.reason}`)
    }
    if (validation.warnings) {
      warnings.push(...validation.warnings.map(w => `Additional context: ${w}`))
    }
  }
  
  // Validate Calendly URL
  if (companyInfo.calendlyLink) {
    if (companyInfo.calendlyLink.length > INPUT_LIMITS.CALENDLY_URL) {
      errors.push(`Calendly URL exceeds maximum length of ${INPUT_LIMITS.CALENDLY_URL} characters`)
    }
    const urlValidation = validateCalendlyUrl(companyInfo.calendlyLink)
    if (!urlValidation.isValid) {
      errors.push(`Calendly URL: ${urlValidation.reason}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Sanitizes all company info inputs
 */
export function sanitizeCompanyInfo(companyInfo: {
  companyName: string
  companyDescription?: string
  productService: string
  uniqueSellingPoints?: string[]
  targetAudience: string
  industry?: string
  calendlyLink?: string
  additionalContext?: string
}) {
  return {
    companyName: sanitizeInput(companyInfo.companyName, INPUT_LIMITS.COMPANY_NAME),
    companyDescription: companyInfo.companyDescription 
      ? sanitizeInput(companyInfo.companyDescription, INPUT_LIMITS.COMPANY_DESCRIPTION)
      : undefined,
    productService: sanitizeInput(companyInfo.productService, INPUT_LIMITS.PRODUCT_SERVICE),
    uniqueSellingPoints: companyInfo.uniqueSellingPoints
      ?.slice(0, INPUT_LIMITS.MAX_USPS)
      .map(usp => sanitizeInput(usp, INPUT_LIMITS.USP))
      .filter(usp => usp.length > 0),
    targetAudience: sanitizeInput(companyInfo.targetAudience, INPUT_LIMITS.TARGET_AUDIENCE),
    industry: companyInfo.industry 
      ? sanitizeInput(companyInfo.industry, INPUT_LIMITS.INDUSTRY)
      : undefined,
    calendlyLink: companyInfo.calendlyLink?.trim(),
    additionalContext: companyInfo.additionalContext
      ? sanitizeInput(companyInfo.additionalContext, INPUT_LIMITS.ADDITIONAL_CONTEXT)
      : undefined,
  }
}

/**
 * Output filtering - validates generated template
 */
export function validateTemplateOutput(template: {
  templateName?: string
  subject?: string
  body?: string
  tone?: string
  targetSegment?: string
}): { isValid: boolean, errors: string[] } {
  const errors: string[] = []
  
  // Required fields
  if (!template.templateName || template.templateName.trim().length === 0) {
    errors.push('Template name is missing')
  }
  if (!template.subject || template.subject.trim().length === 0) {
    errors.push('Subject line is missing')
  }
  if (!template.body || template.body.trim().length === 0) {
    errors.push('Email body is missing')
  }
  
  // Length limits (prevent DoS)
  if (template.templateName && template.templateName.length > 200) {
    errors.push('Template name is too long')
  }
  if (template.subject && template.subject.length > 200) {
    errors.push('Subject line is too long')
  }
  if (template.body && template.body.length > 5000) {
    errors.push('Email body is excessively long')
  }
  
  // Check for leaked system information
  const sensitivePatterns = [
    /CLAUDE_API_KEY/i,
    /system\s*prompt/i,
    /edge\s*function/i,
    /supabase/i,
    /deno\.env/i,
    /secret/i,
  ]
  
  const fullOutput = `${template.templateName} ${template.subject} ${template.body}`
  for (const pattern of sensitivePatterns) {
    if (pattern.test(fullOutput)) {
      errors.push('Generated template contains sensitive system information')
      break
    }
  }
  
  // Check for code injection in output
  if (template.body) {
    if (/<script/i.test(template.body) || /javascript:/i.test(template.body)) {
      errors.push('Generated template contains potentially malicious code')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
