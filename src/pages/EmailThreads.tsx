import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Mail, RefreshCw, Loader2 } from "lucide-react";
import { getGmailLabels, getRepliesByLabel, getEmailsByLabel, type Email } from "@/lib/api/gmail";
import { formatRelativeTime } from "@/lib/utils/formatters";

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
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  // Fetch available labels on mount
  useEffect(() => {
    loadLabels();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefreshEnabled || !selectedLabel) return;

    const interval = setInterval(() => {
      handleRefresh(true); // Silent refresh
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedLabel]);

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

  const handleRefresh = async (silent: boolean = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    
    try {
      await loadEmails();
    } finally {
      if (!silent) {
        setIsRefreshing(false);
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
          {/* Auto-refresh toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="auto-refresh"
              checked={autoRefreshEnabled}
              onCheckedChange={(checked) => setAutoRefreshEnabled(checked as boolean)}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              Auto-refresh (5 min)
            </Label>
          </div>
          
          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefresh(false)}
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
                    <div key={email.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
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
                    <div key={email.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
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
    </div>
  );
}