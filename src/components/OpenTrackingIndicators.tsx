import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { AlertCircle, Eye, EyeOff, Info, ShieldAlert } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

// ============================================================================
// OPEN STATUS BADGE - For individual emails
// ============================================================================

interface OpenStatusBadgeProps {
  isOpened?: boolean;
  hasTracking?: boolean;
  firstOpenedAt?: Date | string | null;
  openCount?: number;
  className?: string;
  showLabel?: boolean;
}

/**
 * Badge showing open status for an individual email
 * States:
 * - No tracking (plain text email)
 * - Not opened
 * - Opened (with optional timestamp and count)
 */
export function OpenStatusBadge({
  isOpened,
  hasTracking,
  firstOpenedAt,
  openCount = 0,
  className,
  showLabel = true,
}: OpenStatusBadgeProps) {
  if (!hasTracking) {
    return showLabel ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn("text-xs text-muted-foreground/50", className)}
            >
              <span className="mr-1">—</span>
              No tracking
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open tracking is not available for plain text emails</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;
  }

  if (isOpened) {
    const openedDate = firstOpenedAt 
      ? (typeof firstOpenedAt === 'string' ? new Date(firstOpenedAt) : firstOpenedAt)
      : null;
    
    const tooltipContent = openedDate
      ? `Opened ${formatRelativeTime(openedDate.toISOString())}${openCount > 1 ? ` (${openCount} times)` : ''}`
      : 'Email was opened';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="default" 
              className={cn(
                "text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100",
                className
              )}
            >
              <Eye className="h-3 w-3 mr-1" />
              {showLabel && "Opened"}
              {openCount > 1 && <span className="ml-1 opacity-70">×{openCount}</span>}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipContent}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn("text-xs text-muted-foreground", className)}
          >
            <EyeOff className="h-3 w-3 mr-1" />
            {showLabel && "Not opened"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This email hasn't been opened yet (or images were blocked)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// OPEN RATE DISPLAY - For analytics
// ============================================================================

interface OpenRateDisplayProps {
  openRate: number;
  totalSent: number;
  uniqueOpens: number;
  totalWithTracking?: number;
  appleMppOpens?: number;
  className?: string;
  showDetails?: boolean;
}

/**
 * Display open rate with context about tracking limitations
 */
export function OpenRateDisplay({
  openRate,
  totalSent,
  uniqueOpens,
  totalWithTracking,
  appleMppOpens = 0,
  className,
  showDetails = false,
}: OpenRateDisplayProps) {
  const hasAppleMpp = appleMppOpens > 0;
  const trackingCoverage = totalWithTracking && totalSent > 0
    ? Math.round((totalWithTracking / totalSent) * 100)
    : 100;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{openRate}%</span>
        {hasAppleMpp && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  <ShieldAlert className="h-3 w-3 mr-1" />
                  MPP
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  {appleMppOpens} opens may be from Apple Mail Privacy Protection,
                  which can inflate open rates.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>{uniqueOpens} of {totalWithTracking || totalSent} tracked emails opened</p>
          {trackingCoverage < 100 && (
            <p className="text-amber-600 dark:text-amber-500">
              {trackingCoverage}% of emails have tracking enabled
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRACKING LIMITATIONS ALERT
// ============================================================================

interface TrackingLimitationsAlertProps {
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Alert explaining the limitations of email open tracking
 */
export function TrackingLimitationsAlert({
  variant = 'compact',
  className,
}: TrackingLimitationsAlertProps) {
  if (variant === 'compact') {
    return (
      <div className={cn(
        "flex items-start gap-2 p-3 rounded-md bg-muted/50 text-sm",
        className
      )}>
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          Open tracking uses image pixels. Some email clients block images or 
          preload them (Apple Mail), affecting accuracy.{' '}
          <span className="font-medium">Reply rates are more reliable</span> 
          for measuring engagement.
        </p>
      </div>
    );
  }

  return (
    <Alert className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>About Email Open Tracking</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Open tracking uses a small invisible image to detect when emails are viewed. 
          This method has limitations:
        </p>
        <ul className="list-disc ml-4 space-y-1 text-sm">
          <li>
            <strong>Image blocking:</strong> ~40% of email clients block images by default,
            causing opens to go untracked
          </li>
          <li>
            <strong>Apple Mail Privacy Protection:</strong> iOS 15+ and macOS Monterey+ 
            preload images, potentially showing false opens
          </li>
          <li>
            <strong>Corporate firewalls:</strong> Some security systems strip tracking pixels
          </li>
          <li>
            <strong>Gmail caching:</strong> Google proxies images, which may affect 
            multiple-open detection
          </li>
        </ul>
        <p className="text-sm font-medium mt-2">
          💡 Reply rates are generally a more reliable engagement metric than open rates.
        </p>
      </AlertDescription>
    </Alert>
  );
}

// ============================================================================
// CAMPAIGN OPEN RATE ROW
// ============================================================================

interface CampaignOpenRateRowProps {
  campaign: string;
  totalSent: number;
  uniqueOpens: number;
  openRate: number;
}

/**
 * Row showing open rate for a single campaign
 */
export function CampaignOpenRateRow({
  campaign,
  totalSent,
  uniqueOpens,
  openRate,
}: CampaignOpenRateRowProps) {
  // Color based on performance
  const getOpenRateColor = () => {
    if (openRate >= 40) return 'text-green-600 dark:text-green-500';
    if (openRate >= 20) return 'text-amber-600 dark:text-amber-500';
    return 'text-red-600 dark:text-red-500';
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{campaign}</p>
        <p className="text-xs text-muted-foreground">
          {uniqueOpens} of {totalSent} opened
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-24 bg-muted rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all",
              openRate >= 40 ? 'bg-green-500' :
              openRate >= 20 ? 'bg-amber-500' :
              'bg-red-500'
            )}
            style={{ width: `${Math.min(openRate, 100)}%` }}
          />
        </div>
        <span className={cn("text-sm font-medium w-12 text-right", getOpenRateColor())}>
          {openRate}%
        </span>
      </div>
    </div>
  );
}
