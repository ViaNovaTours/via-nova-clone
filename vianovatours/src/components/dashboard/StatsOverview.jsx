import React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StatsOverview({ orders, isLoading, onStatusClick }) {
  const getStats = () => {
    if (!orders.length) return { all: 0, unprocessed: 0, reserved: 0, awaiting: 0, priority: 0, next30Days: 0 };

    const allOrders = orders.length;
    const unprocessedOrders = orders.filter(o => o.status === 'unprocessed').length;
    const reservedOrders = orders.filter(o => o.tags && o.tags.includes('reserved_date')).length;
    const awaitingOrders = orders.filter(o => o.tags && o.tags.includes('awaiting_reply')).length;
    
    // Priority orders: unprocessed with tour_date within next 72 hours (including today)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const next72Hours = new Date(today.getTime() + 72 * 60 * 60 * 1000);
    const priorityOrders = orders.filter(o => {
      if (o.status !== 'unprocessed' || !o.tour_date) return false;
      const tourDate = new Date(o.tour_date);
      const tourDay = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate());
      return tourDay >= today && tourDay < next72Hours;
    }).length;
    
    // Next 30 days: unprocessed orders with tour_date within next 30 days
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const next30DaysOrders = orders.filter(o => {
      if (o.status !== 'unprocessed' || !o.tour_date) return false;
      const tourDate = new Date(o.tour_date);
      const tourDay = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate());
      return tourDay >= today && tourDay < next30Days;
    }).length;
    
    return { all: allOrders, unprocessed: unprocessedOrders, reserved: reservedOrders, awaiting: awaitingOrders, priority: priorityOrders, next30Days: next30DaysOrders };
  };

  const stats = getStats();

  const statCards = [
    {
      title: "All Orders",
      value: stats.all,
      color: "text-slate-300",
      borderColor: "border-slate-700",
      status: "all"
    },
    {
      title: "Unprocessed Orders",
      value: stats.unprocessed,
      color: "text-red-400",
      borderColor: "border-red-900",
      status: "unprocessed"
    },
    {
      title: "Priority Orders (Next 72 Hours)",
      value: stats.priority,
      color: "text-yellow-400",
      borderColor: "border-yellow-900",
      status: "priority"
    },
    {
      title: "Orders in Next 30 Days",
      value: stats.next30Days,
      color: "text-orange-400",
      borderColor: "border-orange-900",
      status: "next_30_days"
    },
    {
      title: "Reserved Dates",
      value: stats.reserved,
      color: "text-purple-400",
      borderColor: "border-purple-900",
      status: "tag:reserved_date"
    },
    {
      title: "Awaiting Reply",
      value: stats.awaiting,
      color: "text-blue-400",
      borderColor: "border-blue-900",
      status: "tag:awaiting_reply"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-6">
      {statCards.map((stat, index) => (
        <Card 
          key={index} 
          className={`p-4 md:p-6 ${stat.borderColor} border-2 bg-slate-800 cursor-pointer hover:bg-slate-750 transition-all duration-200`}
          onClick={() => onStatusClick(stat.status)}
        >
          <p className="text-xs md:text-sm font-medium text-slate-400 mb-2">{stat.title}</p>
          {isLoading ? (
            <Skeleton className="h-8 md:h-10 w-16 md:w-20 bg-slate-700" />
          ) : (
            <p className={`text-2xl md:text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}