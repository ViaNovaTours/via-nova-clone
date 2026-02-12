import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock, MessageCircle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function QuickActions() {
  const actions = [
    {
      title: "New Order",
      description: "Create a new ticket order",
      icon: Plus,
      url: "NewOrder",
      color: "bg-emerald-600 hover:bg-emerald-700"
    },
    {
      title: "Processing Queue",
      description: "View orders in processing",
      icon: Clock,
      url: "Processing",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: "Communication",
      description: "Customer messages",
      icon: MessageCircle,
      url: "Communication",
      color: "bg-purple-600 hover:bg-purple-700"
    }
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, index) => (
          <Link key={index} to={createPageUrl(action.url)}>
            <Button 
              className={`w-full justify-start text-white ${action.color} h-auto p-4`}
              variant="default"
            >
              <action.icon className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-medium">{action.title}</p>
                <p className="text-xs opacity-90">{action.description}</p>
              </div>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}