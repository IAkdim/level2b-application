// src/lib/api/rateLimiter.ts
// Rate limiting system to prevent API abuse and control costs

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  category: string
}

interface RequestRecord {
  count: number
  resetTime: number
}

class RateLimiter {
  private records: Map<string, RequestRecord> = new Map()

  // Rate limit configurations per category
  private configs: Map<string, RateLimitConfig> = new Map([
    // AI/Claude API - expensive, limit to 30 per minute
    ['ai', { maxRequests: 30, windowMs: 60 * 1000, category: 'AI API' }],
    
    // Gmail API - limited by Google, 250 per minute
    ['gmail', { maxRequests: 100, windowMs: 60 * 1000, category: 'Gmail API' }],
    
    // Calendly API - 1000 per minute
    ['calendly', { maxRequests: 500, windowMs: 60 * 1000, category: 'Calendly API' }],
    
    // Database queries - high limit but still protected
    ['database', { maxRequests: 500, windowMs: 60 * 1000, category: 'Database' }],
    
    // Email sending - prevent spam, 50 per minute
    ['email_send', { maxRequests: 50, windowMs: 60 * 1000, category: 'Email Sending' }],
    
    // Template usage - moderate limit
    ['templates', { maxRequests: 200, windowMs: 60 * 1000, category: 'Templates' }],
    
    // User settings - low frequency
    ['settings', { maxRequests: 100, windowMs: 60 * 1000, category: 'Settings' }],
    
    // Default fallback
    ['default', { maxRequests: 100, windowMs: 60 * 1000, category: 'General API' }],
  ])

  /**
   * Check if a request is allowed under rate limits
   */
  async checkLimit(category: string, userId?: string): Promise<{ allowed: boolean; remaining: number; resetTime: number; message?: string }> {
    const config = this.configs.get(category) || this.configs.get('default')!
    const key = `${category}:${userId || 'anonymous'}`
    
    const now = Date.now()
    let record = this.records.get(key)

    // Clean up or reset if window expired
    if (!record || now >= record.resetTime) {
      record = {
        count: 0,
        resetTime: now + config.windowMs,
      }
      this.records.set(key, record)
    }

    // Check if limit exceeded
    if (record.count >= config.maxRequests) {
      const resetInSeconds = Math.ceil((record.resetTime - now) / 1000)
      console.warn(`⚠️ Rate limit exceeded for ${config.category}`, {
        category,
        userId,
        limit: config.maxRequests,
        resetIn: `${resetInSeconds}s`,
      })
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        message: `Rate limit exceeded for ${config.category}. Please wait ${resetInSeconds} seconds.`,
      }
    }

    // Increment counter
    record.count++
    const remaining = config.maxRequests - record.count

    if (remaining <= 5) {
      console.warn(`⚠️ Rate limit warning for ${config.category}`, {
        remaining,
        resetIn: Math.ceil((record.resetTime - now) / 1000),
      })
    }

    return {
      allowed: true,
      remaining,
      resetTime: record.resetTime,
    }
  }

  /**
   * Wrapper function to rate limit any async function
   */
  async withRateLimit<T>(
    category: string,
    fn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const check = await this.checkLimit(category, userId)
    
    if (!check.allowed) {
      throw new Error(check.message || 'Rate limit exceeded')
    }

    try {
      const result = await fn()
      return result
    } catch (error) {
      console.error(`Error in rate-limited ${category} request:`, error)
      throw error
    }
  }

  /**
   * Get current usage stats for a category
   */
  getUsageStats(category: string, userId?: string): { current: number; limit: number; remaining: number } | null {
    const config = this.configs.get(category) || this.configs.get('default')!
    const key = `${category}:${userId || 'anonymous'}`
    const record = this.records.get(key)

    if (!record || Date.now() >= record.resetTime) {
      return {
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
      }
    }

    return {
      current: record.count,
      limit: config.maxRequests,
      remaining: config.maxRequests - record.count,
    }
  }

  /**
   * Clean up expired records (call periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, record] of this.records.entries()) {
      if (now >= record.resetTime) {
        this.records.delete(key)
      }
    }
  }

  /**
   * Update rate limit configuration for a category
   */
  updateConfig(category: string, maxRequests: number, windowMs: number): void {
    const existing = this.configs.get(category) || { category: category }
    this.configs.set(category, {
      ...existing,
      maxRequests,
      windowMs,
    })
  }

  /**
   * Reset rate limit for specific user/category (admin function)
   */
  reset(category?: string, userId?: string): void {
    if (category && userId) {
      const key = `${category}:${userId}`
      this.records.delete(key)
    } else if (category) {
      // Reset all records for this category
      for (const key of this.records.keys()) {
        if (key.startsWith(`${category}:`)) {
          this.records.delete(key)
        }
      }
    } else {
      // Reset everything
      this.records.clear()
    }
  }
}

// Global singleton instance
export const rateLimiter = new RateLimiter()

// Cleanup expired records every 5 minutes
setInterval(() => {
  rateLimiter.cleanup()
}, 5 * 60 * 1000)

// Export helper types
export type RateLimitCategory = 
  | 'ai' 
  | 'gmail' 
  | 'calendly' 
  | 'database' 
  | 'email_send' 
  | 'templates' 
  | 'settings' 
  | 'default'
