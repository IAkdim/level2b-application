// src/hooks/useRateLimitStatus.ts
// Hook to monitor and display rate limit status
// TODO: [2026-01-09] These hooks are exported but only referenced in documentation (RATE_LIMITING.md).
// Keep for potential future UI integration. Review and remove if confirmed unnecessary.

import { useState, useEffect } from 'react'
import { rateLimiter, type RateLimitCategory } from '@/lib/api/rateLimiter'
import { supabase } from '@/lib/supabaseClient'

interface RateLimitStatus {
  current: number
  limit: number
  remaining: number
  percentage: number
}

export function useRateLimitStatus(category: RateLimitCategory) {
  const [status, setStatus] = useState<RateLimitStatus | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // Get user ID
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
      }
    }
    getUserId()
  }, [])

  useEffect(() => {
    if (!userId) return

    const updateStatus = () => {
      const stats = rateLimiter.getUsageStats(category, userId)
      if (stats) {
        setStatus({
          ...stats,
          percentage: (stats.current / stats.limit) * 100,
        })
      }
    }

    // Update immediately
    updateStatus()

    // Update every 5 seconds
    const interval = setInterval(updateStatus, 5000)

    return () => clearInterval(interval)
  }, [category, userId])

  return status
}

// Hook to check if a specific action is rate limited
export function useRateLimitCheck() {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUserId(session.user.id)
      }
    }
    getUserId()
  }, [])

  const checkLimit = async (category: RateLimitCategory): Promise<boolean> => {
    if (!userId) return false
    const result = await rateLimiter.checkLimit(category, userId)
    return result.allowed
  }

  return { checkLimit, userId }
}
