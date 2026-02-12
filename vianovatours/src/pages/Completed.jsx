import React, { useState, useEffect, useMemo } from "react";
import { Order } from "@/entities/Order";
import { Tour } from "@/entities/Tour";
import { Button } from "@/components/ui/button";
import { CheckCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import OrdersTable from "../components/dashboard/OrdersTable";

export default function CompletedPage() {
  const [orders, setOrders] = useState([]);
  const [tours, setTours] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tourFilter, setTourFilter] = useState("all");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [orderData, tourData] = await Promise.all([
          Order.filter({ status: "completed" }),
          Tour.list()
        ]);
        setOrders(orderData);
        setTours(tourData);
      } catch (error) {
        console.error("Error loading completed orders:", error);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tour?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (tourFilter !== "all") {
      filtered = filtered.filter(order => order.tour === tourFilter);
    }

    // COMPLETED PAGE: Sort by ORDER DATE (purchase_date), NEWEST FIRST
    return filtered.sort((a, b) => {
      const dateA = new Date(a.purchase_date || a.created_date);
      const dateB = new Date(b.purchase_date || b.created_date);
      return dateB - dateA; // DESCENDING = newest completed order first
    });
  }, [orders, searchTerm, tourFilter]);

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Completed Orders</h1>
            <p className="text-slate-600 mt-1">Sorted by completion date (newest first)</p>
          </div>
        </div>
        
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          className="flex items-center gap-2"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search completed orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Select value={tourFilter} onValueChange={setTourFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Tours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tours</SelectItem>
                  {tours.map(tour => (
                    <SelectItem key={tour.id} value={tour.name}>{tour.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <OrdersTable 
          orders={filteredOrders} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
}