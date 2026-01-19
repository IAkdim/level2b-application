import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Sparkles, Loader2, Clock, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailThread, EmailThreadMessage } from "@/lib/utils/emailThreads";
import type { Language } from "@/types/crm";

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
}: ThreadDetailPanelProps) {
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyLanguage, setReplyLanguage] = useState<Language>("en");
  const [showFullMessage, setShowFullMessage] = useState<string | null>(null);

  const handleGenerateReply = async () => {
    if (!thread) return;
    const result = await onGenerateAIReply(thread, replyLanguage);
    if (result) {
      setReplySubject(result.subject);
      setReplyBody(result.body);
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
              disabled={isGenerating || !thread.sentiment}
              className="text-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating...
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
  const maxPreviewLength = 300;
  const needsTruncation = message.body.length > maxPreviewLength;
  const displayBody = isExpanded
    ? message.body
    : needsTruncation
    ? message.body.substring(0, maxPreviewLength) + "..."
    : message.body;

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

      {/* Timestamp */}
      <span className="text-[10px] text-muted-foreground mt-1 px-1 flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        {message.date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
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
