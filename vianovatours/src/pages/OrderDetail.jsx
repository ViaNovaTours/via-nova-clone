import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, CheckCircle, AlertTriangle, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";

import OrderHeader from "../components/orders/OrderHeader";
import OrderActions from "../components/orders/OrderActions";
import OrderTimeline from "../components/orders/OrderTimeline";
import CustomerCommunication from "../components/orders/CustomerCommunication";
import TicketFiles from "../components/orders/TicketFiles"; 
import TicketCosting from "../components/orders/TicketCosting";
import QuickTicketEdit from "../components/orders/QuickTicketEdit";
import OrderForm from "../components/orders/OrderForm";
import EmailThreads from "../components/orders/EmailThreads";

export default function OrderDetail() {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');

  const loadOrder = useCallback(async ({ showLoader = true } = {}) => {
    if (!orderId) return;
    
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const orders = await base44.entities.Order.filter({ id: orderId });
      if (orders.length > 0) {
        const orderData = orders[0];
        
        // Fetch tour data to get official_ticketing_url and payment card info
        if (orderData.tour) {
          try {
            const allTours = await base44.entities.Tour.list();
            
            // Try exact match first (case-insensitive)
            let matchingTour = allTours.find(t => t.name.toLowerCase() === orderData.tour.toLowerCase());
            
            // If no exact match, try removing " Tour" suffix from order name
            if (!matchingTour) {
              const tourNameWithoutSuffix = orderData.tour.replace(/ Tour$/i, '');
              matchingTour = allTours.find(t => t.name.toLowerCase() === tourNameWithoutSuffix.toLowerCase());
            }
            
            if (matchingTour) {
              if (matchingTour.official_ticketing_url) {
                orderData.official_site_url = matchingTour.official_ticketing_url;
              }
              // Attach tour card info
              orderData.tour_card_number = matchingTour.card_number;
              orderData.tour_card_expiry = matchingTour.card_expiry;
              orderData.tour_card_cvv = matchingTour.card_cvv;
            }
          } catch (tourError) {
            console.log("Error fetching tour data:", tourError);
          }
        }
        
        setOrder(orderData);
      }
    } catch (error) {
      console.error("Error loading order:", error);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder({ showLoader: true });
  }, [loadOrder]);

  const handleUpdateSubmit = async (updates) => {
    setIsSubmitting(true);
    try {
      await base44.entities.Order.update(order.id, updates);
      await loadOrder(); // Re-fetch the order to ensure all data is fresh
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrderUpdate = async (updates) => {
    try {
      const updated = await base44.entities.Order.update(order.id, updates);
      await loadOrder({ showLoader: false });
      return updated;
    } catch (error) {
      console.error("Error updating order:", error);
      // Add user-friendly error handling
      alert("Failed to update order. Please try again.");
      throw error;
    }
  };

  const getDisplayOrderId = (order) => {
    // Extract WooCommerce order number from order_id
    if (order?.order_id && order.order_id.includes('-')) {
      const parts = order.order_id.split('-');
      return `#${parts[parts.length - 1]}`;
    }
    return order?.order_id || `#${order?.id?.slice(-6)}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Order Not Found</h2>
        <p className="text-slate-600 mb-4">The order you're looking for doesn't exist.</p>
        <Button onClick={() => navigate(createPageUrl("Dashboard"))}>
          Back to Dashboard
        </Button>
      </div>
    );
  }
  
  if (isEditing) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Pencil className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Edit Order {getDisplayOrderId(order)}</h1>
            <p className="text-slate-600 mt-1">Update the order details below.</p>
          </div>
        </div>
        <OrderForm 
          initialData={order}
          onSubmit={handleUpdateSubmit}
          isSubmitting={isSubmitting}
          onCancel={() => setIsEditing(false)}
          mode="edit"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Order {getDisplayOrderId(order)}
            </h1>
            <p className="text-slate-600 mt-1">Manage and process this order</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit Order
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OrderHeader order={order} />
          <OrderTimeline order={order} />
          <EmailThreads customerEmail={order.email} />
          <TicketFiles
            order={order}
            onUpdate={handleOrderUpdate}
            onRefresh={() => loadOrder({ showLoader: false })}
          />
          <CustomerCommunication 
            order={order} 
            onUpdate={handleOrderUpdate}
          />
        </div>

        <div className="space-y-6">
          <OrderActions 
            order={order} 
            onUpdate={handleOrderUpdate}
          />
          <QuickTicketEdit
            order={order}
            onUpdate={handleOrderUpdate}
          />
          <TicketCosting
            order={order}
            onUpdate={handleOrderUpdate}
          />
        </div>
      </div>
    </div>
  );
}