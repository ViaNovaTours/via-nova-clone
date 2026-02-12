import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { User, Calendar, MapPin, Ticket, DollarSign, Globe, Phone, Home, PlusCircle, ExternalLink, CreditCard, CheckCircle, XCircle, AlertTriangle, Clock, Play, Pause, UserX, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const statusConfig = {
  unprocessed: { label: "Unprocessed", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
  "pending-payment": { label: "Pending Payment", color: "bg-yellow-100 text-yellow-800", icon: DollarSign },
  "on-hold": { label: "On Hold", color: "bg-yellow-100 text-yellow-800", icon: Pause },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: XCircle },
  refunded: { label: "Refunded", color: "bg-orange-100 text-orange-800", icon: DollarSign },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: XCircle }
};

const tagConfig = {
  reserved_date: { label: "Reserved Date", color: "bg-purple-100 text-purple-800", icon: Calendar },
  awaiting_reply: { label: "Awaiting Reply", color: "bg-blue-100 text-blue-800", icon: MessageCircle }
};

const priorityConfig = {
  urgent: { color: "bg-red-100 text-red-800", dot: "bg-red-500" },
  high: { color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  normal: { color: "bg-blue-100 text-blue-800", dot: "bg-blue-500" },
  low: { color: "bg-gray-100 text-gray-800", dot: "bg-gray-500" }
};

const paymentStatusConfig = {
  succeeded: { color: "bg-green-100 text-green-800", icon: CheckCircle },
  processing: { color: "bg-blue-100 text-blue-800", icon: Clock },
  pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
  failed: { color: "bg-red-100 text-red-800", icon: XCircle },
  canceled: { color: "bg-gray-100 text-gray-800", icon: XCircle },
  requires_action: { color: "bg-orange-100 text-orange-800", icon: AlertTriangle }
};

export default function OrderHeader({ order }) {
  const { toast } = useToast();
  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const priorityInfo = priorityConfig[order.priority] || priorityConfig.normal;
  const paymentStatusInfo = paymentStatusConfig[order.payment_status] || paymentStatusConfig.processing;

  const getTotalTickets = () => {
    if (!order.tickets) return 0;
    return order.tickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
  };
  
  const formatCurrency = (value, currency) => {
    if (typeof value !== 'number') return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD'
    }).format(value);
  };

  const getWooCommerceAdminUrl = () => {
    if (!order.purchase_url || !order.order_id) return order.purchase_url;
    
    const parts = String(order.order_id).split('-');
    const numericId = parts[parts.length - 1];

    if (!isNaN(numericId) && numericId.trim() !== '') {
        const baseUrl = order.purchase_url.startsWith('http') ? order.purchase_url : `https://${order.purchase_url}`;
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanBaseUrl}/wp-admin/admin.php?page=wc-orders&action=edit&id=${numericId}`;
    }
    
    return order.purchase_url;
  };

  const getPaymentProcessorUrl = () => {
    if (!order.payment_transaction_id || !order.payment_method) return null;

    const txId = order.payment_transaction_id;

    if (order.payment_method === 'stripe') {
      // Use account ID if available for direct payment link
      if (order.payment_account_id) {
        return `https://dashboard.stripe.com/${order.payment_account_id}/payments/${txId}`;
      }
      // Default direct payment link
      return `https://dashboard.stripe.com/payments/${txId}`;
    } else if (order.payment_method === 'airwallex') {
      // Airwallex: payment intents start with "int_"
      if (txId.startsWith('int_')) {
        // Format: https://www.airwallex.com/app/acquiring/list/details/{merchant_id}/{transaction_id}/
        // Using the fixed merchant ID from the example
        const merchantId = '0c291fed-dd27-4e8b-8b98-70dfe4109d0a';
        return `https://www.airwallex.com/app/acquiring/list/details/${merchantId}/${txId}/`;
      }
      // Fallback to acquiring list
      return `https://www.airwallex.com/app/acquiring/list`;
    }

    return null;
  };

  const formatTourDate = (dateString, formatStr = 'MMMM d, yyyy') => {
    if (!dateString) return 'No date set';
    try {
      const date = new Date(`${dateString}T00:00:00`);
      return format(date, formatStr);
    } catch (e) {
      return "Invalid Date";
    }
  };

  const formatPurchaseDate = (dateString, timezone) => {
    if (!dateString) return 'No date';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      if (timezone) {
        return date.toLocaleString('en-US', {
          timeZone: timezone,
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
      
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (e) {
      return "Invalid Date";
    }
  };

  const paymentUrl = getPaymentProcessorUrl();
  const paymentProcessorName = order.payment_method === 'stripe' ? 'Stripe' : order.payment_method === 'airwallex' ? 'Airwallex' : order.payment_method;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl text-slate-900">{order.tour}</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <Badge className={`${statusInfo.color} flex items-center gap-1`}>
              <statusInfo.icon className="w-3 h-3" />
              {statusInfo.label}
            </Badge>
            {order.tags && order.tags.map(tag => {
              const tagInfo = tagConfig[tag];
              if (!tagInfo) return null;
              return (
                <Badge key={tag} className={`${tagInfo.color} flex items-center gap-1`}>
                  <tagInfo.icon className="w-3 h-3" />
                  {tagInfo.label}
                </Badge>
              );
            })}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${priorityInfo.dot}`}></div>
              <span className="text-sm font-medium capitalize">{order.priority}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment Status Section */}
        {order.payment_method && (
          <div className="bg-slate-50 p-4 rounded-lg border-2 border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-slate-500" />
                Payment Information
              </h4>
              <Badge className={paymentStatusInfo.color}>
                <paymentStatusInfo.icon className="w-3 h-3 mr-1" />
                {order.payment_status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Payment Method</p>
                <p className="font-medium capitalize">{order.payment_method}</p>
              </div>
              {order.payment_captured !== undefined && (
                <div>
                  <p className="text-slate-500">Payment Captured</p>
                  <p className={`font-medium ${order.payment_captured ? 'text-green-600' : 'text-orange-600'}`}>
                    {order.payment_captured ? 'Yes' : 'No'}
                  </p>
                </div>
              )}
              {order.payment_fee > 0 && (
                <div>
                  <p className="text-slate-500">Processing Fee</p>
                  <p className="font-medium">{formatCurrency(order.payment_fee, order.currency)}</p>
                </div>
              )}
              {order.payment_net_amount > 0 && (
                <div>
                  <p className="text-slate-500">Net Amount</p>
                  <p className="font-medium">{formatCurrency(order.payment_net_amount, order.currency)}</p>
                </div>
              )}
            </div>
            {paymentUrl && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <a 
                  href={paymentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4"/>
                  View Transaction in {paymentProcessorName} Dashboard
                </a>
                <p className="text-xs text-slate-500 mt-2">Transaction ID: {order.payment_transaction_id}</p>
              </div>
            )}
            {order.payment_transaction_id && !paymentUrl && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">Transaction ID: {order.payment_transaction_id}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-500" />
              <div>
                <p className="font-medium text-slate-900">{order.first_name} {order.last_name}</p>
                <p className="text-sm text-slate-600">{order.email}</p>
              </div>
            </div>

            {order.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">
                    {order.country_code} {order.phone}
                  </p>
                  <p className="text-sm text-slate-600">{order.phone_number_country}</p>
                </div>
              </div>
            )}
            
            {order.venue && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">{order.venue}</p>
                  <p className="text-sm text-slate-600">Venue</p>
                </div>
              </div>
            )}

            {order.purchase_url && (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-500" />
                <div>
                  <a 
                    href={getWooCommerceAdminUrl()} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
                  >
                    View in WooCommerce <ExternalLink className="w-3 h-3"/>
                  </a>
                  <p className="text-sm text-slate-600">Direct link to the order in WP-Admin</p>
                </div>
              </div>
            )}
            
            {order.official_site_url && (
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-500" />
                <div>
                  <a 
                    href={order.official_site_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1"
                  >
                    Official Ticketing Site <ExternalLink className="w-3 h-3"/>
                  </a>
                  <p className="text-sm text-slate-600">Official venue/event website</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Purchase Date/Time Information */}
            <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-4">
              <h4 className="font-medium text-slate-900 flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-blue-500" />
                Order Information
              </h4>
              <div className="space-y-2 text-sm">
                {order.purchase_date_pst && (
                  <div>
                    <p className="text-slate-500">Purchase Date (PST - Your Time)</p>
                    <p className="font-medium text-slate-900">
                      {formatPurchaseDate(order.purchase_date, 'America/Los_Angeles')}
                    </p>
                  </div>
                )}
                {order.purchase_date_tour_tz && order.tour_timezone && (
                  <div>
                    <p className="text-slate-500">Purchase Date (Tour Local Time - {order.tour_timezone.split('/')[1]})</p>
                    <p className="font-medium text-slate-900">
                      {formatPurchaseDate(order.purchase_date, order.tour_timezone)}
                    </p>
                  </div>
                )}
                {order.tour_date && (
                  <div>
                    <p className="text-slate-500">Tour Date</p>
                    <p className="font-medium text-slate-900">
                      {formatTourDate(order.tour_date)}
                      {order.tour_time && ` at ${order.tour_time}`}
                    </p>
                  </div>
                )}
                {order.total_cost && (
                  <div>
                    <p className="text-slate-500">Total Cost</p>
                    <p className="font-bold text-emerald-600 text-lg">
                      {formatCurrency(order.total_cost, order.currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {order.tour_date && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">
                    {formatTourDate(order.tour_date)}
                    {order.tour_time && ` at ${order.tour_time}`}
                  </p>
                  <p className="text-sm text-slate-600">Tour Date & Time</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-slate-500" />
              <div>
                <p className="font-medium text-slate-900">
                  {getTotalTickets()} tickets total
                </p>
                <div className="text-sm text-slate-600 space-y-1">
                  {order.tickets && order.tickets.map(ticket => (
                    <p key={ticket.type}>{ticket.type}: {ticket.quantity}</p>
                  ))}
                </div>
              </div>
            </div>

            {(order.extras && order.extras.length > 0) && (
              <div className="flex items-center gap-3">
                <PlusCircle className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">Add-ons</p>
                  <div className="text-sm text-slate-600 space-y-1">
                    {order.extras.map(extra => (
                      <p key={extra.name}>{extra.name}: {extra.quantity}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {order.budget_max > 0 && (
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-900">
                    {formatCurrency(order.budget_max, order.currency)}/ticket max
                  </p>
                  <p className="text-sm text-slate-600">Budget Limit</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tour Payment Card Information */}
        {(order.tour_card_number || order.tour_card_expiry || order.tour_card_cvv) && (
          <div className="bg-amber-50 p-4 rounded-lg border-2 border-amber-200">
            <h4 className="font-medium text-slate-900 flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-amber-600" />
              Tour Processing Card
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {order.tour_card_number && (
                <div>
                  <p className="text-slate-500">Card Number</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium">{order.tour_card_number}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(order.tour_card_number);
                        toast({ title: "Copied!", description: "Card number copied to clipboard" });
                      }}
                      className="h-6 px-2"
                    >
                      📋
                    </Button>
                  </div>
                </div>
              )}
              {order.tour_card_expiry && (
                <div>
                  <p className="text-slate-500">Expiry</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium">{order.tour_card_expiry}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(order.tour_card_expiry);
                        toast({ title: "Copied!", description: "Expiry date copied" });
                      }}
                      className="h-6 px-2"
                    >
                      📋
                    </Button>
                  </div>
                </div>
              )}
              {order.tour_card_cvv && (
                <div>
                  <p className="text-slate-500">CVV</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-medium">{order.tour_card_cvv}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(order.tour_card_cvv);
                        toast({ title: "Copied!", description: "CVV copied" });
                      }}
                      className="h-6 px-2"
                    >
                      📋
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {(order.address || order.city || order.state_region) && (
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-start gap-3">
              <Home className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 mb-1">Address</p>
                <div className="text-sm text-slate-600 space-y-1">
                  {order.address && <p>{order.address}</p>}
                  <p>
                    {order.city && order.city}
                    {order.city && order.state_region && ", "}
                    {order.state_region && order.state_region}
                    {order.zip && ` ${order.zip}`}
                  </p>
                  {order.country && <p>{order.country}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {order.special_instructions && (
          <div className="pt-4 border-t border-slate-200">
            <h4 className="font-medium text-slate-900 mb-2">Special Instructions</h4>
            <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">
              {order.special_instructions}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}