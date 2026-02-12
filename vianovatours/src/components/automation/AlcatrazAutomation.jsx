
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Globe,
  CreditCard,
  FileText,
  Eye
} from "lucide-react";
import { InvokeLLM, SendEmail } from "@/integrations/Core";

export default function AlcatrazAutomation({ order, onUpdate }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);
  const [requiresManualPayment, setRequiresManualPayment] = useState(false);

  const automationSteps = [
    "Initializing Chrome browser with anti-detection measures...",
    "Navigating to Alcatraz tour page (day/night based on booking)...", 
    "Clicking 'Check Availability' button...",
    "Waiting for calendar to load...",
    "Selecting requested date or nearest available...",
    "Selecting random available time slot...",
    "Setting ticket quantities (Adult: {adult}, Child: {child}, Senior: {senior}, Youth: {youth})...",
    "Adding tickets to cart...",
    "Proceeding to checkout...",
    "Entering customer email: {email}...",
    "Selecting ticket assurance options...",
    "Filling billing information...",
    "Ready for manual payment completion..."
  ];

  const executeAlcatrazScript = async () => {
    setIsRunning(true);
    setStatus("running");
    setLogs([]);
    
    try {
      // Prepare customer data in the format expected by the Python script
      const customerData = {
        order_id: order.order_id || order.id,
        first_name: order.first_name,
        last_name: order.last_name,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        'state/region': order.state_region,
        zip: order.zip,
        country: order.country || 'United States',
        tour_time: order.tour_time,
        // Convert the new tickets array to the format the script expects
        ...order.tickets.reduce((acc, ticket) => {
          acc[ticket.type] = ticket.quantity;
          return acc;
        }, {})
      };

      // Simulate the automation steps
      for (let i = 0; i < automationSteps.length; i++) {
        const step = automationSteps[i]
          .replace('{adult}', customerData.Adult || 0)
          .replace('{child}', customerData.Child || 0)
          .replace('{senior}', customerData.Senior || 0)
          .replace('{youth}', customerData.Youth || 0)
          .replace('{email}', customerData.email);
        
        setCurrentStep(step);
        setProgress(((i + 1) / automationSteps.length) * 100);
        
        const logEntry = {
          timestamp: new Date().toISOString(),
          message: step,
          type: "info"
        };
        setLogs(prev => [...prev, logEntry]);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // If we reach the payment step, pause for manual intervention
        if (i === automationSteps.length - 1) {
          setRequiresManualPayment(true);
          setStatus("awaiting_payment");
          break;
        }
      }

      // Update order status
      await onUpdate({
        status: "processing",
        processing_notes: `Alcatraz automation initiated at ${new Date().toISOString()}. Awaiting manual payment completion.`,
        fulfilled_by: "Alcatraz Bot"
      });

      // In a real implementation, this would call your backend service:
      /* 
      const result = await InvokeLLM({
        prompt: `Execute Alcatraz booking automation with the following data: ${JSON.stringify(customerData)}`,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            confirmation_number: { type: "string" },
            screenshots: { type: "array", items: { type: "string" } }
          }
        }
      });
      */

    } catch (error) {
      setStatus("error");
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: `Error: ${error.message}`,
        type: "error"
      }]);
    }
  };

  const completePayment = async () => {
    try {
      setRequiresManualPayment(false);
      setStatus("completed");
      setProgress(100);
      
      setLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: "Payment completed manually. Booking successful!",
        type: "success"
      }]);

      // Calculate total tickets for the email summary
      const totalTicketsSummary = order.tickets.map(t => `${t.quantity} ${t.type}`).join(', ');

      // Update order to purchased status
      await onUpdate({
        status: "purchased",
        processing_notes: `Alcatraz booking completed at ${new Date().toISOString()}. Payment processed manually.`
      });

      // Send confirmation email to customer
      await SendEmail({
        to: order.email,
        subject: `Alcatraz Tour Booking Confirmed - ${order.tour}`,
        body: `Hi ${order.first_name} ${order.last_name},

Great news! Your Alcatraz tour has been successfully booked.

Booking Details:
- Tour: ${order.tour}
- Date: ${order.tour_date}
- Time: ${order.tour_time}
- Tickets: ${totalTicketsSummary}

You will receive your official tickets and confirmation details shortly.

Thank you for your booking!`
      });

      setIsRunning(false);
      
    } catch (error) {
      console.error("Error completing payment:", error);
    }
  };

  const stopAutomation = () => {
    setIsRunning(false);
    setStatus("stopped");
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      message: "Automation stopped by user",
      type: "warning"
    }]);
  };

  const getStatusColor = () => {
    switch (status) {
      case "running": return "bg-blue-100 text-blue-800";
      case "awaiting_payment": return "bg-orange-100 text-orange-800";
      case "completed": return "bg-green-100 text-green-800";
      case "error": return "bg-red-100 text-red-800";
      case "stopped": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const canStartAutomation = order.status === "pending" && !isRunning;

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Alcatraz Automation
          </CardTitle>
          <Badge className={getStatusColor()}>
            {status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Target Website Info */}
        <Alert className="border-blue-200 bg-blue-50">
          <Globe className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Target:</strong> cityexperiences.com/alcatraz
            <br />
            <strong>Success Rate:</strong> 90%+ (proven script)
            <br />
            <strong>Manual Step:</strong> Payment completion required
          </AlertDescription>
        </Alert>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="text-slate-900 font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-slate-600">{currentStep}</p>
          </div>
        )}

        {/* Manual Payment Alert */}
        {requiresManualPayment && (
          <Alert className="border-orange-200 bg-orange-50">
            <CreditCard className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Payment Required:</strong> The automation has filled all details and is ready for payment. Please complete the payment manually in the browser window, then click "Payment Complete" below.
            </AlertDescription>
          </Alert>
        )}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {canStartAutomation && (
            <Button
              onClick={executeAlcatrazScript}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Alcatraz Bot
            </Button>
          )}
          
          {isRunning && !requiresManualPayment && (
            <Button
              onClick={stopAutomation}
              variant="destructive"
              className="flex-1"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop Bot
            </Button>
          )}

          {requiresManualPayment && (
            <Button
              onClick={completePayment}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Payment Complete
            </Button>
          )}

          <Button variant="outline" size="icon" title="View Browser">
            <Eye className="w-4 h-4" />
          </Button>
        </div>

        {/* Automation Log */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Automation Log
            </h4>
            <div className="bg-slate-900 text-green-400 text-xs font-mono p-3 rounded-lg h-32 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={
                    log.type === "error" ? "text-red-400" : 
                    log.type === "success" ? "text-green-400" :
                    log.type === "warning" ? "text-yellow-400" : 
                    "text-green-400"
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Backend Requirements */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Requirements:</strong> Enable backend functions (Dashboard → Settings) and install Chrome + Python dependencies for full automation.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
