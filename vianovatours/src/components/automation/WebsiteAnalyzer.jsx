import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Globe, 
  Search, 
  Shield, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Zap
} from "lucide-react";

export default function WebsiteAnalyzer({ initialUrl, onAnalysisComplete }) {
  const [url, setUrl] = useState(initialUrl || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  const analyzeWebsite = async () => {
    setIsAnalyzing(true);
    
    // Simulate website analysis - replace with actual backend service
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockAnalysis = {
      url: url,
      difficulty: "medium",
      antiBot: {
        cloudflare: true,
        captcha: "recaptcha",
        rateLimit: "moderate",
        fingerprinting: true
      },
      structure: {
        dateSelector: "calendar-widget",
        ticketTypes: ["adult", "child", "senior"],
        paymentMethods: ["card", "paypal"],
        formComplexity: "medium"
      },
      recommendations: [
        "Use rotating proxies",
        "Implement CAPTCHA solving",
        "Add random delays between actions",
        "Use residential IP addresses"
      ],
      estimatedTime: "3-5 minutes per booking",
      successRate: 85
    };
    
    setAnalysis(mockAnalysis);
    setIsAnalyzing(false);
    
    if (onAnalysisComplete) {
      onAnalysisComplete(mockAnalysis);
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "hard": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Search className="w-5 h-5" />
          Website Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://bilete.peles.ro/museums/castel-peles"
            className="flex-1"
          />
          <Button
            onClick={analyzeWebsite}
            disabled={!url || isAnalyzing}
            variant="outline"
          >
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {analysis && (
          <div className="space-y-4 pt-4 border-t border-slate-200">
            {/* Difficulty & Success Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <Badge className={getDifficultyColor(analysis.difficulty)}>
                  {analysis.difficulty} difficulty
                </Badge>
                <p className="text-xs text-slate-500 mt-1">Automation complexity</p>
              </div>
              <div className="text-center">
                <Badge className="bg-emerald-100 text-emerald-800">
                  {analysis.successRate}% success
                </Badge>
                <p className="text-xs text-slate-500 mt-1">Expected success rate</p>
              </div>
            </div>

            {/* Anti-Bot Measures */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security Measures
              </h4>
              <div className="space-y-2">
                {analysis.antiBot.cloudflare && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>Cloudflare protection detected</span>
                  </div>
                )}
                {analysis.antiBot.captcha && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>CAPTCHA: {analysis.antiBot.captcha}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3 h-3 text-blue-500" />
                  <span>Rate limiting: {analysis.antiBot.rateLimit}</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Recommendations
              </h4>
              <div className="space-y-1">
                {analysis.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timing */}
            <div className="bg-slate-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Estimated time:</span>
                <span className="font-medium">{analysis.estimatedTime}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}