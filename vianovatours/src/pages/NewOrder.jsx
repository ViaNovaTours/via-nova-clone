import React, { useState } from "react";
import { Order } from "@/entities/Order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import OrderForm from "../components/orders/OrderForm";

export default function NewOrder() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (orderData) => {
    setIsSubmitting(true);
    try {
      // Generate order ID if not provided
      const finalOrderData = {
        ...orderData,
        order_id: orderData.order_id || `ORD-${Date.now()}`,
        status: "pending",
        fulfilled_by: "VA Assistant",
        purchase_date: new Date().toISOString()
      };
      
      await Order.create(finalOrderData);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Error creating order:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(createPageUrl("Dashboard"))}
          className="hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">New Order</h1>
          <p className="text-slate-600 mt-1">Create a new tour booking order</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b border-slate-200">
          <CardTitle className="text-slate-900">Order Details</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <OrderForm 
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}