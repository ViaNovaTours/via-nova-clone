
import React, { useState, useEffect, useMemo } from 'react';
import { Order } from '@/entities/Order';
import { Tour } from '@/entities/Tour';
import OrderCalendar from '../components/calendar/OrderCalendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';

export default function CalendarPage() {
  const [orders, setOrders] = useState([]);
  const [tours, setTours] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("new,reserved_date,awaiting_reply"); // Updated default
  const [tourFilter, setTourFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all orders with a valid tour_date
        const allOrders = await Order.list();
        const eventOrders = allOrders.filter(o => o.tour_date);
        setOrders(eventOrders);

        // Fetch tours for filtering
        const tourData = await Tour.list();
        setTours(tourData);
      } catch (error) {
        console.error("Error fetching data for calendar:", error);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    let filtered = orders.map(order => ({
      ...order,
      calculated_priority: order.tour_date ? 
        (() => {
          const days = Math.ceil((new Date(order.tour_date) - new Date()) / (1000 * 60 * 60 * 24));
          if (days <= 1) return "urgent";
          if (days <= 3) return "high";
          if (days <= 7) return "normal";
          return "low";
        })() : "low",
    }));

    if (searchTerm) {
      filtered = filtered.filter(order =>
        `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tour?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      const statuses = statusFilter.split(',');
      filtered = filtered.filter(order => statuses.includes(order.status));
    }

    if (tourFilter !== "all") {
      filtered = filtered.filter(order => order.tour === tourFilter);
    }

    return filtered;
  }, [orders, searchTerm, statusFilter, tourFilter]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <CalendarIcon className="w-8 h-8 text-slate-700" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tour Calendar</h1>
          <p className="text-slate-600 mt-1">
            Monthly overview of scheduled tours filtered by status.
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search orders by customer, tour, order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new,reserved_date,awaiting_reply">Active Orders</SelectItem>
                <SelectItem value="new">New Only</SelectItem>
                <SelectItem value="reserved_date">Reserved Only</SelectItem>
                <SelectItem value="awaiting_reply">Awaiting Reply</SelectItem> {/* Added */}
                <SelectItem value="in_progress">In Progress</SelectItem> {/* Preserved from original */}
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="awaiting_customer_response">Awaiting Response</SelectItem> {/* Preserved from original */}
                <SelectItem value="chargeback">Chargeback</SelectItem> {/* Preserved from original */}
                <SelectItem value="completed">Completed</SelectItem> {/* Changed from "complete" */}
              </SelectContent>
            </Select>

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

        {/* Results Summary */}
        <div className="mt-4 flex items-center gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>
              Showing {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} 
              {statusFilter !== 'all' && statusFilter === 'new,reserved_date,awaiting_reply' && ` (Active Orders)`} {/* Updated */}
              {statusFilter !== 'all' && !statusFilter.includes(',') && ` with status: ${statusFilter.replace(/_/g, ' ')}`}
              {tourFilter !== 'all' && ` for tour: ${tourFilter}`}
            </span>
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between mb-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-24" />
            </div>
            <Skeleton className="h-[600px] w-full" />
        </div>
      ) : (
        <OrderCalendar
          orders={filteredOrders}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />
      )}
    </div>
  );
}
