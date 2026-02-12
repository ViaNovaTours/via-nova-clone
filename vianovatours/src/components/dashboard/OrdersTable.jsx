import React from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Play, Clock, Ticket, AlertCircle, Calendar, DollarSign, XCircle, UserX, AlertTriangle, CheckCircle, Pause, UserCheck, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatTourDate } from "../orders/utils";

const statusConfig = {
  new: { color: "bg-red-100 text-red-800", icon: AlertCircle },
  pending: { color: "bg-amber-100 text-amber-800", icon: Clock },
  "pending-payment": { color: "bg-yellow-100 text-yellow-800", icon: DollarSign },
  "on-hold": { color: "bg-yellow-100 text-yellow-800", icon: Pause },
  completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { color: "bg-gray-100 text-gray-800", icon: XCircle },
  refunded: { color: "bg-orange-100 text-orange-800", icon: DollarSign },
  failed: { color: "bg-red-100 text-red-800", icon: XCircle },
  reserved_date: { color: "bg-purple-100 text-purple-800", icon: Calendar },
  awaiting_reply: { color: "bg-blue-100 text-blue-800", icon: AlertTriangle }
};

const priorityConfig = {
  urgent: { color: "bg-red-100 text-red-800", dot: "bg-red-500" },
  high: { color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  normal: { color: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  low: { color: "bg-gray-100 text-gray-800", dot: "bg-gray-500" }
};

export default function OrdersTable({ orders, isLoading, onOrderUpdate, selectedOrders, onSelectAll, onSelectOrder, siteUrls }) {
  const getTotalTickets = (order) => {
    if (order.tickets && order.tickets.length > 0) {
      return order.tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
    }
    return (order.adult_tickets || 0) + (order.child_tickets || 0) + (order.senior_tickets || 0);
  };

  const getTicketBreakdown = (order) => {
    if (order.tickets && order.tickets.length > 0) {
      return order.tickets
        .map(t => `${t.type.charAt(0).toUpperCase()}:${t.quantity}`)
        .join(' ');
    }
    const oldTotal = (order.adult_tickets || 0) + (order.child_tickets || 0) + (order.senior_tickets || 0);
    if (oldTotal > 0) {
      const parts = [];
      if (order.adult_tickets > 0) parts.push(`A:${order.adult_tickets}`);
      if (order.child_tickets > 0) parts.push(`C:${order.child_tickets}`);
      if (order.senior_tickets > 0) parts.push(`S:${order.senior_tickets}`);
      return parts.join(' ');
    }
    return "";
  };

  const getWooCommerceOrderUrl = (orderId, siteUrls) => {
    if (!orderId || !orderId.includes('-')) return null;
    
    const [siteName, wooOrderId] = orderId.split('-');
    const siteUrl = siteUrls[siteName];
    
    if (!siteUrl || !wooOrderId) return null;
    
    return `${siteUrl}/wp-admin/post.php?post=${wooOrderId}&action=edit`;
  };

  const allSelected = orders.length > 0 && orders.every(o => selectedOrders?.has(o.id));
  const someSelected = orders.some(o => selectedOrders?.has(o.id)) && !allSelected;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Clock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <h3 className="text-base font-medium text-slate-200 mb-2">No orders found</h3>
        <p className="text-slate-400 text-sm">Start by creating your first order</p>
        <Link to={createPageUrl("NewOrder")}>
          <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-sm">
            Create Order
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800 border-slate-700">
              <TableHead className="w-8 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={input => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => onSelectAll?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 bg-slate-700"
                />
              </TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Order ID</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Customer</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Tour</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Tickets</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Status</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Tags</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Assigned VA</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Order Date</TableHead>
              <TableHead className="font-semibold text-slate-300 text-[11px] py-1.5">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const statusInfo = statusConfig[order.status] || statusConfig.new;
              const isSelected = selectedOrders?.has(order.id);
              const wooCommerceUrl = getWooCommerceOrderUrl(order.order_id, siteUrls);
              
              return (
                <TableRow key={order.id} className={`hover:bg-slate-700 transition-colors border-b border-slate-700 ${isSelected ? 'bg-slate-700' : ''}`}>
                  <TableCell className="py-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectOrder?.(order.id, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 bg-slate-700"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-[11px] py-1 text-slate-300">
                    {wooCommerceUrl ? (
                      <a
                        href={wooCommerceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                      >
                        {order.order_id || `#${order.id.slice(-6)}`}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : (
                      <span>{order.order_id || `#${order.id.slice(-6)}`}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1">
                    <div>
                      <p className="font-medium text-slate-200 text-[11px] leading-snug">{order.first_name} {order.last_name}</p>
                      <p className="text-[10px] text-slate-400 leading-snug truncate max-w-[150px]">{order.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div>
                      <p className="font-medium text-slate-200 text-[11px] leading-snug">{order.tour}</p>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {order.tour_date && formatTourDate(order.tour_date, "MMM d, yyyy")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="flex items-center gap-0.5">
                      <Ticket className="w-2.5 h-2.5 text-slate-400" />
                      <span className="font-medium text-[11px] text-slate-300">{getTotalTickets(order)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">
                      {getTicketBreakdown(order)}
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                    <Badge className={`${statusInfo.color} text-[10px] px-1.5 py-0`}>
                      {order.status?.replace('_', ' ').replace('-', ' ') || 'New'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1">
                    <div className="flex flex-wrap gap-0.5">
                      {order.tags?.includes('reserved_date') && (
                        <Badge className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0">
                          🗓️
                        </Badge>
                      )}
                      {order.tags?.includes('awaiting_reply') && (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">
                          💬
                        </Badge>
                      )}
                      {(!order.tags || order.tags.length === 0) && (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1">
                     {order.fulfilled_by && ["Kat", "Edelyn", "Ben"].includes(order.fulfilled_by) ? (
                          <Badge variant="secondary" className="flex items-center gap-1 text-[10px] px-1.5 py-0">
                              <UserCheck className="w-2.5 h-2.5" />
                              {order.fulfilled_by}
                          </Badge>
                      ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                      )}
                  </TableCell>
                  <TableCell className="text-slate-400 text-[11px] py-1 whitespace-nowrap">
                    {order.purchase_date 
                      ? format(new Date(order.purchase_date), "MMM d, h:mm a") 
                      : format(new Date(order.created_date), "MMM d, h:mm a")
                    }
                  </TableCell>
                  <TableCell className="py-1">
                    <Link to={createPageUrl(`OrderDetail?id=${order.id}`)}>
                      <Button variant="outline" size="sm" className="text-slate-300 hover:text-white border-slate-600 hover:bg-slate-700 h-5 w-5 p-0">
                        <Eye className="w-2.5 h-2.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3 p-4">
        {orders.map((order) => {
          const statusInfo = statusConfig[order.status] || statusConfig.new;
          const isSelected = selectedOrders?.has(order.id);
          const wooCommerceUrl = getWooCommerceOrderUrl(order.order_id, siteUrls);

          return (
            <div
              key={order.id}
              className={`border border-slate-700 rounded-lg p-4 ${isSelected ? 'bg-slate-700 border-emerald-600' : 'bg-slate-800'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectOrder?.(order.id, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 text-emerald-600 focus:ring-emerald-500 mt-1 bg-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-slate-200 text-sm">
                        {order.first_name} {order.last_name}
                      </p>
                      <Badge className={`${statusInfo.color} text-xs px-1.5 py-0.5`}>
                        {order.status?.replace('_', ' ').replace('-', ' ')}
                      </Badge>
                      {order.tags?.includes('reserved_date') && (
                        <Badge className="bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5">
                          🗓️ Reserved
                        </Badge>
                      )}
                      {order.tags?.includes('awaiting_reply') && (
                        <Badge className="bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                          💬 Awaiting Reply
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{order.email}</p>
                  </div>
                </div>
                <Link to={createPageUrl(`OrderDetail?id=${order.id}`)}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Tour:</span>
                  <span className="font-medium text-slate-200 text-right">{order.tour}</span>
                </div>
                {order.tour_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tour Date:</span>
                    <span className="font-medium text-slate-200">{formatTourDate(order.tour_date, "MMM d, yyyy")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Tickets:</span>
                  <span className="font-medium text-slate-200">{getTotalTickets(order)} ({getTicketBreakdown(order)})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Order ID:</span>
                  {wooCommerceUrl ? (
                    <a
                      href={wooCommerceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-medium flex items-center gap-1"
                    >
                      {order.order_id || `#${order.id.slice(-6)}`}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="font-medium text-slate-200">{order.order_id || `#${order.id.slice(-6)}`}</span>
                  )}
                  </div>
                  {order.fulfilled_by && ["Kat", "Edelyn", "Ben"].includes(order.fulfilled_by) && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned:</span>
                    <Badge variant="secondary" className="text-xs">
                      <UserCheck className="w-3 h-3 mr-1" />
                      {order.fulfilled_by}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}