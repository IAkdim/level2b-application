// src/components/RateLimitWarning.tsx
// Component to display rate limit warnings

import { useRateLimitStatus } from '@/hooks/useRateLimitStatus'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { type RateLimitCategory } from '@/lib/api/rateLimiter'

interface RateLimitWarningProps {
  category: RateLimitCategory
  showAlways?: boolean
}

export function RateLimitWarning({ category, showAlways = false }: RateLimitWarningProps) {
  const status = useRateLimitStatus(category)

  if (!status) return null

  // Only show warning if usage is above 70% or if showAlways is true
  const shouldShow = showAlways || status.percentage >= 70

  if (!shouldShow) return null

  const isNearLimit = status.percentage >= 70 && status.percentage < 90
  const isAtLimit = status.percentage >= 90

  return (
    <Alert 
      variant={isAtLimit ? 'destructive' : 'default'}
      className={isNearLimit ? 'border-amber-500 bg-amber-50' : ''}
    >
      {isAtLimit ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle>
        {isAtLimit ? 'Rate Limit Nearly Reached' : 'High API Usage'}
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-2">
          <div className="flex justify-between text-sm">
            <span>
              {status.current} of {status.limit} requests used
            </span>
            <span className="font-medium">{status.remaining} remaining</span>
          </div>
          <Progress value={status.percentage} className="h-2" />
          {isAtLimit && (
            <p className="text-sm mt-2">
              You're nearing your rate limit. Please wait a moment before making more requests.
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Compact version for displaying in headers or sidebars
interface RateLimitBadgeProps {
  category: RateLimitCategory
}

export function RateLimitBadge({ category }: RateLimitBadgeProps) {
  const status = useRateLimitStatus(category)

  if (!status || status.percentage < 70) return null

  const color = status.percentage >= 90 ? 'text-red-600' : 'text-amber-600'

  return (
    <div className={`text-xs font-medium ${color} flex items-center gap-1`}>
      <AlertTriangle className="h-3 w-3" />
      <span>{status.remaining}/{status.limit}</span>
    </div>
  )
}
