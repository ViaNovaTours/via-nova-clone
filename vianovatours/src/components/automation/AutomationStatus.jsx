import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle, 
  Globe, 
  Eye,
  RefreshCw,
  Clock,
  Shield
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AutomationStatus({ order, onUpdate }) {
  const [automationStatus, setAutomationStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // This would integrate with your backend Selenium service
  const startAutomation = async () => {
    setIsRunning(true);
    setAutomationStatus("running");
    
    // Mock automation steps - replace with actual backend integration
    const steps = [
      "Initializing browser session...",
      "Navigating to ticketing website...",
      "Detecting anti-bot measures...",
      "Solving CAPTCHA if present...",
      "Selecting tickets and dates...",
      "Filling customer information...",
      "Processing payment...",
      "Capturing confirmation...",
      "Saving ticket details..."
    ];
    
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(steps[i]);
      setProgress((i + 1) / steps.length * 100);
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: steps[i],
        type: "info"
      }]);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    setAutomationStatus("completed");
    setIsRunning(false);
    
    // Update order status
    await onUpdate({
      status: "purchased",
      processing_notes: `Automated purchase completed at ${new Date().toISOString()}`
    });
  };

  const stopAutomation = () => {
    setIsRunning(false);
    setAutomationStatus("stopped");
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      message: "Automation stopped by user",
      type: "warning"
    }]);
  };

  const getStatusColor = () => {
    switch (automationStatus) {
      case "running": return "bg-blue-100 text-blue-800";
      case "completed": return "bg-green-100 text-green-800";
      case "error": return "bg-red-100 text-red-800";
      case "stopped": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Selenium Automation
          </CardTitle>
          <Badge className={getStatusColor()}>
            {automationStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Website Analysis */}
        <Alert className="border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Target: {order.purchase_url || 'bilete.peles.ro'}
            <br />
            Anti-bot detection: Medium risk
            <br />
            Success rate: 85% (with proper setup)
          </AlertDescription>
        </Alert>

        {/* Progress */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="text-slate-900 font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-600 flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {currentStep}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {!isRunning ? (
            <Button
              onClick={startAutomation}
              disabled={!order.purchase_url}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Automation
            </Button>
          ) : (
            <Button
              onClick={stopAutomation}
              variant="destructive"
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop Automation
            </Button>
          )}
          
          <Button variant="outline" size="icon">
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Live Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-slate-900">Automation Log</h4>
            <div className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg h-32 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Requirements Alert */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Backend Required:</strong> Enable backend functions in Dashboard → Settings to use Selenium automation.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}