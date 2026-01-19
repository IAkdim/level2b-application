import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/formatters";
import type { EmailThread } from "@/lib/utils/emailThreads";

interface EmailThreadRowProps {
  thread: EmailThread;
  isSelected?: boolean;
  onClick: (thread: EmailThread) => void;
}

/**
 * Single row in the email thread list
 * Displays: unread dot, contact info, subject, preview, timestamp, tags
 */
export function EmailThreadRow({
  thread,
  isSelected = false,
  onClick,
}: EmailThreadRowProps) {
  const isAwaitingReply = !thread.hasReply;
  const isUnread = thread.hasUnreadReply;

  // Determine sentiment indicator
  const getSentimentIndicator = () => {
    if (!thread.sentiment?.sentiment) return null;
    const sentiment = thread.sentiment.sentiment;
    if (sentiment === "positive") return "🟢";
    if (sentiment === "neutral") return "🟡";
    return "🔴";
  };

  const sentimentIndicator = getSentimentIndicator();

  return (
    <div
      onClick={() => onClick(thread)}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50 last:border-b-0",
        "hover:bg-muted/50",
        isSelected && "bg-muted",
        isAwaitingReply && "opacity-60"
      )}
    >
      {/* Unread indicator */}
      <div className="flex-shrink-0 w-2 pt-2">
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-blue-500" aria-label="Unread" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Top row: Name, Company, Sentiment, Timestamp, Tags */}
        <div className="flex items-center gap-2">
          {/* Contact info */}
          <span
            className={cn(
              "text-sm truncate",
              isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}
          >
            {thread.contactName}
          </span>

          {thread.company && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                {thread.company}
              </span>
            </>
          )}

          {/* Sentiment indicator */}
          {sentimentIndicator && (
            <span className="text-xs" title={`Sentiment: ${thread.sentiment?.sentiment}`}>
              {sentimentIndicator}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatRelativeTime(thread.lastMessageDate.toISOString())}
          </span>

          {/* Tags (max 2 visible) */}
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            {thread.labels.slice(0, 2).map((label) => (
              <Badge
                key={label}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-normal"
              >
                {label}
              </Badge>
            ))}
            {thread.labels.length > 2 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 font-normal"
              >
                +{thread.labels.length - 2}
              </Badge>
            )}
          </div>
        </div>

        {/* Subject line */}
        <p
          className={cn(
            "text-sm truncate",
            isUnread ? "font-medium text-foreground" : "text-foreground/90"
          )}
        >
          {thread.subject}
        </p>

        {/* Preview text */}
        <p className="text-sm text-muted-foreground line-clamp-1">
          {isAwaitingReply ? (
            <span className="italic">(awaiting reply)</span>
          ) : (
            thread.lastMessagePreview
          )}
        </p>
      </div>

      {/* Reply count indicator */}
      {thread.replyCount > 0 && (
        <div className="hidden sm:flex flex-shrink-0 items-center text-xs text-muted-foreground">
          <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
            {thread.messages.length}
          </span>
        </div>
      )}
    </div>
  );
}
