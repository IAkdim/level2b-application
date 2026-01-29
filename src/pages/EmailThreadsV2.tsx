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
  enrichThreadsWithLeadAssociations,
  type EmailThread,
  type MessageOpenStats,
} from "@/lib/utils/emailThreads";
import { emailService, type Email, getLeadAssociationsByThreadIds, getTrackedThreadIds, getAllCampaignNames } from "@/lib/api/email";
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
  const [rawSentEmails, setRawSentEmails] = useState<Email[]>([]);
  const [rawReplies, setRawReplies] = useState<Email[]>([]);
  const [openTrackingStats, setOpenTrackingStats] = useState<MessageOpenStats[]>([]);
  const [leadAssociations, setLeadAssociations] = useState<Map<string, string[]>>(new Map());
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);

  // Filter state (replacing label selection)
  const [dateRange, setDateRange] = useState<string>("30d"); // 7d, 30d, 90d, all
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedLeadFilter, setSelectedLeadFilter] = useState<string | null>(null);

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

  // Derived: unified threads (with enrichments)
  const threads = useMemo(() => {
    let result = groupEmailsIntoThreads(rawSentEmails, rawReplies, user?.email);

    // Enrich with open tracking data if available
    if (openTrackingStats.length > 0) {
      result = enrichThreadsWithOpenTracking(result, openTrackingStats);
    }

    // Enrich with lead associations if available
    if (leadAssociations.size > 0) {
      result = enrichThreadsWithLeadAssociations(result, leadAssociations);
    }

    return result;
  }, [rawSentEmails, rawReplies, user?.email, openTrackingStats, leadAssociations]);

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

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, []);

  // Load emails when filters change
  useEffect(() => {
    loadEmails();
  }, [dateRange, selectedCampaign, selectedLeadFilter]);

  /**
   * Load available campaigns for filter
   */
  const loadCampaigns = async () => {
    try {
      const campaigns = await getAllCampaignNames();
      setAvailableCampaigns(campaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  /**
   * Load emails from database (label-free approach)
   * Uses email_tracking_metadata to get thread IDs, then fetches details on-demand
   */
  const loadEmails = async () => {
    setIsLoading(true);
    try {
      // Calculate date range filter
      let startDate: Date | undefined;
      const now = new Date();

      switch (dateRange) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "all":
          startDate = undefined;
          break;
      }

      // Get tracked thread IDs from database
      console.log('Fetching tracked thread IDs from database...');
      const threadIds = await getTrackedThreadIds({
        provider: 'gmail',
        startDate,
        campaignName: selectedCampaign || undefined,
        leadId: selectedLeadFilter || undefined,
        limit: 200, // Reasonable limit for performance
      });

      console.log(`Found ${threadIds.length} tracked threads`);

      if (threadIds.length === 0) {
        setRawSentEmails([]);
        setRawReplies([]);
        setLastRefresh(new Date());
        return;
      }

      // Fetch thread details in batch from Gmail
      console.log('Fetching thread details from Gmail...');
      const threadsMap = await emailService.getEmailThreadsBatch(threadIds);

      // Separate sent emails and replies
      const allEmails: Email[] = [];
      threadsMap.forEach((emails) => {
        allEmails.push(...emails);
      });

      // Split by outgoing vs incoming
      const sent: Email[] = [];
      const replies: Email[] = [];

      for (const email of allEmails) {
        // Check if email is from the user (outgoing)
        if (user?.email && email.from.toLowerCase().includes(user.email.toLowerCase())) {
          sent.push(email);
        } else {
          replies.push(email);
        }
      }

      console.log(`Loaded ${sent.length} sent emails, ${replies.length} replies`);

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

      // Fetch lead associations for all threads
      const allThreadIds = [...new Set([...sent, ...replies].map(e => e.threadId))];
      if (allThreadIds.length > 0) {
        try {
          const associations = await getLeadAssociationsByThreadIds(allThreadIds);
          setLeadAssociations(associations);
        } catch (leadError) {
          // Lead associations are optional - don't fail the whole load
          console.warn('Could not fetch lead associations:', leadError);
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
      await emailService.sendEmail({
        to,
        subject,
        body,
        // Replies don't need campaign tracking - they're linked via thread
      });
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
            {/* Campaign filter */}
            {availableCampaigns.length > 0 && (
              <Select
                value={selectedCampaign || "all"}
                onValueChange={(v) => setSelectedCampaign(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-[180px]">
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
              <SelectTrigger className="w-[150px]">
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
        ) : filteredThreads.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">
              {debouncedSearch || filterLabel ? "No matching conversations" : "No tracked emails found"}
            </p>
            <p className="text-sm text-muted-foreground">
              {debouncedSearch || filterLabel
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
