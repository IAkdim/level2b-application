/**
 * Custom hook for email threads data management
 * Separates data fetching and state from UI components
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { emailService, type Email, getLeadAssociationsByThreadIds, getTrackedThreadIds, getAllCampaignNames } from "@/lib/api/email";
import { getEmailOpenStatsBulk } from "@/lib/api/emailTracking";
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
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
// Lead type imported for reference but loaded dynamically

// Sort options for threads
export type ThreadSortOption =
  | "newest"
  | "oldest"
  | "unread"
  | "awaiting"
  | "positive"
  | "negative";

export interface UseEmailThreadsOptions {
  initialDateRange?: string;
  initialSortBy?: ThreadSortOption;
}

export interface UseEmailThreadsReturn {
  // Data
  threads: EmailThread[];
  filteredThreads: EmailThread[];
  stats: ReturnType<typeof getThreadStats>;
  threadLabels: string[];
  availableCampaigns: string[];
  availableLeads: Array<{ id: string; name: string; email: string }>;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  lastRefresh: Date | null;

  // Filters
  dateRange: string;
  setDateRange: (range: string) => void;
  selectedCampaign: string | null;
  setSelectedCampaign: (campaign: string | null) => void;
  selectedLeadId: string | null;
  setSelectedLeadId: (leadId: string | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterLabel: string | null;
  setFilterLabel: (label: string | null) => void;
  sortBy: ThreadSortOption;
  setSortBy: (sort: ThreadSortOption) => void;

  // Actions
  refresh: () => Promise<void>;
  updateThreadSentiment: (threadId: string, sentiment: EmailThread['sentiment']) => void;
}

export function useEmailThreads(options: UseEmailThreadsOptions = {}): UseEmailThreadsReturn {
  const { user } = useAuth();
  const { initialDateRange = "30d", initialSortBy = "newest" } = options;

  // Raw data state
  const [rawSentEmails, setRawSentEmails] = useState<Email[]>([]);
  const [rawReplies, setRawReplies] = useState<Email[]>([]);
  const [openTrackingStats, setOpenTrackingStats] = useState<MessageOpenStats[]>([]);
  const [leadAssociations, setLeadAssociations] = useState<Map<string, string[]>>(new Map());
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);
  const [availableLeads, setAvailableLeads] = useState<Array<{ id: string; name: string; email: string }>>([]);

  // Filter state
  const [dateRange, setDateRange] = useState<string>(initialDateRange);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ThreadSortOption>(initialSortBy);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load campaigns and leads on mount
  useEffect(() => {
    loadCampaigns();
    loadLeads();
  }, []);

  // Load emails when filters change
  useEffect(() => {
    loadEmails();
  }, [dateRange, selectedCampaign, selectedLeadId]);

  const loadCampaigns = async () => {
    try {
      const campaigns = await getAllCampaignNames();
      setAvailableCampaigns(campaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  };

  const loadLeads = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email')
        .eq('user_id', currentUser.id)
        .order('name');

      if (error) {
        console.error('Error loading leads:', error);
        return;
      }

      setAvailableLeads(data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

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
      const threadIds = await getTrackedThreadIds({
        provider: 'gmail',
        startDate,
        campaignName: selectedCampaign || undefined,
        leadId: selectedLeadId || undefined,
        limit: 200,
      });

      if (threadIds.length === 0) {
        setRawSentEmails([]);
        setRawReplies([]);
        setLastRefresh(new Date());
        return;
      }

      // Fetch thread details in batch from Gmail
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
        if (user?.email && email.from.toLowerCase().includes(user.email.toLowerCase())) {
          sent.push(email);
        } else {
          replies.push(email);
        }
      }

      setRawSentEmails(sent);
      setRawReplies(replies);
      setLastRefresh(new Date());

      // Fetch open tracking stats
      const sentMessageIds = sent.map(e => e.id);
      if (sentMessageIds.length > 0) {
        try {
          const openStats = await getEmailOpenStatsBulk(sentMessageIds);
          const statsFormatted: MessageOpenStats[] = openStats.map(stat => ({
            messageId: stat.gmailMessageId,
            hasTracking: stat.hasTracking,
            isOpened: stat.isOpened,
            firstOpenedAt: stat.firstOpenedAt,
            openCount: stat.openCount,
          }));
          setOpenTrackingStats(statsFormatted);
        } catch (trackingError) {
          console.warn('Could not fetch open tracking stats:', trackingError);
        }
      }

      // Fetch lead associations
      const allThreadIds = [...new Set([...sent, ...replies].map(e => e.threadId))];
      if (allThreadIds.length > 0) {
        try {
          const associations = await getLeadAssociationsByThreadIds(allThreadIds);
          setLeadAssociations(associations);
        } catch (leadError) {
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

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadEmails();
    setIsRefreshing(false);
  }, [dateRange, selectedCampaign, selectedLeadId]);

  const updateThreadSentiment = useCallback((threadId: string, sentiment: EmailThread['sentiment']) => {
    setRawReplies((prev) =>
      prev.map((r) =>
        r.threadId === threadId ? { ...r, sentiment } : r
      )
    );
  }, []);

  // Derived: unified threads (with enrichments)
  const threads = useMemo(() => {
    let result = groupEmailsIntoThreads(rawSentEmails, rawReplies, user?.email);

    if (openTrackingStats.length > 0) {
      result = enrichThreadsWithOpenTracking(result, openTrackingStats);
    }

    if (leadAssociations.size > 0) {
      result = enrichThreadsWithLeadAssociations(result, leadAssociations);
    }

    return result;
  }, [rawSentEmails, rawReplies, user?.email, openTrackingStats, leadAssociations]);

  // Derived: sorted threads
  const sortedThreads = useMemo(() => {
    const sorted = [...threads];

    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.lastMessageDate).getTime() - new Date(b.lastMessageDate).getTime());
        break;
      case "unread":
        sorted.sort((a, b) => {
          if (a.hasUnreadReply && !b.hasUnreadReply) return -1;
          if (!a.hasUnreadReply && b.hasUnreadReply) return 1;
          return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        });
        break;
      case "awaiting":
        sorted.sort((a, b) => {
          const aAwaiting = a.replyCount === 0 && a.sentCount > 0;
          const bAwaiting = b.replyCount === 0 && b.sentCount > 0;
          if (aAwaiting && !bAwaiting) return -1;
          if (!aAwaiting && bAwaiting) return 1;
          return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        });
        break;
      case "positive":
        sorted.sort((a, b) => {
          const sentimentOrder = { positive: 0, neutral: 1, doubtful: 2, not_interested: 3 };
          const aOrder = a.sentiment?.sentiment ? sentimentOrder[a.sentiment.sentiment as keyof typeof sentimentOrder] ?? 4 : 4;
          const bOrder = b.sentiment?.sentiment ? sentimentOrder[b.sentiment.sentiment as keyof typeof sentimentOrder] ?? 4 : 4;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        });
        break;
      case "negative":
        sorted.sort((a, b) => {
          const sentimentOrder = { not_interested: 0, doubtful: 1, neutral: 2, positive: 3 };
          const aOrder = a.sentiment?.sentiment ? sentimentOrder[a.sentiment.sentiment as keyof typeof sentimentOrder] ?? 4 : 4;
          const bOrder = b.sentiment?.sentiment ? sentimentOrder[b.sentiment.sentiment as keyof typeof sentimentOrder] ?? 4 : 4;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
        });
        break;
    }

    return sorted;
  }, [threads, sortBy]);

  // Derived: filtered threads
  const filteredThreads = useMemo(() => {
    let result = sortedThreads;

    if (filterLabel) {
      result = filterThreadsByLabel(result, filterLabel);
    }

    if (debouncedSearch) {
      result = searchThreads(result, debouncedSearch);
    }

    return result;
  }, [sortedThreads, filterLabel, debouncedSearch]);

  // Derived: available filter labels
  const threadLabels = useMemo(() => getAllLabels(threads), [threads]);

  // Derived: stats
  const stats = useMemo(() => getThreadStats(filteredThreads), [filteredThreads]);

  return {
    // Data
    threads,
    filteredThreads,
    stats,
    threadLabels,
    availableCampaigns,
    availableLeads,

    // Loading states
    isLoading,
    isRefreshing,
    lastRefresh,

    // Filters
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

    // Actions
    refresh,
    updateThreadSentiment,
  };
}
