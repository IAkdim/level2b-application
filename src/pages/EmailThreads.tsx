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
import { Search, Mail, RefreshCw, Loader2, AlertCircle, Send, Sparkles } from "lucide-react";
import { getGmailLabels, getRepliesByLabel, getEmailsByLabel, sendEmail, type Email } from "@/lib/api/gmail";
import { generateSalesReply, type EmailReplyContext } from "@/lib/api/claude-secure";
import { formatRelativeTime } from "@/lib/utils/formatters";
import { toast } from "sonner";

export function EmailThreads() {
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
      // Filter only custom labels (not system labels like INBOX, SENT, etc.)
      const customLabels = labels.filter(
        (l) => !['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'UNREAD', 'STARRED', 'IMPORTANT'].includes(l.id)
      );
      setAvailableLabels(customLabels);
      
      // Auto-select first label if available
      if (customLabels.length > 0 && !selectedLabel) {
        setSelectedLabel(customLabels[0].name);
      }
    } catch (error) {
      console.error("Error loading labels:", error);
    }
  };

  const loadEmails = async () => {
    if (!selectedLabel) return;

    setIsLoading(true);
    try {
      console.log("Loading emails for label:", selectedLabel);
      
      // Haal ALLE emails met het label op (gelezen + ongelezen)
      const sent = await getEmailsByLabel(selectedLabel, 100);
      console.log("Sent emails loaded:", sent.length);
      setSentEmails(sent);

      // Haal reacties op emails met dit label
      const repliesData = await getRepliesByLabel(selectedLabel, false); // Haal alle replies op, niet alleen unread
      console.log("Replies loaded:", repliesData.length);
      setReplies(repliesData);
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading emails:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Er is een fout opgetreden bij het laden van emails:\n${errorMessage}\n\nControleer of:\n- Je bent ingelogd met Google\n- Gmail permissies hebt gegeven\n- Het label "${selectedLabel}" bestaat in Gmail`);
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
    console.log('Reply button clicked for email:', email.id);
    setSelectedEmail(email);
    setReplySubject(`Re: ${email.subject}`);
    setReplyBody("");
    setIsReplyDialogOpen(true);
    console.log('Reply dialog should be open now');
  };

  const handleGenerateAIReply = async () => {
    if (!selectedEmail) return;

    setIsGeneratingReply(true);
    try {
      // Extract recipient name from email address
      const fromMatch = selectedEmail.from.match(/<(.+)>/);
      const recipientEmail = fromMatch ? fromMatch[1] : selectedEmail.from;
      const recipientName = selectedEmail.from.split('<')[0].trim() || recipientEmail.split('@')[0];

      const context: EmailReplyContext = {
        recipientName,
        recipientEmail,
        originalSubject: selectedEmail.subject,
        originalBody: selectedEmail.body || selectedEmail.snippet,
        sentiment: selectedEmail.sentiment?.sentiment || 'doubtful',
        companyName: 'jullie bedrijf',
        productService: 'jullie dienstverlening',
      };

      const generatedReply = await generateSalesReply(context);

      if (generatedReply.error) {
        toast.error(`Fout bij genereren reply: ${generatedReply.error}`);
        return;
      }

      setReplySubject(generatedReply.subject);
      setReplyBody(generatedReply.body);
      toast.success(`AI reply gegenereerd (${generatedReply.tone})`);
    } catch (error) {
      console.error('Error generating AI reply:', error);
      toast.error('Fout bij genereren AI reply');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyBody.trim()) {
      toast.error('Vul een bericht in om te versturen');
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

      toast.success(`Reply verzonden naar ${recipientEmail}`);
      setIsReplyDialogOpen(false);
      setReplyBody("");
      setReplySubject("");
      
      // Refresh emails to show sent reply
      await loadEmails();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('Fout bij versturen reply');
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
            Overzicht van email conversations met prospects
          </p>
          {lastRefresh && (
            <p className="text-xs text-muted-foreground mt-1">
              Laatste update: {formatRelativeTime(lastRefresh.toISOString())}
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
            Ververs
          </Button>

          {/* Filter toggle */}
          <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}>
            <Search className="mr-2 h-4 w-4" />
            {showFilters ? 'Verberg' : 'Toon'} Filters
          </Button>
        </div>
      </div>

      {/* Label Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail Label</CardTitle>
          <CardDescription>
            Selecteer het label van je outreach campagne
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLabel} onValueChange={setSelectedLabel}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecteer een label..." />
            </SelectTrigger>
            <SelectContent>
              {availableLabels.length === 0 ? (
                <SelectItem value="none" disabled>
                  Geen custom labels gevonden
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
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verzonden</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentEmails.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Emails verzonden met label
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reacties</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{replies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Nieuwe reacties ontvangen
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
              Percentage reacties
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
            <CardDescription>Filter emails op basis van inhoud</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <div className="flex-1">
                <Label htmlFor="search-threads" className="sr-only">
                  Zoek emails
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Input
                    id="search-threads"
                    type="text"
                    placeholder="Zoek op afzender, onderwerp, of bericht..."
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
            Verzonden ({filteredSent.length})
          </TabsTrigger>
          <TabsTrigger value="responses">
            Reacties ({filteredReplies.length})
          </TabsTrigger>
        </TabsList>

        {/* Sent Emails Tab */}
        <TabsContent value="sent" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Verzonden Emails</CardTitle>
              <CardDescription>
                {filteredSent.length} email{filteredSent.length !== 1 ? 's' : ''} verzonden met label "{selectedLabel}"
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
                    Selecteer een label om emails te bekijken
                  </p>
                </div>
              ) : filteredSent.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Geen verzonden emails met dit label
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
                              Verzonden
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
              <CardTitle>Reacties</CardTitle>
              <CardDescription>
                {filteredReplies.length} reactie{filteredReplies.length !== 1 ? 's' : ''} op emails met label "{selectedLabel}"
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
                    Selecteer een label om reacties te bekijken
                  </p>
                </div>
              ) : filteredReplies.length === 0 ? (
                <div className="text-center py-16">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-muted-foreground font-medium mb-1">
                    Nog geen reacties ontvangen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nieuwe reacties verschijnen hier automatisch
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReplies.map((email) => (
                    <div 
                      key={email.id} 
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleEmailClick(email)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-medium">{email.from}</h3>
                            <Badge variant="success" className="text-xs">
                              Nieuwe Reactie
                            </Badge>
                            {email.sentiment && (
                              <Badge 
                                variant={
                                  email.sentiment.sentiment === 'positive' ? 'default' :
                                  email.sentiment.sentiment === 'doubtful' ? 'secondary' :
                                  'destructive'
                                }
                                className="text-xs"
                              >
                                {email.sentiment.sentiment === 'positive' ? '🟢 Positief' :
                                 email.sentiment.sentiment === 'doubtful' ? '🟡 Twijfelend' :
                                 '🔴 Niet Geïnteresseerd'}
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
                                AI Analyse: {email.sentiment.reasoning}
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
                              <span>Zekerheid: {Math.round(email.sentiment.confidence * 100)}%</span>
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
                <DialogDescription className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Van:</span>
                        <span className="text-foreground">{selectedEmail.from}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Aan:</span>
                        <span className="text-foreground">{selectedEmail.to}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Datum:</span>
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
                            selectedEmail.sentiment.sentiment === 'doubtful' ? 'secondary' :
                            'destructive'
                          }
                          className="text-sm"
                        >
                          {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positief' :
                           selectedEmail.sentiment.sentiment === 'doubtful' ? '🟡 Twijfelend' :
                           '🔴 Niet Geïnteresseerd'}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Thread ID: {selectedEmail.threadId}
                      </span>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-6">
                {/* Email Body */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bericht</h3>
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {selectedEmail.body || selectedEmail.snippet}
                    </div>
                  </div>
                </div>

                {/* AI Sentiment Analysis */}
                {selectedEmail.sentiment && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Sentiment Analyse</h3>
                    
                    {selectedEmail.sentiment.error ? (
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50 dark:bg-red-950/20">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-red-900 dark:text-red-100 mb-1">Analyse Mislukt</h4>
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
                              {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positief' :
                               selectedEmail.sentiment.sentiment === 'doubtful' ? '🟡 Twijfelend' :
                               '🔴 Niet Geïnteresseerd'}
                            </div>
                          </div>
                          <div className="border rounded-lg p-4 bg-muted/30">
                            <div className="text-xs text-muted-foreground mb-1">Zekerheid</div>
                            <div className="text-2xl font-bold">
                              {Math.round(selectedEmail.sentiment.confidence * 100)}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="border rounded-lg p-4 bg-muted/30">
                          <div className="text-xs text-muted-foreground mb-2 font-semibold">AI Redenering</div>
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
                  Beantwoorden
                </Button>
                <Button onClick={handleCloseDialog}>Sluiten</Button>
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
                <DialogTitle>Reply op email</DialogTitle>
                <DialogDescription>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-foreground">Aan:</span>
                      <span className="text-foreground">{selectedEmail.from}</span>
                    </div>
                    {selectedEmail.sentiment && (
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Sentiment:</span>
                        <Badge 
                          variant={
                            selectedEmail.sentiment.sentiment === 'positive' ? 'default' :
                            selectedEmail.sentiment.sentiment === 'doubtful' ? 'secondary' :
                            'destructive'
                          }
                          className="text-xs"
                        >
                          {selectedEmail.sentiment.sentiment === 'positive' ? '🟢 Positief' :
                           selectedEmail.sentiment.sentiment === 'doubtful' ? '🟡 Twijfelend' :
                           '🔴 Niet Geïnteresseerd'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* AI Generate Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAIReply}
                    disabled={isGeneratingReply}
                  >
                    {isGeneratingReply ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        AI genereert reply...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Genereer AI Reply
                      </>
                    )}
                  </Button>
                </div>

                {/* Original Email Preview */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">ORIGINELE EMAIL</div>
                  <div className="text-sm font-medium mb-1">{selectedEmail.subject}</div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {selectedEmail.body || selectedEmail.snippet}
                  </div>
                </div>

                {/* Reply Form */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="reply-subject">Onderwerp</Label>
                    <Input
                      id="reply-subject"
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      placeholder="Re: ..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="reply-body">Bericht</Label>
                    <Textarea
                      id="reply-body"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Schrijf je reply hier..."
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
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyBody.trim()}
                  >
                    {isSendingReply ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Versturen...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Verstuur Reply
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