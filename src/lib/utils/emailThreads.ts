import type { Email } from "@/lib/api/gmail";

/**
 * Represents a unified email thread (conversation)
 */
export interface EmailThread {
  id: string; // threadId from Gmail
  // Contact info (from the external party, not the user)
  contactName: string;
  contactEmail: string;
  company: string;
  // Thread state
  hasUnreadReply: boolean;
  hasReply: boolean; // Whether any reply has been received
  lastMessageIsFromUser: boolean;
  // Content
  subject: string;
  lastMessagePreview: string;
  lastMessageDate: Date;
  // All messages in chronological order
  messages: EmailThreadMessage[];
  // Labels/tags
  labels: string[];
  // Sentiment (from the latest incoming message)
  sentiment?: Email["sentiment"];
  // Message counts
  sentCount: number;
  replyCount: number;
  // Open tracking (aggregate for the thread)
  hasTracking?: boolean;
  isOpened?: boolean;
  firstOpenedAt?: Date;
  openCount?: number;
}

export interface EmailThreadMessage {
  id: string;
  isOutgoing: boolean; // true = sent by user, false = received
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  date: Date;
  sentiment?: Email["sentiment"];
  // Open tracking for individual message
  hasTracking?: boolean;
  isOpened?: boolean;
  firstOpenedAt?: Date;
  openCount?: number;
}

/**
 * Groups sent emails and replies into unified threads
 * @param sentEmails - Emails sent by the user
 * @param replies - Replies received from contacts
 * @param userEmail - The current user's email address (optional, for detecting direction)
 */
export function groupEmailsIntoThreads(
  sentEmails: Email[],
  replies: Email[],
  _userEmail?: string
): EmailThread[] {
  const threadMap = new Map<string, EmailThread>();

  // Process all emails (sent and received)
  const allEmails = [
    ...sentEmails.map((e) => ({ ...e, isOutgoing: true })),
    ...replies.map((e) => ({ ...e, isOutgoing: false })),
  ];

  // Sort by date ascending (oldest first) for chronological ordering within threads
  allEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const email of allEmails) {
    const threadId = email.threadId;

    if (!threadMap.has(threadId)) {
      // Initialize new thread
      const contactInfo = email.isOutgoing
        ? extractContactInfo(email.to)
        : extractContactInfo(email.from);

      threadMap.set(threadId, {
        id: threadId,
        contactName: contactInfo.name,
        contactEmail: contactInfo.email,
        company: contactInfo.company,
        hasUnreadReply: false,
        hasReply: false,
        lastMessageIsFromUser: email.isOutgoing,
        subject: cleanSubject(email.subject),
        lastMessagePreview: email.snippet,
        lastMessageDate: email.date,
        messages: [],
        labels: filterUserLabels(email.labelIds),
        sentiment: undefined,
        sentCount: 0,
        replyCount: 0,
      });
    }

    const thread = threadMap.get(threadId)!;

    // Add message to thread
    thread.messages.push({
      id: email.id,
      isOutgoing: email.isOutgoing,
      from: email.from,
      to: email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      date: email.date,
      sentiment: email.sentiment,
    });

    // Update thread metadata (last message wins since we're sorted ascending)
    thread.lastMessagePreview = email.snippet;
    thread.lastMessageDate = email.date;
    thread.lastMessageIsFromUser = email.isOutgoing;

    // Update contact info if this is from the external party
    if (!email.isOutgoing) {
      const contactInfo = extractContactInfo(email.from);
      thread.contactName = contactInfo.name;
      thread.contactEmail = contactInfo.email;
      if (contactInfo.company) {
        thread.company = contactInfo.company;
      }
    }

    // Track reply status
    if (email.isOutgoing) {
      thread.sentCount++;
    } else {
      thread.replyCount++;
      thread.hasReply = true;
      // Latest incoming message sentiment
      if (email.sentiment) {
        thread.sentiment = email.sentiment;
      }
    }

    // Merge labels
    const newLabels = filterUserLabels(email.labelIds);
    for (const label of newLabels) {
      if (!thread.labels.includes(label)) {
        thread.labels.push(label);
      }
    }
  }

  // Convert map to array and sort by last message date (newest first)
  const threads = Array.from(threadMap.values());
  threads.sort((a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime());

  // Mark unread threads (if last message is NOT from user and thread has replies)
  // In a real implementation, this would come from Gmail's UNREAD label
  // For now, we'll use a simple heuristic: threads with replies where last message is incoming
  for (const thread of threads) {
    thread.hasUnreadReply = !thread.lastMessageIsFromUser && thread.hasReply;
  }

  return threads;
}

/**
 * Extracts name, email, and company from an email address string
 * Handles formats like "John Smith <john@company.com>" or just "john@company.com"
 */
