import { useState, useEffect, useMemo } from "react";
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
  Mail,
  MessageSquare,
  Clock,
  Filter,
} from "lucide-react";
import { EmailThreadRow } from "@/components/EmailThreadRow";
import { ThreadDetailPanel } from "@/components/ThreadDetailPanel";
import {
  groupEmailsIntoThreads,
  filterThreadsByLabel,
  searchThreads,
  getAllLabels,
  getThreadStats,
  enrichThreadsWithOpenTracking,
  type EmailThread,
  type MessageOpenStats,
} from "@/lib/utils/emailThreads";
import {
  getGmailLabels,
  getRepliesByLabel,
  getEmailsByLabel,
  sendEmail,
  type Email,
} from "@/lib/api/gmail";
import { getEmailOpenStatsBulk } from "@/lib/api/emailTracking";
import {
  generateSalesReply,
  type EmailReplyContext,
} from "@/lib/api/claude-secure";
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import type { Language } from "@/types/crm";
import { analyzeSentiment } from "@/lib/api/claude-secure";

export function EmailThreads() {
  const { user } = useAuth();

  // Data state
  const [availableLabels, setAvailableLabels] = useState<Array<{ id: string; name: string }>>([]);
  const [rawSentEmails, setRawSentEmails] = useState<Email[]>([]);
  const [rawReplies, setRawReplies] = useState<Email[]>([]);
  const [openTrackingStats, setOpenTrackingStats] = useState<MessageOpenStats[]>([]);
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string>("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);

  // Reply state
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  // Derived: unified threads (with open tracking enrichment)
  const threads = useMemo(() => {
    const baseThreads = groupEmailsIntoThreads(rawSentEmails, rawReplies, user?.email);
    // Enrich with open tracking data if available
    if (openTrackingStats.length > 0) {
      return enrichThreadsWithOpenTracking(baseThreads, openTrackingStats);
    }
    return baseThreads;
  }, [rawSentEmails, rawReplies, user?.email, openTrackingStats]);

  // Derived: filtered threads
  const filteredThreads = useMemo(() => {
    let result = threads;
    if (filterLabel) {
      result = filterThreadsByLabel(result, filterLabel);
    }
    if (debouncedSearch) {
      result = searchThreads(result, debouncedSearch);
    }
    return result;
  }, [threads, filterLabel, debouncedSearch]);

  // Derived: available filter labels
  const threadLabels = useMemo(() => getAllLabels(threads), [threads]);

  // Derived: stats
  const stats = useMemo(() => getThreadStats(filteredThreads), [filteredThreads]);

  // Load labels on mount
  useEffect(() => {
    loadLabels();
  }, []);

  // Load emails when source label changes
  useEffect(() => {
    if (selectedSourceLabel) {
      loadEmails();
    }
  }, [selectedSourceLabel]);

  const loadLabels = async () => {
    try {
      const labels = await getGmailLabels();

      // Filter system labels
      const systemLabelPrefixes = [
        "INBOX",
        "SENT",
        "DRAFT",
        "SPAM",
        "TRASH",
        "UNREAD",
        "STARRED",
        "IMPORTANT",
        "CHAT",
        "CATEGORY_",
      ];
      const systemLabelNames = ["Junk", "Notes"];

      const customLabels = labels.filter((l) => {
        const hasSystemPrefix = systemLabelPrefixes.some((prefix) =>
          l.id.startsWith(prefix)
        );
        const isSystemName = systemLabelNames.includes(l.name);
        const isStar = l.id.endsWith("_STAR");
        return !hasSystemPrefix && !isSystemName && !isStar && l.type !== "system";
      });

      setAvailableLabels(customLabels);

      // Auto-select latest label
      if (customLabels.length > 0 && !selectedSourceLabel) {
        setSelectedSourceLabel(customLabels[customLabels.length - 1].name);
      }
    } catch (error) {
      console.error("Error loading labels:", error);
      toast.error("Failed to load Gmail labels");
    }
  };

  const loadEmails = async () => {
    if (!selectedSourceLabel) return;

    setIsLoading(true);
    try {
      let sent: Email[] = [];
      let replies: Email[] = [];
      
      if (selectedSourceLabel === "__ALL__") {
        // Load emails from ALL custom labels
        const allSentPromises = availableLabels.map(label => 
          getEmailsByLabel(label.name, 50).catch(() => [])
        );
        const allRepliesPromises = availableLabels.map(label => 
          getRepliesByLabel(label.name, false, false).catch(() => [])
        );
        
        const sentResults = await Promise.all(allSentPromises);
        const repliesResults = await Promise.all(allRepliesPromises);
        
        // Combine and deduplicate by message ID
        const seenSentIds = new Set<string>();
        const seenReplyIds = new Set<string>();
        
        for (const emails of sentResults) {
          for (const email of emails) {
            if (!seenSentIds.has(email.id)) {
              seenSentIds.add(email.id);
              sent.push(email);
            }
          }
        }
        
        for (const emails of repliesResults) {
          for (const email of emails) {
            if (!seenReplyIds.has(email.id)) {
              seenReplyIds.add(email.id);
              replies.push(email);
            }
          }
        }
      } else {
        // Load emails from specific label
        [sent, replies] = await Promise.all([
          getEmailsByLabel(selectedSourceLabel, 100),
          getRepliesByLabel(selectedSourceLabel, false, false),
        ]);
      }

      setRawSentEmails(sent);
      setRawReplies(replies);
      setLastRefresh(new Date());

      // Fetch open tracking stats for sent emails
      const sentMessageIds = sent.map(e => e.id);
      if (sentMessageIds.length > 0) {
        try {
          const openStats = await getEmailOpenStatsBulk(sentMessageIds);
          // Convert to MessageOpenStats format
          const statsFormatted: MessageOpenStats[] = openStats.map(stat => ({
            messageId: stat.gmailMessageId,
            hasTracking: stat.hasTracking,
            isOpened: stat.isOpened,
            firstOpenedAt: stat.firstOpenedAt,
            openCount: stat.openCount,
          }));
          setOpenTrackingStats(statsFormatted);
        } catch (trackingError) {
          // Tracking data is optional - don't fail the whole load
          console.warn('Could not fetch open tracking stats:', trackingError);
        }
      }
    } catch (error) {
      console.error("Error loading emails:", error);

      if (isAuthenticationError(error)) {
        toast.error("Google Re-authentication Required", {
          description: "Your Gmail connection has expired.",
          duration: 10000,
          action: {
            label: "Re-connect Gmail",
            onClick: async () => {
              try {
                await reAuthenticateWithGoogle();
              } catch (e) {
                toast.error("Re-authentication failed");
              }
            },
          },
        });
      } else {
        toast.error("Error loading emails", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEmails();
    setIsRefreshing(false);
  };

  const handleThreadClick = async (thread: EmailThread) => {
    setSelectedThread(thread);
    setIsDetailOpen(true);

    // Mark as read (update local state)
    if (thread.hasUnreadReply) {
      // In a real app, you'd also call Gmail API to remove UNREAD label
      setRawReplies((prev) =>
        prev.map((r) =>
          r.threadId === thread.id ? { ...r, labelIds: r.labelIds.filter((l) => l !== "UNREAD") } : r
        )
      );
    }

    // If thread doesn't have sentiment, analyze the last incoming message
    if (!thread.sentiment) {
      const lastIncoming = [...thread.messages].reverse().find((m) => !m.isOutgoing);
      
      if (lastIncoming && (lastIncoming.body || lastIncoming.snippet)) {
        setIsAnalyzingSentiment(true);
        try {
          console.log('[EmailThreadsV2] Analyzing sentiment for thread:', thread.id);
          const sentiment = await analyzeSentiment(
            lastIncoming.body || lastIncoming.snippet,
            lastIncoming.subject
          );
          
          if (!sentiment.error) {
            console.log('[EmailThreadsV2] Sentiment analyzed:', sentiment.sentiment);
            // Update the thread with the new sentiment
            const updatedThread: EmailThread = {
              ...thread,
              sentiment: sentiment,
            };
            setSelectedThread(updatedThread);
            
            // Also update the raw replies to persist the sentiment
            setRawReplies((prev) =>
              prev.map((r) =>
                r.id === lastIncoming.id ? { ...r, sentiment } : r
              )
            );
          } else {
            console.error('[EmailThreadsV2] Sentiment analysis error:', sentiment.error);
            toast.error('Failed to analyse sentiment', {
              description: sentiment.error,
            });
          }
        } catch (error) {
          console.error('[EmailThreadsV2] Error analyzing sentiment:', error);
          toast.error('Failed to analyse email sentiment');
        } finally {
          setIsAnalyzingSentiment(false);
        }
      }
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    // Keep selectedThread for animation
  };

  const handleSendReply = async (to: string, subject: string, body: string) => {
    if (!body.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSendingReply(true);
    try {
      await sendEmail(to, subject, body, selectedSourceLabel);
      toast.success(`Reply sent to ${to}`);
      setIsDetailOpen(false);
      await loadEmails(); // Refresh to show sent reply
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
    console.log('[EmailThreadsV2] handleGenerateAIReply called', {
      threadId: thread.id,
      sentiment: thread.sentiment?.sentiment,
      language,
    });
    
    setIsGeneratingReply(true);

    try {
      console.log('[EmailThreadsV2] Starting try block...');
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[EmailThreadsV2] Session result:', session ? 'found' : 'null');
      if (!session) {
        console.log('[EmailThreadsV2] No session!');
        toast.error("Not authenticated");
        return null;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();

      console.log('[EmailThreadsV2] Profile result:', { profile, profileError });
      const userName = profile?.full_name || profile?.email?.split("@")[0] || "there";

      // Get user settings
      let companyName: string | undefined;
      let productService: string | undefined;
      let calendlyLink: string | undefined;

      const { data: userSettings, error: settingsError } = await supabase
        .from("user_settings")
        .select("company_name, product_service, calendly_scheduling_url")
        .eq("user_id", session.user.id)
        .single();

      console.log('[EmailThreadsV2] User settings result:', { userSettings, settingsError, calendlyLink: userSettings?.calendly_scheduling_url });

      if (userSettings) {
        companyName = userSettings.company_name;
        productService = userSettings.product_service;
        calendlyLink = userSettings.calendly_scheduling_url;
      }

      // Check for Calendly link on positive sentiment
      console.log('[EmailThreadsV2] Checking Calendly requirement:', { sentiment: thread.sentiment?.sentiment, hasCalendlyLink: !!calendlyLink });
      if (thread.sentiment?.sentiment === "positive" && !calendlyLink) {
        console.log('[EmailThreadsV2] BLOCKED: Positive sentiment but no Calendly link!');
        toast.error("Calendly link not configured for positive replies");
        return null;
      }

      // Get the last incoming message for context
      const lastIncoming = [...thread.messages]
        .reverse()
        .find((m) => !m.isOutgoing);

      console.log('[EmailThreadsV2] Last incoming message:', lastIncoming ? 'found' : 'NOT FOUND');
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

      console.log('[EmailThreadsV2] Calling generateSalesReply...');
      const result = await generateSalesReply(context);
      console.log('[EmailThreadsV2] generateSalesReply result:', result);

      if (result.error) {
        console.log('[EmailThreadsV2] Error from API:', result.error);
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
            {/* Source label selector */}
            <Select value={selectedSourceLabel} onValueChange={setSelectedSourceLabel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select campaign..." />
              </SelectTrigger>
              <SelectContent>
                {availableLabels.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No labels found
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value="__ALL__">
                      📬 All campaigns
                    </SelectItem>
                    {availableLabels.map((label) => (
                      <SelectItem key={label.id} value={label.name}>
                        {label.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Search and filter bar */}
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

          {/* Tag filter */}
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

          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-4 ml-auto text-xs text-muted-foreground">
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
        ) : !selectedSourceLabel ? (
          // No label selected
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">Select a campaign</p>
            <p className="text-sm text-muted-foreground">
              Choose a Gmail label to view conversations
            </p>
          </div>
        ) : filteredThreads.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">
              {debouncedSearch || filterLabel ? "No matching conversations" : "No conversations yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || filterLabel
                ? "Try adjusting your filters"
                : "Emails with this label will appear here"}
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
