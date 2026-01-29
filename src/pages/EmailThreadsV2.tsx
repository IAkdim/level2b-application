import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  RefreshCw,
  Inbox,
  MessageSquare,
  Clock,
  Filter,
  ArrowUpDown,
  User,
  Briefcase,
} from "lucide-react";
import { EmailThreadRow } from "@/components/EmailThreadRow";
import { ThreadDetailPanel } from "@/components/ThreadDetailPanel";
import { useEmailThreads, type ThreadSortOption } from "@/hooks/useEmailThreads";
import type { EmailThread } from "@/lib/utils/emailThreads";
import {
  generateSalesReply,
  type EmailReplyContext,
} from "@/lib/api/claude-secure";
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/crm";
import { analyzeSentiment } from "@/lib/api/claude-secure";
import { emailService } from "@/lib/api/email";

// Sort option labels
const SORT_OPTIONS: { value: ThreadSortOption; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "unread", label: "Unread first" },
  { value: "awaiting", label: "Awaiting reply" },
  { value: "positive", label: "Positive sentiment" },
  { value: "negative", label: "Needs attention" },
];

export function EmailThreads() {
  // Use the custom hook for data management
  const {
    filteredThreads,
    stats,
    threadLabels,
    availableCampaigns,
    availableLeads,
    isLoading,
    isRefreshing,
    lastRefresh,
    dateRange,
    setDateRange,
    selectedCampaign,
    setSelectedCampaign,
    selectedLeadId,
    setSelectedLeadId,
    searchTerm,
    setSearchTerm,
    filterLabel,
    setFilterLabel,
    sortBy,
    setSortBy,
    refresh,
    updateThreadSentiment,
  } = useEmailThreads();

  // UI state (not part of hook - UI-specific)
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const handleThreadClick = async (thread: EmailThread) => {
    setSelectedThread(thread);
    setIsDetailOpen(true);

    // If thread doesn't have sentiment, analyze the last incoming message
    if (!thread.sentiment) {
      const lastIncoming = [...thread.messages].reverse().find((m) => !m.isOutgoing);

      if (lastIncoming && (lastIncoming.body || lastIncoming.snippet)) {
        setIsAnalyzingSentiment(true);
        try {
          const sentiment = await analyzeSentiment(
            lastIncoming.body || lastIncoming.snippet,
            lastIncoming.subject
          );

          if (!sentiment.error) {
            const updatedThread: EmailThread = {
              ...thread,
              sentiment: sentiment,
            };
            setSelectedThread(updatedThread);
            updateThreadSentiment(thread.id, sentiment);
          } else {
            toast.error('Failed to analyze sentiment', {
              description: sentiment.error,
            });
          }
        } catch (error) {
          console.error('Error analyzing sentiment:', error);
          toast.error('Failed to analyze email sentiment');
        } finally {
          setIsAnalyzingSentiment(false);
        }
      }
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
  };

  const handleSendReply = async (to: string, subject: string, body: string) => {
    if (!body.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingReply(true);
    try {
      await emailService.sendEmail({ to, subject, body });
      toast.success(`Reply sent to ${to}`);
      setIsDetailOpen(false);
      await refresh();
    } catch (error) {
      console.error("Error sending reply:", error);

      if (isAuthenticationError(error)) {
        toast.error("Gmail re-authentication required", {
          action: {
            label: "Re-connect",
            onClick: reAuthenticateWithGoogle,
          },
        });
      } else {
        toast.error("Failed to send reply");
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleGenerateAIReply = async (
    thread: EmailThread,
    language: Language
  ): Promise<{ subject: string; body: string } | null> => {
    setIsGeneratingReply(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return null;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();

      const userName = profile?.full_name || profile?.email?.split("@")[0] || "there";

      // Get user settings
      let companyName: string | undefined;
      let productService: string | undefined;
      let calendlyLink: string | undefined;

      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("company_name, product_service, calendly_scheduling_url")
        .eq("user_id", session.user.id)
        .single();

      if (userSettings) {
        companyName = userSettings.company_name;
        productService = userSettings.product_service;
        calendlyLink = userSettings.calendly_scheduling_url;
      }

      // Check for Calendly link on positive sentiment
      if (thread.sentiment?.sentiment === "positive" && !calendlyLink) {
        toast.error("Calendly link not configured for positive replies");
        return null;
      }

      // Get the last incoming message for context
      const lastIncoming = [...thread.messages]
        .reverse()
        .find((m) => !m.isOutgoing);

      if (!lastIncoming) {
        toast.error("No incoming message to reply to");
        return null;
      }

      const context: EmailReplyContext = {
        recipientName: thread.contactName,
        recipientEmail: thread.contactEmail,
        originalSubject: lastIncoming.subject,
        originalBody: lastIncoming.body || lastIncoming.snippet,
        sentiment: thread.sentiment?.sentiment || "neutral",
        userName,
        companyName,
        productService,
        calendlyLink,
        language,
      };

      const result = await generateSalesReply(context);

      if (result.error) {
        toast.error(`Error: ${result.error}`);
        return null;
      }

      toast.success(`AI reply generated (${result.tone})`);
      return { subject: result.subject, body: result.body };
    } catch (error) {
      console.error("Error generating AI reply:", error);
      toast.error("Failed to generate AI reply");
      return null;
    } finally {
      setIsGeneratingReply(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header bar */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
            {lastRefresh && (
              <p className="text-xs text-muted-foreground">
                Updated {formatRelativeTime(lastRefresh.toISOString())}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Lead filter */}
            {availableLeads.length > 0 && (
              <Select
                value={selectedLeadId || "all"}
                onValueChange={(v) => setSelectedLeadId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[180px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All leads" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leads</SelectItem>
                  {availableLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <span className="truncate">{lead.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Campaign filter */}
            {availableCampaigns.length > 0 && (
              <Select
                value={selectedCampaign || "all"}
                onValueChange={(v) => setSelectedCampaign(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[160px]">
                  <Briefcase className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campaigns</SelectItem>
                  {availableCampaigns.map((campaign) => (
                    <SelectItem key={campaign} value={campaign}>
                      {campaign}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date range filter */}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Search, sort, and filter bar */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search conversations..."
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as ThreadSortOption)}>
            <SelectTrigger className="w-[160px] h-9">
              <ArrowUpDown className="h-3 w-3 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tag filter */}
          {threadLabels.length > 0 && (
            <Select
              value={filterLabel || "all"}
              onValueChange={(v) => setFilterLabel(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {threadLabels.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-4 ml-auto text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Inbox className="h-3 w-3" />
              {stats.total} threads
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {stats.withReplies} replied
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {stats.awaitingReply} pending
            </span>
            {stats.unread > 0 && (
              <Badge variant="default" className="text-xs">
                {stats.unread} unread
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          // Loading skeleton
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredThreads.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">
              {searchTerm || filterLabel || selectedLeadId || selectedCampaign
                ? "No matching conversations"
                : "No tracked emails found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {searchTerm || filterLabel || selectedLeadId || selectedCampaign
                ? "Try adjusting your filters or date range"
                : "Send emails via the app to see them tracked here"}
            </p>
          </div>
        ) : (
          // Thread list
          <div>
            {filteredThreads.map((thread) => (
              <EmailThreadRow
                key={thread.id}
                thread={thread}
                isSelected={selectedThread?.id === thread.id}
                onClick={handleThreadClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Thread detail panel */}
      <ThreadDetailPanel
        thread={selectedThread}
        isOpen={isDetailOpen}
        onClose={handleCloseDetail}
        onSendReply={handleSendReply}
        onGenerateAIReply={handleGenerateAIReply}
        isSending={isSendingReply}
        isGenerating={isGeneratingReply}
        isAnalyzingSentiment={isAnalyzingSentiment}
      />
    </div>
  );
}
