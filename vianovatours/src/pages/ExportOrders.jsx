import React, { useState, useEffect } from "react";
import { Order } from "@/entities/Order";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";

// Exchange rates (you can update these periodically)
const EXCHANGE_RATES = {
  'USD': 1,
  'EUR': 1.09,  // 1 EUR = 1.09 USD
  'RON': 0.22   // 1 RON = 0.22 USD
};

export default function ExportOrdersPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        if (currentUser.role !== 'admin') {
          window.location.href = '/Dashboard';
          return;
        }
        
        const orderData = await Order.list();
        setOrders(orderData);
      } catch (error) {
        console.error("Error loading data:", error);
      }
      setIsLoading(false);
    };
    
    checkAccess();
  }, []);

  const convertToUSD = (amount, currency) => {
    const rate = EXCHANGE_RATES[currency] || 1;
    return (amount * rate).toFixed(2);
  };

  const exportToCSV = () => {
    setIsExporting(true);
    
    try {
      // CSV Headers
      const headers = [
        'Order ID',
        'Tour',
        'Tour Date',
        'Tour Time',
        'Status',
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Country Code',
        'Total Spent',
        'Currency',
        'Total Spent (USD)',
        'Address',
        'City',
        'State/Region',
        'Zip',
        'Country',
        'Tickets',
        'Priority',
        'Purchase Date',
        'Venue',
        'Fulfilled By',
        'Special Instructions'
      ];

      // Build CSV rows
      const rows = orders.map(order => {
        const ticketsInfo = order.tickets 
          ? order.tickets.map(t => `${t.type}:${t.quantity}`).join('; ')
          : '';
        
        return [
          order.order_id || '',
          order.tour || '',
          order.tour_date || '',
          order.tour_time || '',
          order.status || '',
          order.first_name || '',
          order.last_name || '',
          order.email || '',
          order.phone || '',
          order.country_code || '',
          order.total_cost || 0,
          order.currency || 'USD',
          convertToUSD(order.total_cost || 0, order.currency || 'USD'),
          (order.address || '').replace(/,/g, ';'), // Replace commas to avoid CSV issues
          order.city || '',
          order.state_region || '',
          order.zip || '',
          order.country || '',
          ticketsInfo,
          order.priority || '',
          order.purchase_date ? format(new Date(order.purchase_date), 'yyyy-MM-dd HH:mm') : '',
          order.venue || '',
          order.fulfilled_by || '',
          (order.special_instructions || '').replace(/,/g, ';').replace(/\n/g, ' ')
        ];
      });

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape cells that contain commas or quotes
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
      ].join('\n');

      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `orders_export_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export orders. Please try again.");
    }
    
    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <FileText className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Access Denied:</strong> This page is only available to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-4">
        <FileText className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Export Orders</h1>
          <p className="text-slate-600 mt-1">
            Download all order data as CSV (Admin Only)
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Order Data Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-medium text-slate-900 mb-2">Export Includes:</h3>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>Customer Information (Name, Email, Phone, Address)</li>
              <li>Order Details (Tour, Date, Status, Total Spent)</li>
              <li>Total Spent converted to USD (1 EUR = $1.09, 1 RON = $0.22)</li>
              <li>Ticket Information</li>
              <li>Processing Details (Priority, Fulfilled By, Notes)</li>
            </ul>
          </div>

          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <div>
              <p className="font-medium text-emerald-900">
                Ready to export {orders.length} orders
              </p>
              <p className="text-sm text-emerald-600 mt-1">
                CSV file will be downloaded to your computer
              </p>
            </div>
            <Button
              onClick={exportToCSV}
              disabled={isExporting || orders.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}