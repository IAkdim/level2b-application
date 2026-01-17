import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Mail, RefreshCw, Loader2, AlertCircle, Send, Sparkles, Trash2, X } from "lucide-react";
import { getGmailLabels, getRepliesByLabel, getEmailsByLabel, sendEmail, deleteGmailLabel, type Email } from "@/lib/api/gmail";
import { generateSalesReply, type EmailReplyContext, analyzeSentiment } from "@/lib/api/claude-secure";
import { isAuthenticationError, reAuthenticateWithGoogle } from "@/lib/api/reauth";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { toast } from "sonner";
import type { Language } from "@/types/crm";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export function EmailThreads() {
  const { user } = useAuth();
  const [availableLabels, setAvailableLabels] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [replies, setReplies] = useState<Email[]>([]);
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"sent" | "responses">("responses");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [replyLanguage, setReplyLanguage] = useState<Language>('en'); // User-selected language for AI replies

  // Fetch available labels on mount
  useEffect(() => {
    loadLabels();
  }, []);

  // Load emails when label is selected
  useEffect(() => {
    if (selectedLabel) {
      loadEmails();
    }
  }, [selectedLabel]);

  const loadLabels = async () => {
    try {
      const labels = await getGmailLabels();
      
      // Filter systeemlabels - alleen user-created labels tonen
      const systemLabelPrefixes = ['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT', 'CHAT', 'CATEGORY_'];
      const systemLabelNames = ['Junk', 'Notes'];
      
      const customLabels = labels.filter((l) => {
        // Filter op ID (systeem labels hebben uppercase IDs die starten met bekend prefixes)
        const hasSystemPrefix = systemLabelPrefixes.some(prefix => l.id.startsWith(prefix));
        // Filter op naam
        const isSystemName = systemLabelNames.includes(l.name);
        // Filter labels die eindigen op _STAR (zoals YELLOW_STAR, RED_STAR, etc.)
        const isStar = l.id.endsWith('_STAR');
        
        return !hasSystemPrefix && !isSystemName && !isStar && l.type !== 'system';
      });
      
      setAvailableLabels(customLabels);
      
      // Auto-select laatst aangemaakte label (laatste in de lijst)
      if (customLabels.length > 0 && !selectedLabel) {
        const latestLabel = customLabels[customLabels.length - 1];
        setSelectedLabel(latestLabel.name);
      }
    } catch (error) {
      console.error("Error loading labels:", error);
    }
  };

  const loadEmails = async () => {
    if (!selectedLabel) return;

    setIsLoading(true);
    try {
      // Fetch ALL emails with the label (read + unread)
      const sent = await getEmailsByLabel(selectedLabel, 100);
      setSentEmails(sent);

      // Haal reacties op emails met dit label (zonder sentiment analyse)
      const repliesData = await getRepliesByLabel(selectedLabel, false, false); // Fetch all replies, analyzeSentiments = false
      setReplies(repliesData);
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading emails:", error);
      
      if (isAuthenticationError(error)) {
        toast.error("Google Re-authentication Required", {
          description: "Your Gmail connection has expired. Click 'Re-connect Gmail' to continue.",
          duration: 10000,
          action: {
            label: "Re-connect Gmail",
            onClick: async () => {
              try {
                await reAuthenticateWithGoogle()
              } catch (reAuthError) {
                console.error("Re-authentication failed:", reAuthError)
                toast.error("Re-authentication failed. Please try again.")
              }
            }
          }
        })
      } else {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error("Error loading emails", {
          description: errorMessage,
          duration: 5000
        })
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      await loadEmails();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAnalyzeSentiment = async () => {
    if (selectedEmailIds.size === 0) {
      toast.error("Select emails first", {
        description: "Select at least one email to analyse sentiment"
      });
      return;
    }

    setIsAnalyzingSentiment(true);
    const selectedEmails = replies.filter(r => selectedEmailIds.has(r.id));
    let successCount = 0;
    let errorCount = 0;
    let lastError: string | null = null;

    toast.info(`Sentiment analysis started for ${selectedEmails.length} email${selectedEmails.length !== 1 ? 's' : ''}...`);

    for (const email of selectedEmails) {
      try {
        const sentiment = await analyzeSentiment(email.body, email.subject);
        
        if (sentiment.error) {
          throw new Error(sentiment.error);
        }
        
        // Store in UI state only
        setReplies(prevReplies => 
          prevReplies.map(r => 
            r.id === email.id ? { ...r, sentiment } : r
          )
        );
        
        successCount++;
      } catch (error) {
        console.error(`Failed to analyze sentiment for email ${email.id}:`, error);
        lastError = error instanceof Error ? error.message : String(error);
        errorCount++;
      }
    }

    setIsAnalyzingSentiment(false);
    setSelectedEmailIds(new Set());

    if (successCount > 0) {
      toast.success(`Sentiment analysis completed`, {
        description: `${successCount} email${successCount !== 1 ? 's' : ''} analysed${errorCount > 0 ? `, ${errorCount} failed` : ''}`
      });
    } else {
      toast.error("Sentiment analysis failed", {
        description: lastError || "No emails could be analysed"
      });
    }
  };

  const handleToggleEmailSelection = (emailId: string) => {
    setSelectedEmailIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleSelectAllEmails = () => {
    if (selectedEmailIds.size === filteredReplies.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(filteredReplies.map(r => r.id)));
    }
  };

  const handleDeleteLabel = async (labelId: string, labelName: string) => {
    if (!confirm(`Are you sure you want to delete the label "${labelName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteGmailLabel(labelId);
      toast.success("Label deleted", {
        description: `The label "${labelName}" has been deleted successfully`
      });
      
      // Als de verwijderde label de geselecteerde was, clear de selectie
      if (selectedLabel === labelName) {
        setSelectedLabel("");
        setReplies([]);
        setSentEmails([]);
      }
      
      // Reload labels
      await loadLabels();
    } catch (error) {
      console.error("Error deleting label:", error);
      
      if (isAuthenticationError(error)) {
        toast.error("Google Re-authentication Required", {
          description: "Your Gmail connection has expired. Click 'Re-connect Gmail' to continue.",
          duration: 10000,
          action: {
            label: "Re-connect Gmail",
            onClick: async () => {
              try {
                await reAuthenticateWithGoogle()
                toast.success("Re-authentication successful")
              } catch (reAuthError) {
                console.error("Re-authentication failed:", reAuthError)
                toast.error("Re-authentication failed. Please try again.")
              }
            }
          }
        })
      } else {
        toast.error("Failed to delete label", {
          description: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  };

  // Filter emails based on search
  const filterEmails = (emails: Email[]) => {
    if (!searchTerm) return emails;

    return emails.filter((email) =>
      email.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.snippet.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredReplies = filterEmails(replies);
  const filteredSent = filterEmails(sentEmails);

  // Calculate sentiment statistics
  const sentimentStats = {
    positive: replies.filter(r => r.sentiment?.sentiment === 'positive').length,
    doubtful: replies.filter(r => r.sentiment?.sentiment === 'doubtful').length,
    notInterested: replies.filter(r => r.sentiment?.sentiment === 'not_interested').length,
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    // Don't clear selectedEmail immediately, other dialogs might need it
  };

  const handleReplyClick = (email: Email) => {
    setSelectedEmail(email);
    setReplySubject(`Re: ${email.subject}`);
    setReplyBody("");
    setIsReplyDialogOpen(true);
  };

  const handleGenerateAIReply = async () => {
    if (!selectedEmail) return;

    setIsGeneratingReply(true);
    try {
      // Get current session for user data
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      // Extract recipient info
      const fromMatch = selectedEmail.from.match(/<(.+)>/);
      const recipientEmail = fromMatch ? fromMatch[1] : selectedEmail.from;
      const recipientName = selectedEmail.from.split('<')[0].trim() || recipientEmail.split('@')[0];

      // Get user profile for user name
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', session.user.id)
        .single();

      const userName = profile?.full_name || profile?.email?.split('@')[0] || 'there';

      // Get user settings for company info and Calendly link
      let companyName: string | undefined;
      let productService: string | undefined;
      let calendlyLink: string | undefined;

      try {
        const { data: userSettings, error: settingsError } = await supabase
          .from('user_settings')
          .select('company_name, product_service, calendly_scheduling_url')
          .eq('user_id', session.user.id)
          .single();

        if (settingsError) {
          console.warn('user_settings query failed:', settingsError);
          // Continue without these values
        } else {
          companyName = userSettings?.company_name;
          productService = userSettings?.product_service;
          calendlyLink = userSettings?.calendly_scheduling_url;

          console.log('[REPLY] User settings fetched:', {
            companyName,
            productService,
            calendlyLink,
            sentiment: selectedEmail.sentiment?.sentiment
          });
        }
      } catch (err) {
        console.warn('Failed to fetch user settings:', err);
        // Continue without these values
      }

      // CRITICAL: Check if sentiment is positive but no Calendly link
      if (selectedEmail.sentiment?.sentiment === 'positive' && !calendlyLink) {
        toast.error('Cannot generate positive reply: Calendly link not configured. Please set up your user settings first.');
        setIsGeneratingReply(false);
        return;
      }

      const context: EmailReplyContext = {
        recipientName,
        recipientEmail,
        originalSubject: selectedEmail.subject,
        originalBody: selectedEmail.body || selectedEmail.snippet,
        sentiment: selectedEmail.sentiment?.sentiment || 'neutral',
        userName,
        companyName,
        productService,
        calendlyLink,
        language: replyLanguage,
      };

      console.log('[REPLY] Sending context to Edge Function:', {
        sentiment: context.sentiment,
        calendlyLink: context.calendlyLink,
        hasCalendlyLink: !!context.calendlyLink
      });

      const generatedReply = await generateSalesReply(context);

      if (generatedReply.error) {
        toast.error(`Error generating reply: ${generatedReply.error}`)
        return
      }

      setReplySubject(generatedReply.subject);
      setReplyBody(generatedReply.body);
      toast.success(`AI reply generated (${generatedReply.tone})`)
    } catch (error) {
      console.error('Error generating AI reply:', error);
      toast.error('Error generating AI reply')
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyBody.trim()) {
      toast.error('Please enter a message to send');
      return;
    }

    setIsSendingReply(true);
    try {
      // Extract recipient email
      const fromMatch = selectedEmail.from.match(/<(.+)>/);
      const recipientEmail = fromMatch ? fromMatch[1] : selectedEmail.from;

      await sendEmail(
        recipientEmail,
        replySubject,
        replyBody,
        selectedLabel // Add label to sent reply
      );

      toast.success(`Reply sent to ${recipientEmail}`);
      setIsReplyDialogOpen(false);
      setReplyBody("");
      setReplySubject("");
      
      // Refresh emails to show sent reply
      await loadEmails();
    } catch (error) {
      console.error('Error sending reply:', error);
      
      if (isAuthenticationError(error)) {
        toast.error("Google Re-authentication Required", {
          description: "Your Gmail connection has expired. Click 'Re-connect Gmail' to continue.",
          duration: 10000,
          action: {
            label: "Re-connect Gmail",
            onClick: async () => {
              try {
                await reAuthenticateWithGoogle()
              } catch (reAuthError) {
                console.error("Re-authentication failed:", reAuthError)
                toast.error("Re-authentication failed. Please try again.")
              }
            }
          }
        })
      } else {
        toast.error('Error sending reply');
      }
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Threads</h1>
          <p className="text-muted-foreground">
            Overview of email conversations with prospects
          </p>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-1">
              Last update: {formatRelativeTime(lastRefresh.toISOString())}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Filter toggle */}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
            <Search className="mr-2 h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </div>

      {/* Label Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail Label</CardTitle>
          <CardDescription>
            Select the label of your outreach campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Select value={selectedLabel} onValueChange={setSelectedLabel}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a label..." />
              </SelectTrigger>
              <SelectContent>
                {availableLabels.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No custom labels found
                  </SelectItem>
                ) : (
                  availableLabels.map((label) => (
                    <SelectItem key={label.id} value={label.name}>
                      {label.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            
            {/* Label Management - Show delete buttons for all labels */}
            {availableLabels.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Manage Labels</p>
                <div className="flex flex-wrap gap-2">
                  {availableLabels.map((label) => (
                    <div 
                      key={label.id}
                      className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-1.5 text-sm"
                    >
                      <span className="font-medium">{label.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLabel(label.id, label.name);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentEmails.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Emails sent with label
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Replies</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              New replies received
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sentEmails.length > 0 
                ? Math.round((replies.length / sentEmails.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Percentage replies
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sentiment</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg font-bold">🟢 {sentimentStats.positive}</span>
              <span className="text-lg font-bold">🟡 {sentimentStats.doubtful}</span>
              <span className="text-lg font-bold">🔴 {sentimentStats.notInterested}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              AI sentiment analyse
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter emails based on content</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="search-threads" className="sr-only">
                  Search emails
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    id="search-threads"
                    type="text"
                    placeholder="Search by sender, subject, or message..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "sent" | "responses")}>
        <TabsList>
          <TabsTrigger value="sent">
            Sent ({filteredSent.length})
          </TabsTrigger>
          <TabsTrigger value="responses">
            Replies ({filteredReplies.length})
          </TabsTrigger>
        </TabsList>

        {/* Sent Emails Tab */}
        <TabsContent value="sent" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sent Emails</CardTitle>
              <CardDescription>
                {filteredSent.length} email{filteredSent.length !== 1 ? 's' : ''} sent with label "{selectedLabel}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedLabel ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a label to view emails
                  </p>
                </div>
              ) : filteredSent.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No sent emails with this label
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSent.map((email) => (
                    <div 
                      key={email.id} 
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleEmailClick(email)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium">{email.to}</h3>
                            <Badge variant="secondary" className="text-xs">
                              Sent
                            </Badge>
                          </div>
                          <p className="font-medium text-sm mb-1">{email.subject}</p>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {email.snippet}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{formatRelativeTime(email.date.toISOString())}</span>
                            <span>Thread ID: {email.threadId.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Responses Tab */}
        <TabsContent value="responses" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Replies</CardTitle>
                  <CardDescription>
                    {filteredReplies.length} repl{filteredReplies.length !== 1 ? 'ies' : 'y'} to emails with label "{selectedLabel}"
                  </CardDescription>
                </div>
                {filteredReplies.length > 0 && (
                  <div className="flex items-center space-x-3">
                    {selectedEmailIds.size > 0 && (
                      <Button
                        onClick={handleAnalyzeSentiment}
                        disabled={isAnalyzingSentiment}
                        className="bg-primary"
                      >
                        {isAnalyzingSentiment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyseren...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Analyze Sentiment ({selectedEmailIds.size})
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleSelectAllEmails}
                      size="sm"
                    >
                      {selectedEmailIds.size === filteredReplies.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedLabel ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a label to view replies
                  </p>
                </div>
              ) : filteredReplies.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium mb-1">
                    No replies received yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    New replies will appear here automatically
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReplies.map((email) => (
                    <div 
                      key={email.id} 
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          checked={selectedEmailIds.has(email.id)}
                          onCheckedChange={() => handleToggleEmailSelection(email.id)}
                          className="mt-1"
                        />
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleEmailClick(email)}
                        >
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium">{email.from}</h3>
                            <Badge variant="success" className="text-xs">
                              New Reply
                            </Badge>
                            {email.sentiment && (
                              <Badge 
                                variant={
                                  email.sentiment.sentiment === 'positive' ? 'default' :
                                  email.sentiment.sentiment === 'neutral' ? 'secondary' :
                                  'destructive'
                                }
                                className="text-xs"
                              >
                                {email.sentiment.sentiment === 'positive' ? '🟢 Positive' :
                                 email.sentiment.sentiment === 'neutral' ? '🟡 Neutral' :
                                 '🔴 Negative'}
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium text-sm mb-1">{email.subject}</p>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-3">
                            {email.snippet}
                          </p>
                          {email.sentiment && (
                            <>
                              <p className="text-xs text-muted-foreground italic mb-2">
                                AI Analysis: {email.sentiment.reasoning}
                              </p>
                              {email.sentiment.error && (
                                <p className="text-xs text-red-500 mb-2">
                                  ⚠️ Error: {email.sentiment.error}
                                </p>
                              )}
                            </>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>{formatRelativeTime(email.date.toISOString())}</span>
                            <span>Thread ID: {email.threadId.substring(0, 8)}...</span>
                            {email.sentiment && !email.sentiment.error && (
                              <span>Confidence: {Math.round(email.sentiment.confidence * 100)}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedEmail.subject}</DialogTitle>
                <DialogDescription>View and manage email thread details</DialogDescription>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">From:</span>
                        <span className="text-foreground">{selectedEmail.from}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">To:</span>
                        <span className="text-foreground">{selectedEmail.to}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Date:</span>
                        <span className="text-foreground">{selectedEmail.date.toLocaleString('nl-NL', { 
                          dateStyle: 'long', 
                          timeStyle: 'short' 
                        })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {selectedEmail.sentiment && (
                        <Badge 
                          variant={
                            selectedEmail.sentiment.sentiment === 'positive' ? 'default' :
                            selectedEmail.sentiment.sentiment === 'neutral' ? 'secondary' :
                            'destructive'
                          }
                          className="text-sm"
                        >
                          {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positive' :
                           selectedEmail.sentiment.sentiment === 'neutral' ? '🟡 Neutral' :
                           '🔴 Negative'}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Thread ID: {selectedEmail.threadId}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                {/* Email Body */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Message</h3>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {selectedEmail.body || selectedEmail.snippet}
                    </div>
                  </div>
                </div>

                {/* AI Sentiment Analysis */}
                {selectedEmail.sentiment && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Sentiment Analysis</h3>
                    
                    {selectedEmail.sentiment.error ? (
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">Analysis Failed</h4>
                            <p className="text-sm text-red-700 dark:text-red-300">{selectedEmail.sentiment.error}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Sentiment</div>
                            <div className="text-2xl font-bold">
                              {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positive' :
                               selectedEmail.sentiment.sentiment === 'neutral' ? '🟡 Neutral' :
                               '🔴 Negative'}
                            </div>
                          </div>
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                            <div className="text-2xl font-bold">
                              {Math.round(selectedEmail.sentiment.confidence * 100)}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg p-4 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-2 font-semibold">AI Reasoning</div>
                          <p className="text-sm leading-relaxed">
                            {selectedEmail.sentiment.reasoning}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Labels */}
                {selectedEmail.labelIds && selectedEmail.labelIds.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Labels</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.labelIds.map((labelId) => (
                        <Badge key={labelId} variant="outline" className="text-xs">
                          {labelId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleCloseDialog();
                    handleReplyClick(selectedEmail);
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Reply
                </Button>
                <Button onClick={handleCloseDialog}>Close</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedEmail && (
            <>
              <DialogHeader>
                <DialogTitle>Reply to email</DialogTitle>
                <DialogDescription>
                  Generate an AI-powered reply based on sentiment analysis
                </DialogDescription>
                <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground">To:</span>
                    <span className="text-foreground">{selectedEmail.from}</span>
                  </div>
                  {selectedEmail.sentiment && (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-foreground">Sentiment:</span>
                      <Badge 
                        variant={
                          selectedEmail.sentiment.sentiment === 'positive' ? 'default' :
                          selectedEmail.sentiment.sentiment === 'neutral' ? 'secondary' :
                          'destructive'
                        }
                        className="text-xs"
                      >
                        {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positive' :
                         selectedEmail.sentiment.sentiment === 'neutral' ? '🟡 Neutral' :
                         '🔴 Negative'}
                      </Badge>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Language Selector for AI Reply */}
                <div className="space-y-2">
                  <Label htmlFor="reply-language">AI Reply Language</Label>
                  <Select value={replyLanguage} onValueChange={(value) => setReplyLanguage(value as Language)}>
                    <SelectTrigger id="reply-language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                      <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="es">🇪🇸 Español</SelectItem>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="pt">🇵🇹 Português</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the language for AI-generated replies
                  </p>
                </div>

                {/* AI Generate Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingReply || !selectedEmail.sentiment}
                    title={!selectedEmail.sentiment ? 'Analyze sentiment first' : ''}
                  >
                    {isGeneratingReply ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI generating reply...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate AI Reply
                      </>
                    )}
                  </Button>
                </div>

                {/* Original Email Preview */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">ORIGINAL EMAIL</div>
                  <div className="text-sm font-medium mb-1">{selectedEmail.subject}</div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {selectedEmail.body || selectedEmail.snippet}
                  </div>
                </div>

                {/* Reply Form */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reply-subject">Subject</Label>
                    <Input
                      id="reply-subject"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Re: ..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="reply-body">Message</Label>
                    <Textarea
                      id="reply-body"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write your reply here..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReplyDialogOpen(false);
                      setReplyBody("");
                      setReplySubject("");
                      setSelectedEmail(null);
                    }}
                    disabled={isSendingReply}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyBody.trim()}
                  >
                    {isSendingReply ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}