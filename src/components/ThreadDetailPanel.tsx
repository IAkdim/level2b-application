import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Sparkles, Loader2, Clock, Mail, MessageSquare, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailThread, EmailThreadMessage } from "@/lib/utils/emailThreads";
import type { Language } from "@/types/crm";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/utils/formatters";

interface ThreadDetailPanelProps {
  thread: EmailThread | null;
  isOpen: boolean;
  onClose: () => void;
  onSendReply: (to: string, subject: string, body: string) => Promise<void>;
  onGenerateAIReply: (
    thread: EmailThread,
    language: Language
  ) => Promise<{ subject: string; body: string } | null>;
  isSending?: boolean;
  isGenerating?: boolean;
  isAnalyzingSentiment?: boolean;
}

/**
 * Chat-style thread detail panel
 * Shows conversation as message bubbles with reply composer
 */
export function ThreadDetailPanel({
  thread,
  isOpen,
  onClose,
  onSendReply,
  onGenerateAIReply,
  isSending = false,
  isGenerating = false,
  isAnalyzingSentiment = false,
}: ThreadDetailPanelProps) {
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyLanguage, setReplyLanguage] = useState<Language>("en");
  const [showFullMessage, setShowFullMessage] = useState<string | null>(null);

  const handleGenerateReply = async () => {
    console.log('[ThreadDetailPanel] handleGenerateReply called', {
      hasThread: !!thread,
      isAnalyzingSentiment,
      hasSentiment: !!thread?.sentiment,
      replyLanguage,
    });

    if (!thread) {
      console.log('[ThreadDetailPanel] No thread, returning early');
      return;
    }
    
    // Check if sentiment analysis is missing or in progress
    if (isAnalyzingSentiment) {
      console.log('[ThreadDetailPanel] Sentiment analysis in progress, showing toast');
      toast.info("Please wait", {
        description: "Sentiment analysis is in progress...",
      });
      return;
    }
    
    if (!thread.sentiment) {
      console.log('[ThreadDetailPanel] No sentiment on thread, showing error toast');
      toast.error("Sentiment analysis required", {
        description: "Please wait for the email to be analyzed before generating a reply.",
      });
      return;
    }
    
    console.log('[ThreadDetailPanel] Calling onGenerateAIReply with sentiment:', thread.sentiment.sentiment);
    try {
      const result = await onGenerateAIReply(thread, replyLanguage);
      console.log('[ThreadDetailPanel] onGenerateAIReply result:', result);
      if (result) {
        setReplySubject(result.subject);
        setReplyBody(result.body);
      }
      // Don't show duplicate error - parent component handles its own toasts
    } catch (error) {
      console.error('[ThreadDetailPanel] Error in onGenerateAIReply:', error);
      toast.error("Failed to generate reply", {
        description: "An unexpected error occurred. Please try again.",
      });
    }
  };

  const handleSend = async () => {
    if (!thread || !replyBody.trim()) return;
    await onSendReply(thread.contactEmail, replySubject, replyBody);
    setReplyBody("");
  };

  // Group messages by date for visual separation
  const groupMessagesByDate = (messages: EmailThreadMessage[]) => {
    const groups: { date: string; messages: EmailThreadMessage[] }[] = [];
    let currentDate = "";

    for (const message of messages) {
      const messageDate = message.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [] });
      }

      groups[groups.length - 1].messages.push(message);
    }

    return groups;
  };

  if (!thread) return null;

  const messageGroups = groupMessagesByDate(thread.messages);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-semibold truncate">
                {thread.contactName}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Email conversation with {thread.contactName}
              </SheetDescription>
              <p className="text-xs text-muted-foreground truncate">
                {thread.contactEmail}
                {thread.company && ` · ${thread.company}`}
              </p>
            </div>

            {/* Thread stats */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {thread.sentCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {thread.replyCount}
              </span>
            </div>

            {/* Sentiment badge */}
            {thread.sentiment && (
              <Badge
                variant={
                  thread.sentiment.sentiment === "positive"
                    ? "default"
                    : thread.sentiment.sentiment === "neutral"
                    ? "secondary"
                    : "destructive"
                }
                className="text-xs"
              >
                {thread.sentiment.sentiment === "positive"
                  ? "🟢 Positive"
                  : thread.sentiment.sentiment === "neutral"
                  ? "🟡 Neutral"
                  : "🔴 Negative"}
              </Badge>
            )}
          </div>

          {/* Subject */}
          <p className="text-sm text-muted-foreground pl-11 truncate">
            {thread.subject}
          </p>

          {/* Labels */}
          {thread.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 pl-11 pt-1">
              {thread.labels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-6">
            {messageGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-4">
                {/* Date separator */}
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground bg-background px-2">
                    {group.date}
                  </span>
                  <Separator className="flex-1" />
                </div>

                {/* Messages for this date */}
                {group.messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isExpanded={showFullMessage === message.id}
                    onToggleExpand={() =>
                      setShowFullMessage(
                        showFullMessage === message.id ? null : message.id
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Reply composer */}
        <div className="flex-shrink-0 border-t bg-background p-4 space-y-3">
          {/* AI Generate + Language selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="reply-language" className="text-xs text-muted-foreground">
                Reply in:
              </Label>
              <Select
                value={replyLanguage}
                onValueChange={(v) => setReplyLanguage(v as Language)}
              >
                <SelectTrigger id="reply-language" className="h-8 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 EN</SelectItem>
                  <SelectItem value="nl">🇳🇱 NL</SelectItem>
                  <SelectItem value="de">🇩🇪 DE</SelectItem>
                  <SelectItem value="fr">🇫🇷 FR</SelectItem>
                  <SelectItem value="es">🇪🇸 ES</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateReply}
              disabled={isGenerating || isAnalyzingSentiment}
              className="text-xs"
              title={isAnalyzingSentiment ? "Analyzing email sentiment..." : !thread.sentiment ? "Sentiment required - click to retry" : "Generate AI reply based on email context"}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : isAnalyzingSentiment ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI Reply
                </>
              )}
            </Button>
          </div>

          {/* Subject (collapsed by default) */}
          <Input
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            placeholder="Subject..."
            className="h-8 text-sm"
          />

          {/* Message input */}
          <div className="flex gap-2">
            <Textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[80px] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
            />
          </div>

          {/* Send button */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Ctrl+Enter to send
            </span>
            <Button
              onClick={handleSend}
              disabled={isSending || !replyBody.trim()}
              size="sm"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Single message bubble in the chat view
 */
/**
 * Strips HTML tags and extracts plain text for display
 * Handles tracking pixels and HTML email formatting
 */
function stripHtmlForDisplay(html: string): string {
  // Check if this is HTML content
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) return html;

  // Remove tracking pixel images (1x1 transparent pixels)
  let text = html.replace(/<img[^>]*(?:track|width="1"|height="1"|1px)[^>]*>/gi, '');
  
  // Remove DOCTYPE, html, head, style, script tags and their content
  text = text.replace(/<!DOCTYPE[^>]*>/gi, '');
  text = text.replace(/<head[\s\S]*?<\/head>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
  
  // Convert <br> and </p> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  
  // Clean up multiple newlines and whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
}

function MessageBubble({
  message,
  isExpanded,
  onToggleExpand,
}: {
  message: EmailThreadMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const isOutgoing = message.isOutgoing;
  
  // Convert HTML to plain text for display
  const plainTextBody = stripHtmlForDisplay(message.body);
  
  const maxPreviewLength = 300;
  const needsTruncation = plainTextBody.length > maxPreviewLength;
  const displayBody = isExpanded
    ? plainTextBody
    : needsTruncation
    ? plainTextBody.substring(0, maxPreviewLength) + "..."
    : plainTextBody;

  return (
    <div
      className={cn(
        "flex flex-col max-w-[85%]",
        isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {/* Sender label */}
      <span className="text-xs text-muted-foreground mb-1 px-1">
        {isOutgoing ? "You" : message.from.split("<")[0].trim() || "Contact"}
      </span>

      {/* Bubble */}
      <div
        onClick={onToggleExpand}
        className={cn(
          "rounded-2xl px-4 py-2.5 cursor-pointer transition-colors",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
          "hover:opacity-90"
        )}
      >
        {/* Subject if different from previous */}
        {message.subject && (
          <p
            className={cn(
              "text-xs font-medium mb-1",
              isOutgoing ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {message.subject}
          </p>
        )}

        {/* Body */}
        <div
          className={cn(
            "text-sm whitespace-pre-wrap break-words",
            isOutgoing ? "text-primary-foreground" : "text-foreground"
          )}
        >
          {displayBody}
        </div>

        {/* Show more/less */}
        {needsTruncation && (
          <button
            className={cn(
              "text-xs underline mt-1",
              isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* Timestamp and open status for outgoing messages */}
      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        {message.date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
        {/* Open tracking indicator for outgoing messages */}
        {isOutgoing && (
          <>
            <span className="mx-1">·</span>
            {message.isOpened ? (
              <span 
                className="inline-flex items-center text-green-600 dark:text-green-500" 
                title={message.firstOpenedAt 
                  ? `Opened ${formatRelativeTime(message.firstOpenedAt.toISOString())}${message.openCount && message.openCount > 1 ? ` (${message.openCount}×)` : ''}`
                  : 'Opened'}
              >
                <Eye className="h-2.5 w-2.5 mr-0.5" />
                <span className="text-[10px]">Opened</span>
              </span>
            ) : message.hasTracking ? (
              <span 
                className="inline-flex items-center text-muted-foreground/50" 
                title="Not opened yet"
              >
                <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                <span className="text-[10px]">Not opened</span>
              </span>
            ) : (
              <span 
                className="inline-flex items-center text-muted-foreground/30" 
                title="Tracking enabled"
              >
                <EyeOff className="h-2.5 w-2.5 mr-0.5" />
                <span className="text-[10px]">Sent</span>
              </span>
            )}
          </>
        )}
      </span>

      {/* Sentiment badge for incoming messages */}
      {!isOutgoing && message.sentiment && (
        <Badge
          variant={
            message.sentiment.sentiment === "positive"
              ? "default"
              : message.sentiment.sentiment === "neutral"
              ? "secondary"
              : "destructive"
          }
          className="text-[10px] mt-1"
        >
          {message.sentiment.sentiment}
        </Badge>
      )}
    </div>
  );
}
