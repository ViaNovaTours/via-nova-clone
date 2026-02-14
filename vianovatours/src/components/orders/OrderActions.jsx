import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  CheckCircle, 
  MessageCircle, 
  FileText,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  XCircle,
  AlertTriangle,
  UserX,
  Pause,
  UserCheck,
  Loader2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

const statusConfig = {
  unprocessed: { 
    color: "bg-red-100 text-red-800", 
    label: "Unprocessed", 
    icon: AlertCircle,
    description: "Order needs immediate attention"
  },
  pending: {
    color: "bg-amber-100 text-amber-800",
    label: "Pending",
    icon: Clock,
    description: "Order is pending"
  },
  "pending-payment": {
    color: "bg-yellow-100 text-yellow-800",
    label: "Pending Payment",
    icon: DollarSign,
    description: "Awaiting payment confirmation"
  },
  "on-hold": {
    color: "bg-yellow-100 text-yellow-800",
    label: "On Hold",
    icon: Pause,
    description: "Order is on hold and needs review"
  },
  completed: { 
    color: "bg-green-100 text-green-800", 
    label: "Completed", 
    icon: CheckCircle,
    description: "Order successfully completed"
  },
  cancelled: {
    color: "bg-gray-100 text-gray-800",
    label: "Cancelled",
    icon: XCircle,
    description: "Order was cancelled"
  },
  refunded: { 
    color: "bg-orange-100 text-orange-800", 
    label: "Refunded", 
    icon: DollarSign,
    description: "Order has been refunded"
  },
  failed: { 
    color: "bg-red-100 text-red-800", 
    label: "Failed", 
    icon: XCircle,
    description: "Order could not be completed"
  }
};

const tagConfig = {
  reserved_date: { 
    color: "bg-purple-100 text-purple-800", 
    label: "Reserved Date", 
    icon: Calendar
  },
  awaiting_reply: {
    color: "bg-blue-100 text-blue-800",
    label: "Awaiting Reply",
    icon: MessageCircle
  }
};

const vaNames = ["Kat", "Edelyn", "Ben"];

export default function OrderActions({ order, onUpdate }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [newStatus, setNewStatus] = useState(order.status);
  const [fulfilledBy, setFulfilledBy] = useState(order.fulfilled_by || "");
  const [selectedTags, setSelectedTags] = useState(order.tags || []);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedTags(order.tags || []);
  }, [order.tags]);

  const handleStatusChange = async (status) => {
    setIsProcessing(true);
    try {
      await onUpdate({ 
        status: status, 
        updated_date: new Date().toISOString()
      });
      setNewStatus(status);
    } catch (error) {
      console.error(`Error updating status to ${status}:`, error);
      alert("Failed to update status. Please try again.");
    }
    setIsProcessing(false);
  };

  const handleSendMessage = async () => {
    if (!emailMessage.trim()) return;

    try {
      const newCommunication = [
        ...(order.customer_communication || []),
        {
          timestamp: new Date().toISOString(),
          message: emailMessage,
          sent_by: "VA Assistant"
        }
      ];

      await onUpdate({ customer_communication: newCommunication });
      setEmailMessage("");
    } catch (error) {
      console.error("Error updating communication:", error);
    }
  };

  const handleDeleteNote = async (index) => {
    try {
      const newCommunication = [...(order.customer_communication || [])];
      newCommunication.splice(index, 1);
      await onUpdate({ customer_communication: newCommunication });
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  const currentStatusInfo = statusConfig[order.status] || statusConfig.unprocessed;

  const toggleTag = async (tag) => {
    if (isSavingTags) return;

    const previousTags = selectedTags;
    const newTags = previousTags.includes(tag)
      ? previousTags.filter(t => t !== tag)
      : [...previousTags, tag];

    setSelectedTags(newTags);
    setIsSavingTags(true);
    try {
      await onUpdate({ tags: newTags });
    } catch (error) {
      console.error("Error updating tags:", error);
      setSelectedTags(previousTags);
      toast({
        title: "Failed to save tags",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingTags(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            VA Assignment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-slate-700 font-medium">Fulfilled By</Label>
           <Select value={fulfilledBy} onValueChange={setFulfilledBy}>
              <SelectTrigger>
                <SelectValue placeholder="Assign a VA..."/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>
                    <span className="text-slate-500">Unassigned</span>
                </SelectItem>
                {vaNames.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
                onClick={() => onUpdate({ fulfilled_by: fulfilledBy })}
                disabled={fulfilledBy === order.fulfilled_by}
                className="w-full"
                variant="outline"
              >
                Save Assignee
            </Button>
        </CardContent>
      </Card>
      
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <currentStatusInfo.icon className="w-5 h-5" />
            Order Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <currentStatusInfo.icon className="w-5 h-5 text-slate-600" />
              <div>
                <Badge className={currentStatusInfo.color}>
                  {currentStatusInfo.label}
                </Badge>
                <p className="text-sm text-slate-600 mt-1">
                  {currentStatusInfo.description}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-slate-700 font-medium">Change Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <config.icon className="w-4 h-4" />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {newStatus !== order.status && (
              <Button
                onClick={() => handleStatusChange(newStatus)}
                disabled={isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Update to {statusConfig[newStatus]?.label}
                  </>
                )}
              </Button>
            )}
          </div>

          {order.status === "unprocessed" && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Action Required:</strong> This order needs immediate attention.
              </AlertDescription>
            </Alert>
          )}

          {order.status === "pending" && (
            <Alert className="border-amber-200 bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Pending:</strong> This order is pending. Review for further action.
              </AlertDescription>
            </Alert>
          )}

          {order.status === "pending-payment" && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Pending Payment:</strong> Awaiting payment confirmation for this order.
              </AlertDescription>
            </Alert>
          )}

          {order.status === "on-hold" && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <Pause className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>On Hold:</strong> This order is currently on hold. Review notes for details.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Order Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {Object.entries(tagConfig).map(([key, config]) => (
              <div
                key={key}
                onClick={() => toggleTag(key)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSavingTags ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                } ${
                  selectedTags.includes(key)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <config.icon className="w-5 h-5 text-slate-600" />
                    <span className="font-medium text-slate-900">{config.label}</span>
                  </div>
                  {selectedTags.includes(key) && (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2">
            {isSavingTags ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving tags...
              </>
            ) : (
              "Tag changes save automatically."
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Internal Communication Log
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Note:</strong> This is for internal VA notes only. Customer emails must be sent through external systems.
            </AlertDescription>
          </Alert>
          
          {order.customer_communication && order.customer_communication.length > 0 && (
            <div className="space-y-2 mb-4">
              {order.customer_communication.map((comm, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-slate-900">{comm.message}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(comm.timestamp).toLocaleString()} - {comm.sent_by}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteNote(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Textarea
            value={emailMessage}
            onChange={(e) => setEmailMessage(e.target.value)}
            placeholder="Add internal communication note..."
            rows={4}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!emailMessage.trim()}
            variant="outline"
            className="w-full"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Add Internal Note
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}