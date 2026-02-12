
import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatTourDate } from '../orders/utils';

const statusConfig = {
  new: { color: "bg-red-100 text-red-800", borderColor: "border-red-500" },
  pending: { color: "bg-amber-100 text-amber-800", borderColor: "border-amber-500" },
  "pending-payment": { color: "bg-yellow-100 text-yellow-800", borderColor: "border-yellow-500" },
  "on-hold": { color: "bg-yellow-100 text-yellow-800", borderColor: "border-yellow-500" },
  reserved_date: { color: "bg-purple-100 text-purple-800", borderColor: "border-purple-500" },
  awaiting_reply: { color: "bg-blue-100 text-blue-800", borderColor: "border-blue-500" },
  refunded: { color: "bg-orange-100 text-orange-800", borderColor: "border-orange-500" },
  failed: { color: "bg-red-100 text-red-800", borderColor: "border-red-500" },
  cancelled: { color: "bg-gray-100 text-gray-800", borderColor: "border-gray-500" },
  completed: { color: "bg-green-100 text-green-800", borderColor: "border-green-500" },
  // Keeping existing statuses not explicitly replaced by the outline
  in_progress: { color: "bg-blue-100 text-blue-800", borderColor: "border-blue-500" },
  awaiting_customer_response: { color: "bg-yellow-100 text-yellow-800", borderColor: "border-yellow-500" },
  chargeback: { color: "bg-gray-100 text-gray-800", borderColor: "border-gray-500" },
};

const OrderEvent = ({ order }) => {
  const statusInfo = statusConfig[order.status] || statusConfig.new;
  
  return (
    <Dialog>
        <DialogTrigger asChild>
            <div className={`w-full text-left p-1.5 mb-1 bg-slate-50 hover:bg-slate-100 rounded-md cursor-pointer border-l-4 ${statusInfo.borderColor} transition-colors`}>
                <p className="text-xs font-medium text-slate-800 truncate">{order.tour}</p>
                <p className="text-xs text-slate-500 truncate">{order.first_name} {order.last_name}</p>
                <div className="mt-1">
                  <Badge className={`${statusInfo.color} text-xs py-0 px-1`}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                </div>
            </div>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{order.tour}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                 <p><strong>Customer:</strong> {order.first_name} {order.last_name}</p>
                 <p><strong>Tour Date:</strong> {formatTourDate(order.tour_date, 'PPP')}</p>
                 <p><strong>Status:</strong> <Badge className={statusInfo.color}>{order.status.replace('_', ' ')}</Badge></p>
                 {order.tour_time && <p><strong>Time:</strong> {order.tour_time}</p>}
                 {order.email && <p><strong>Email:</strong> {order.email}</p>}
                 <Link to={createPageUrl(`OrderDetail?id=${order.id}`)}>
                    <Button className="w-full">
                        <Eye className="w-4 h-4 mr-2" /> View Full Order
                    </Button>
                 </Link>
            </div>
        </DialogContent>
    </Dialog>
  );
};

export default function OrderCalendar({ orders, currentDate, setCurrentDate }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <header className="p-4 flex items-center justify-between border-b border-slate-200">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-slate-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </header>

      <div className="grid grid-cols-7">
        {weekdays.map(day => (
          <div key={day} className="text-center font-medium text-slate-600 py-3 border-b border-r border-slate-200">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 h-[70vh]">
        {days.map(day => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          // Correctly filter orders by comparing formatted date strings to avoid timezone issues
          const ordersForDay = orders.filter(order => order.tour_date === format(day, 'yyyy-MM-dd'));

          return (
            <div
              key={day.toString()}
              className={`p-2 border-b border-r border-slate-200 flex flex-col ${isCurrentMonth ? '' : 'bg-slate-50'}`}
            >
              <time
                dateTime={format(day, 'yyyy-MM-dd')}
                className={`text-sm font-medium ${isToday ? 'bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-slate-800'}`}
              >
                {format(day, 'd')}
              </time>
              <div className="mt-2 flex-1 overflow-y-auto">
                {ordersForDay.map(order => (
                  <OrderEvent key={order.id} order={order} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
