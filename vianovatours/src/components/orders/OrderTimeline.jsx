import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, CheckCircle, AlertTriangle, Users, Download } from "lucide-react";

export default function OrderTimeline({ order }) {
  const getTimelineEvents = () => {
    const events = [];

    // Order Created Event
    events.push({
      title: "Order Imported",
      description: `Order from ${order.first_name} ${order.last_name} imported from WooCommerce`,
      timestamp: order.created_date,
      status: "completed",
      icon: CheckCircle
    });

    // Only add processing events if status indicates they actually happened
    if (order.status === "processing") {
      events.push({
        title: "Processing Started", 
        description: "Order is being processed",
        timestamp: order.updated_date,
        status: "current",
        icon: Clock
      });
    }

    if (order.status === "purchased") {
      events.push({
        title: "Processing Started",
        description: "Order processing initiated", 
        timestamp: order.updated_date,
        status: "completed",
        icon: CheckCircle
      });
      
      events.push({
        title: "Tickets Purchased",
        description: `Purchase completed${order.total_cost ? ` - Total: €${order.total_cost}` : ''}`,
        timestamp: order.updated_date,
        status: "current",
        icon: CheckCircle
      });
    }

    if (order.status === "confirmed") {
      events.push({
        title: "Processing Started",
        description: "Order processing initiated",
        timestamp: order.updated_date, 
        status: "completed",
        icon: CheckCircle
      });
      
      events.push({
        title: "Tickets Purchased", 
        description: `Purchase completed${order.total_cost ? ` - Total: €${order.total_cost}` : ''}`,
        timestamp: order.updated_date,
        status: "completed", 
        icon: CheckCircle
      });
      
      events.push({
        title: "Order Confirmed",
        description: "Confirmation received and processed",
        timestamp: order.updated_date,
        status: "current",
        icon: CheckCircle
      });
    }

    if (order.status === "delivered") {
      events.push({
        title: "Processing Started",
        description: "Order processing initiated",
        timestamp: order.updated_date,
        status: "completed", 
        icon: CheckCircle
      });
      
      events.push({
        title: "Tickets Purchased",
        description: `Purchase completed${order.total_cost ? ` - Total: €${order.total_cost}` : ''}`, 
        timestamp: order.updated_date,
        status: "completed",
        icon: CheckCircle
      });
      
      events.push({
        title: "Order Confirmed", 
        description: "Confirmation received and processed",
        timestamp: order.updated_date,
        status: "completed",
        icon: CheckCircle
      });
      
      events.push({
        title: "Tickets Delivered",
        description: "Customer received final tickets",
        timestamp: order.updated_date,
        status: "completed", 
        icon: CheckCircle
      });
    }

    if (order.status === "failed") {
      events.push({
        title: "Processing Failed",
        description: "Unable to complete purchase",
        timestamp: order.updated_date,
        status: "error",
        icon: AlertTriangle
      });
    }

    if (order.status === "cancelled") {
      events.push({
        title: "Order Cancelled", 
        description: "Order was cancelled",
        timestamp: order.updated_date,
        status: "error",
        icon: AlertTriangle
      });
    }

    return events;
  };

  const events = getTimelineEvents();

  const getStatusColor = (status) => {
    switch (status) {
      case "completed": return "bg-emerald-500";
      case "current": return "bg-blue-500";
      case "error": return "bg-red-500";
      default: return "bg-slate-300";
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed": return "bg-emerald-100 text-emerald-800";
      case "current": return "bg-blue-100 text-blue-800";
      case "error": return "bg-red-100 text-red-800";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Order Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {events.map((event, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(event.status)}`}></div>
                {index < events.length - 1 && (
                  <div className="w-px h-12 bg-slate-200 mt-2"></div>
                )}
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-slate-900">{event.title}</h4>
                  <Badge className={getStatusBadge(event.status)}>
                    {event.status === "current" ? "In Progress" : event.status}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                <p className="text-xs text-slate-500">
                  {format(new Date(event.timestamp), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Communication Log */}
        {(order.customer_communication?.length || 0) > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recent Communications
            </h4>
            <div className="space-y-3">
              {order.customer_communication.slice(-3).map((comm, index) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-sm">{comm.sent_by}</span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(comm.timestamp), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{comm.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}