import React, { useState, useEffect, useMemo } from "react";
import { AdSpend } from "@/entities/AdSpend";
import { Order } from "@/entities/Order";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Megaphone, 
  TrendingUp, 
  Calendar,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  DollarSign,
  Target,
  PieChart
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

// Helper to check if order should be included in profit calculations
const isValidOrderForProfits = (order) => {
  // Exclude cancelled, failed, and refunded orders
  if (order.status === 'cancelled' || order.status === 'failed' || order.status === 'refunded') {
    return false;
  }
  // Must have profit data and total cost
  return order.projected_profit != null && order.total_cost > 0;
};

export default function AdSpendPage() {
  const [user, setUser] = useState(null);
  const [adSpends, setAdSpends] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tourFilter, setTourFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [statsMonthFilter, setStatsMonthFilter] = useState("all");

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        
        if (currentUser.role !== 'admin') {
          // Redirect non-admins back to dashboard
          window.location.href = '/Dashboard';
          return;
        }
        
        const adSpendData = await AdSpend.list('-date');
        setAdSpends(adSpendData);

        const orderData = await Order.list();
        setOrders(orderData);
      } catch (error) {
        console.error("Error loading ad spend data:", error);
      }
      setIsLoading(false);
    };
    
    checkAccess();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const adSpendData = await AdSpend.list('-date');
      setAdSpends(adSpendData);
      
      const orderData = await Order.list();
      setOrders(orderData);
    } catch (error) {
      console.error("Error refreshing ad spend data:", error);
    }
    setIsLoading(false);
  };

  // Available months from ad spend data
  const availableMonths = useMemo(() => {
    const monthSet = new Set();
    adSpends.forEach(ad => {
      const monthKey = format(parseISO(ad.date), 'yyyy-MM');
      monthSet.add(monthKey);
    });
    return Array.from(monthSet).sort().reverse().map(key => ({
      key,
      label: format(parseISO(`${key}-01`), 'MMMM yyyy')
    }));
  }, [adSpends]);

  const adSpendStats = useMemo(() => {
    // Filter ad spends by selected month
    let filteredStats = adSpends;
    let filteredOrders = orders.filter(isValidOrderForProfits);
    
    if (statsMonthFilter !== "all") {
      filteredStats = adSpends.filter(ad => {
        const monthKey = format(parseISO(ad.date), 'yyyy-MM');
        return monthKey === statsMonthFilter;
      });
      
      filteredOrders = filteredOrders.filter(order => {
        if (!order.purchase_date) return false;
        const monthKey = format(parseISO(order.purchase_date), 'yyyy-MM');
        return monthKey === statsMonthFilter;
      });
    }

    const totalSpend = filteredStats.reduce((sum, ad) => sum + (ad.cost || 0), 0);
    
    // Group by tour with revenue and profit data
    const tourSpends = {};
    filteredStats.forEach(ad => {
      if (!tourSpends[ad.tour_name]) {
        tourSpends[ad.tour_name] = { 
          total: 0, 
          days: 0, 
          avgDaily: 0,
          revenue: 0,
          ticketCost: 0,
          grossProfit: 0,
          netProfit: 0,
          orderCount: 0
        };
      }
      tourSpends[ad.tour_name].total += ad.cost || 0;
      tourSpends[ad.tour_name].days += 1;
    });
    
    // Add revenue and profit data from orders
    filteredOrders.forEach(order => {
      if (!order.tour) return;
      
      if (!tourSpends[order.tour]) {
        tourSpends[order.tour] = { 
          total: 0, 
          days: 0, 
          avgDaily: 0,
          revenue: 0,
          ticketCost: 0,
          grossProfit: 0,
          netProfit: 0,
          orderCount: 0
        };
      }
      
      tourSpends[order.tour].revenue += order.total_cost || 0;
      tourSpends[order.tour].ticketCost += order.total_ticket_cost || 0;
      tourSpends[order.tour].orderCount += 1;
    });
    
    // Calculate profits for each tour
    Object.keys(tourSpends).forEach(tour => {
      tourSpends[tour].avgDaily = tourSpends[tour].days > 0 ? tourSpends[tour].total / tourSpends[tour].days : 0;
      tourSpends[tour].grossProfit = tourSpends[tour].revenue - tourSpends[tour].ticketCost;
      tourSpends[tour].netProfit = tourSpends[tour].grossProfit - tourSpends[tour].total;
    });
    
    // Sort tours by net profit (highest to lowest)
    const sortedTours = Object.entries(tourSpends).sort((a, b) => b[1].netProfit - a[1].netProfit);
    const sortedTourSpends = Object.fromEntries(sortedTours);
    
    // This month's spend
    const thisMonth = filteredStats.filter(ad => {
      const adDate = parseISO(ad.date);
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      return adDate >= monthStart && adDate <= monthEnd;
    });
    const thisMonthSpend = thisMonth.reduce((sum, ad) => sum + (ad.cost || 0), 0);
    
    // Last month's spend
    const lastMonth = filteredStats.filter(ad => {
      const adDate = parseISO(ad.date);
      const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
      const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
      return adDate >= lastMonthStart && adDate <= lastMonthEnd;
    });
    const lastMonthSpend = lastMonth.reduce((sum, ad) => sum + (ad.cost || 0), 0);
    
    // Calculate totals
    const totalRevenue = Object.values(sortedTourSpends).reduce((sum, tour) => sum + tour.revenue, 0);
    const totalGrossProfit = Object.values(sortedTourSpends).reduce((sum, tour) => sum + tour.grossProfit, 0);
    const totalNetProfit = Object.values(sortedTourSpends).reduce((sum, tour) => sum + tour.netProfit, 0);
    
    return {
      totalSpend,
      thisMonthSpend,
      lastMonthSpend,
      tourSpends: sortedTourSpends,
      totalRecords: filteredStats.length,
      uniqueTours: Object.keys(sortedTourSpends).length,
      primaryCurrency: 'USD',
      totalRevenue,
      totalGrossProfit,
      totalNetProfit
    };
  }, [adSpends, orders, statsMonthFilter]);

  const filteredAdSpends = useMemo(() => {
    let filtered = adSpends;

    if (searchTerm) {
      filtered = filtered.filter(ad =>
        ad.tour_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ad.source?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (tourFilter !== "all") {
      filtered = filtered.filter(ad => ad.tour_name === tourFilter);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(ad => {
        const adDate = parseISO(ad.date);
        switch (dateFilter) {
          case "this_month":
            return adDate >= startOfMonth(now) && adDate <= endOfMonth(now);
          case "last_month":
            const lastMonth = subMonths(now, 1);
            return adDate >= startOfMonth(lastMonth) && adDate <= endOfMonth(lastMonth);
          case "last_30_days":
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return adDate >= thirtyDaysAgo;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [adSpends, searchTerm, tourFilter, dateFilter]);

  const uniqueTours = useMemo(() => {
    const tourSet = new Set(adSpends.map(ad => ad.tour_name).filter(Boolean));
    return Array.from(tourSet).sort();
  }, [adSpends]);

  const formatCurrency = (value, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(value || 0);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Megaphone className="w-8 h-8 text-orange-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert className="border-red-900 bg-red-950">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-200">
            <strong>Access Denied:</strong> This page is only available to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <Megaphone className="w-8 h-8 text-orange-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Ad Spend Analytics</h1>
            <p className="text-slate-300 mt-1">
              Track and analyze your advertising costs by tour (Admin Only)
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {adSpends.length === 0 && (
        <Alert className="border-amber-900 bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <strong>No ad spend data found.</strong> Make sure your Make.com automation is sending data to the webhook endpoint.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Overview</h2>
        <Select value={statsMonthFilter} onValueChange={setStatsMonthFilter}>
          <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            {availableMonths.map(month => (
              <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="border-green-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-green-400 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Gross Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-300">
              {formatCurrency(adSpendStats.totalRevenue, adSpendStats.primaryCurrency)}
            </p>
            <p className="text-sm text-green-400/70 mt-1">
              Total customer payments
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Gross Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-300">
              {formatCurrency(adSpendStats.totalGrossProfit, adSpendStats.primaryCurrency)}
            </p>
            <p className="text-sm text-emerald-400/70 mt-1">
              After ticket costs
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-orange-400 flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              Total Ad Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-300">
              {formatCurrency(adSpendStats.totalSpend, adSpendStats.primaryCurrency)}
            </p>
            <p className="text-sm text-orange-400/70 mt-1">
              {adSpendStats.totalRecords} records
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${adSpendStats.totalNetProfit >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
              {formatCurrency(adSpendStats.totalNetProfit, adSpendStats.primaryCurrency)}
            </p>
            <p className="text-sm text-blue-400/70 mt-1">
              Gross profit - ad spend
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Active Tours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-300">
              {adSpendStats.uniqueTours}
            </p>
            <p className="text-sm text-purple-400/70 mt-1">
              Tours with data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tour Breakdown */}
      {Object.keys(adSpendStats.tourSpends).length > 0 && (
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Spend by Tour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(adSpendStats.tourSpends).map(([tourName, data]) => (
                <div key={tourName} className="p-4 bg-slate-700 rounded-lg">
                  <h4 className="font-medium text-slate-200 mb-3">{tourName}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-slate-600 pb-2">
                      <span className="text-slate-400">Gross Revenue:</span>
                      <span className="font-medium text-green-400">{formatCurrency(data.revenue, adSpendStats.primaryCurrency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gross Profit:</span>
                      <span className="font-medium text-emerald-400">{formatCurrency(data.grossProfit, adSpendStats.primaryCurrency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ad Spend:</span>
                      <span className="font-medium text-orange-400">{formatCurrency(data.total, adSpendStats.primaryCurrency)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-600 pt-2">
                      <span className="text-slate-300 font-medium">Net Profit:</span>
                      <span className={`font-bold ${data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(data.netProfit, adSpendStats.primaryCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-2 pt-2 border-t border-slate-600">
                      <span className="text-slate-500">Orders:</span>
                      <span className="text-slate-400">{data.orderCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ad Spend Table */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Ad Spend Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search by tour or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            />
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tourFilter} onValueChange={setTourFilter}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Tour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tours</SelectItem>
                {uniqueTours.map(tour => (
                  <SelectItem key={tour} value={tour}>{tour}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-700 border-slate-600">
                  <TableHead className="text-slate-300">Date</TableHead>
                  <TableHead className="text-slate-300">Tour</TableHead>
                  <TableHead className="text-slate-300">Cost</TableHead>
                  <TableHead className="text-slate-300">Currency</TableHead>
                  <TableHead className="text-slate-300">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdSpends.map((adSpend) => (
                  <TableRow key={adSpend.id} className="border-slate-700 hover:bg-slate-700/50">
                    <TableCell className="font-medium text-slate-300">
                      {format(parseISO(adSpend.date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-orange-950 text-orange-400 border-orange-900">
                        {adSpend.tour_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-orange-400">
                      {formatCurrency(adSpend.cost, adSpend.currency)}
                    </TableCell>
                    <TableCell className="text-slate-300">{adSpend.currency}</TableCell>
                    <TableCell className="text-slate-400">{adSpend.source}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredAdSpends.length === 0 && !isLoading && (
            <div className="text-center py-8">
              <Megaphone className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-200 mb-2">No ad spend records found</h3>
              <p className="text-slate-400 text-sm">Try adjusting your filters or check your Make.com integration</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}