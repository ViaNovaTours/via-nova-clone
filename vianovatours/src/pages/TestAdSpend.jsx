import React, { useState } from "react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Play, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function TestAdSpendPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testPayload, setTestPayload] = useState(`{
  "date": "${new Date().toISOString().split('T')[0]}",
  "tour_name": "Pena Palace",
  "cost": 25.50,
  "currency": "EUR"
}`);
  
  const { toast } = useToast();

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        if (currentUser.role !== 'admin') {
          window.location.href = '/Dashboard';
        }
      } catch (error) {
        console.error("Error loading user:", error);
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const webhookSecret = "YOUR_AD_SPEND_WEBHOOK_SECRET"; // User will replace this
  const configuredFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const functionsBaseUrl = configuredFunctionsUrl
    ? configuredFunctionsUrl.replace(/\/$/, "")
    : supabaseUrl
      ? `${supabaseUrl}/functions/v1`
      : `${window.location.origin}/functions/v1`;
  const webhookUrl = `${functionsBaseUrl}/log-ad-spend`;

  const testWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const payload = JSON.parse(testPayload);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = { rawResponse: responseData };
      }

      setTestResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: parsedData
      });

      if (response.ok) {
        toast({
          title: "Test Successful! ✅",
          description: "Ad spend logged successfully",
          duration: 5000
        });
      } else {
        toast({
          title: "Test Failed ❌",
          description: `Status ${response.status}: ${response.statusText}`,
          variant: "destructive",
          duration: 5000
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message
      });
      
      toast({
        title: "Test Error ❌",
        description: error.message,
        variant: "destructive",
        duration: 5000
      });
    }
    
    setIsTesting(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied! ✅",
      duration: 2000
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Access Denied: Admin only
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Test Ad Spend Webhook</h1>
        <p className="text-slate-600 mt-2">Debug your Make.com integration</p>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Before testing:</strong> Replace "YOUR_AD_SPEND_WEBHOOK_SECRET" in the code below with your actual secret from Environment Variables
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Authorization Header (for Make.com)
            </label>
            <div className="flex gap-2">
              <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm">
                Bearer {webhookSecret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`Bearer ${webhookSecret}`)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Payload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Request Body (JSON)
            </label>
            <Textarea
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="font-mono text-sm"
              rows={10}
            />
          </div>

          <Button
            onClick={testWebhook}
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            {isTesting ? (
              <>Testing...</>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Send Test Request
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Test Result
              {testResult.success ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Success
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <XCircle className="w-3 h-3 mr-1" />
                  Failed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto">
              <pre className="text-sm">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-amber-900">Make.com Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2">
            <h4 className="font-semibold">Step 1: Add Authorization Header</h4>
            <p>In your HTTP module, click <strong>"+ Add parameter"</strong> at the top</p>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Select <strong>"Headers"</strong></li>
              <li>Name: <code className="bg-slate-100 px-2 py-0.5 rounded">Authorization</code></li>
              <li>Value: <code className="bg-slate-100 px-2 py-0.5 rounded">Bearer YOUR_SECRET</code></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Step 2: Set Content Type</h4>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Content type: <strong>JSON (application/json)</strong></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Step 3: Request Body</h4>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Body type: <strong>Raw</strong></li>
              <li>Make sure tour_name matches exactly (e.g., "Pena Palace" not "Pena Palace Tour")</li>
              <li>Use a normal decimal for cost (example: 125.40)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Step 4: Check Function Logs</h4>
            <p>After sending from Make.com:</p>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Go to <strong>Dashboard → Edge Functions → log-ad-spend</strong></li>
              <li>Click <strong>"Logs"</strong> tab</li>
              <li>Confirm each run returns success with created/updated counts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}