function extractContactInfo(emailString: string): {
  name: string;
  email: string;
  company: string;
} {
  const emailMatch = emailString.match(/<(.+)>/);
  const email = emailMatch ? emailMatch[1] : emailString.trim();

  // Extract name (text before <email>)
  let name = emailMatch
    ? emailString.split("<")[0].trim().replace(/"/g, "")
    : email.split("@")[0];

  // Clean up name (capitalize words, remove dots/underscores)
  name = name
    .replace(/[._]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  // Extract company from email domain
  const domain = email.split("@")[1] || "";
  const company = domain
    .replace(/\.(com|org|net|io|co|nl|de|fr|es|it|pt|uk|be|eu)$/i, "")
    .replace(/\./g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return { name: name || email, email, company };
}

/**
 * Removes "Re:", "Fwd:", etc. from subject lines
 */
function cleanSubject(subject: string): string {
  return subject.replace(/^(Re:|Fwd:|Fw:)\s*/gi, "").trim() || "(No subject)";
}

/**
 * Filters out Gmail system labels, keeping only user-created labels
 */
function filterUserLabels(labelIds: string[]): string[] {
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

  return labelIds.filter((label) => {
    const isSystemLabel = systemLabelPrefixes.some(
      (prefix) => label.startsWith(prefix) || label.endsWith("_STAR")
    );
    return !isSystemLabel;
  });
}

/**
 * Filters threads by label
 */
export function filterThreadsByLabel(
  threads: EmailThread[],
  label: string | null
): EmailThread[] {
  if (!label) return threads;
  return threads.filter((thread) => thread.labels.includes(label));
}

/**
 * Searches threads by query string
 */
export function searchThreads(
  threads: EmailThread[],
  query: string
): EmailThread[] {
  if (!query.trim()) return threads;

  const lowerQuery = query.toLowerCase();
  return threads.filter(
    (thread) =>
      thread.contactName.toLowerCase().includes(lowerQuery) ||
      thread.contactEmail.toLowerCase().includes(lowerQuery) ||
      thread.company.toLowerCase().includes(lowerQuery) ||
      thread.subject.toLowerCase().includes(lowerQuery) ||
      thread.lastMessagePreview.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Gets all unique labels from a list of threads
 */
export function getAllLabels(threads: EmailThread[]): string[] {
  const labelSet = new Set<string>();
  for (const thread of threads) {
    for (const label of thread.labels) {
      labelSet.add(label);
    }
  }
  return Array.from(labelSet).sort();
}

/**
 * Calculates thread statistics
 */
export function getThreadStats(threads: EmailThread[]) {
  return {
    total: threads.length,
    withReplies: threads.filter((t) => t.hasReply).length,
    awaitingReply: threads.filter((t) => !t.hasReply).length,
    unread: threads.filter((t) => t.hasUnreadReply).length,
    positive: threads.filter((t) => t.sentiment?.sentiment === "positive").length,
    neutral: threads.filter((t) => t.sentiment?.sentiment === "neutral").length,
    negative: threads.filter((t) => t.sentiment?.sentiment === "negative").length,
  };
}

/**
 * Open tracking stats for a message
 */
export interface MessageOpenStats {
  messageId: string;
  hasTracking: boolean;
  isOpened: boolean;
  firstOpenedAt: Date | null;
  openCount: number;
}

/**
 * Enriches threads with open tracking data from the database
 * Call this after groupEmailsIntoThreads to add open status
 */
export function enrichThreadsWithOpenTracking(
  threads: EmailThread[],
  openStats: MessageOpenStats[]
): EmailThread[] {
  // Create a lookup map by message ID
  const statsMap = new Map<string, MessageOpenStats>();
  for (const stat of openStats) {
    statsMap.set(stat.messageId, stat);
  }

  return threads.map((thread) => {
    // Enrich each message with tracking data
    const enrichedMessages = thread.messages.map((msg) => {
      const stat = statsMap.get(msg.id);
      if (stat) {
        return {
          ...msg,
          hasTracking: stat.hasTracking,
          isOpened: stat.isOpened,
          firstOpenedAt: stat.firstOpenedAt || undefined,
          openCount: stat.openCount,
        };
      }
      return msg;
    });

    // Calculate thread-level tracking (aggregate from all outgoing messages)
    const outgoingWithTracking = enrichedMessages.filter(
      (m) => m.isOutgoing && m.hasTracking
    );
    const anyOpened = outgoingWithTracking.some((m) => m.isOpened);
    const totalOpens = outgoingWithTracking.reduce(
      (sum, m) => sum + (m.openCount || 0),
      0
    );
    const firstOpen = outgoingWithTracking
      .filter((m) => m.firstOpenedAt)
      .map((m) => m.firstOpenedAt!)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      ...thread,
      messages: enrichedMessages,
      hasTracking: outgoingWithTracking.length > 0,
      isOpened: anyOpened,
      firstOpenedAt: firstOpen,
      openCount: totalOpens,
    };
  });
}
