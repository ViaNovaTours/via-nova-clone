import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { fetchGmailThreads } from "@/functions/fetchGmailThreads";

export default function EmailThreads({ customerEmail }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadThreads = async () => {
    if (!customerEmail) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchGmailThreads({ customerEmail });
      
      if (response.data.error) {
        throw new Error(response.data.error);
      }
      
      setThreads(response.data.threads || []);
    } catch (err) {
      console.error('Load threads error:', err);
      setError(err.message || 'Failed to load email threads');
    }
    
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
  }, [customerEmail]);

  const parseEmailAddress = (emailStr) => {
    const match = emailStr.match(/<(.+?)>/);
    return match ? match[1] : emailStr;
  };

  const getEmailDirection = (thread) => {
    const fromEmail = parseEmailAddress(thread.from).toLowerCase();
    const toEmail = parseEmailAddress(thread.to).toLowerCase();
    
    if (fromEmail === customerEmail.toLowerCase()) {
      return { direction: 'incoming', label: 'From Customer', color: 'bg-blue-100 text-blue-800' };
    } else if (toEmail === customerEmail.toLowerCase()) {
      return { direction: 'outgoing', label: 'To Customer', color: 'bg-green-100 text-green-800' };
    }
    return { direction: 'other', label: 'Other', color: 'bg-slate-100 text-slate-800' };
  };

  if (!customerEmail) {
    return null;
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Thread History
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadThreads}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>No email communications found with {customerEmail}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threads.map((thread) => {
              const { direction, label, color } = getEmailDirection(thread);
              const isExpanded = expandedId === thread.id;
              
              return (
                <div
                  key={thread.id}
                  className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-colors"
                >
                  <div
                    className="p-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : thread.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={color}>{label}</Badge>
                          <span className="text-xs text-slate-500">
                            {format(new Date(thread.date), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <h4 className="font-medium text-slate-900 truncate">
                          {thread.subject || '(No Subject)'}
                        </h4>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {thread.snippet}
                    </p>
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-slate-200 p-3 bg-slate-50">
                      <div className="space-y-2 mb-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-700">From:</span>
                          <span className="text-slate-600 ml-2">{thread.from}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-700">To:</span>
                          <span className="text-slate-600 ml-2">{thread.to}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200">
                        {thread.body || thread.snippet}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}