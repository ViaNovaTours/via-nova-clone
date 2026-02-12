import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  RefreshCw,
  AlertTriangle,
  Banknote,
  Target,
  PieChart,
  BarChart3,
  Megaphone,
  Calendar as CalendarIcon,
  Receipt
} from "lucide-react";
import { calculateProfitsForAllOrders } from "@/functions/calculateProfitsForAllOrders";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import WeeklyTrends from "../components/profits/WeeklyTrends";

// Helper function to match ad spend names (e.g., "Corvin Castle") to order tour names (e.g., "Corvin Castle Tour")
const getNormalizedTourKey = (tourName) => {
  if (!tourName) return '';
  return tourName
    .replace(/tour$/i, '')    // Remove "Tour" from the end, case-insensitive
    .replace(/'/g, '')        // Remove apostrophes like in "Hadrian's"
    .replace(/\s+/g, ' ')     // Normalize whitespace (multiple spaces to single space)
    .trim()                   // Remove leading/trailing whitespace
    .toLowerCase();
};

// Helper to check if order should be included in profit calculations
const isValidOrderForProfits = (order) => {
  // Exclude cancelled, failed, and refunded orders
  if (order.status === 'cancelled' || order.status === 'failed' || order.status === 'refunded') {
    return false;
  }
  // Must have profit data and total cost
  return order.projected_profit != null && order.total_cost > 0;
};

export default function ProfitsPage() {
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [adSpends, setAdSpends] = useState([]);
  const [monthlyCosts, setMonthlyCosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tourFilter, setTourFilter] = useState("all");
  const [timeBreakdown, setTimeBreakdown] = useState("month"); // month, week, day
  const [selectedPeriod, setSelectedPeriod] = useState("all"); // all, 2025-07, 2025-08, etc.
  const [selectedMonth, setSelectedMonth] = useState("all"); // New state for month filter
  const [selectedTourBreakdownMonth, setSelectedTourBreakdownMonth] = useState("all"); // New state for tour breakdown filter
  const { toast } = useToast();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        if (currentUser.role !== 'admin') {
          // Redirect non-admins back to dashboard
          window.location.href = '/Dashboard';
          return;
        }

        const [orderData, adSpendData, costsData] = await Promise.all([
          base44.entities.Order.list(),
          base44.entities.AdSpend.list(),
          base44.entities.MonthlyCosts.list()
        ]);
        setOrders(orderData);
        setAdSpends(adSpendData);
        setMonthlyCosts(costsData);
      } catch (error) {
        console.error("Error loading profits data:", error);
      }
      setIsLoading(false);
    };

    checkAccess();
  }, []);

  const handleBulkCalculation = async () => {
    setIsUpdating(true);
    try {
      const { data } = await calculateProfitsForAllOrders();

      if (data.success) {
        toast({
          title: "Profit Calculation Complete ✅",
          description: `Updated ${data.updated_count} orders with 11€ profit margin calculations`,
          duration: 5000,
        });

        // Reload orders to show updated data
        const orderData = await base44.entities.Order.list();
        setOrders(orderData);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsUpdating(false);
  };

  // Calculate operational costs by period
  const operationalCostsByPeriod = useMemo(() => {
    const costsByMonth = {};
    
    monthlyCosts.forEach(cost => {
      const monthKey = `${cost.year}-${String(cost.month).padStart(2, '0')}`;
      const totalCost = (cost.va_costs || 0) + (cost.make_com || 0) + (cost.gmail_templates || 0) + 
                       (cost.slack || 0) + (cost.siteground || 0) + (cost.sendgrid || 0) + 
                       (cost.google_workspace || 0) + (cost.zerobounce || 0) + (cost.digital_ocean || 0) + 
                       (cost.base44 || 0) + (cost.other_costs || 0);
      costsByMonth[monthKey] = totalCost;
    });
    
    return costsByMonth;
  }, [monthlyCosts]);

  const timeBasedAnalysis = useMemo(() => {
    const ordersWithProfits = orders.filter(isValidOrderForProfits);
    
    // Create a map from a normalized key to the full tour name found in orders
    const normalizedToFullTourNameMap = new Map();
    ordersWithProfits.forEach(order => {
        if (order.tour) {
            const key = getNormalizedTourKey(order.tour);
            if (!normalizedToFullTourNameMap.has(key)) {
                normalizedToFullTourNameMap.set(key, order.tour);
            }
        }
    });

    // Helper function to get period key
    const getPeriodKey = (date, breakdown) => {
      const dateObj = parseISO(date);
      switch (breakdown) {
        case 'year':
          return format(dateObj, 'yyyy');
        case 'month':
          return format(dateObj, 'yyyy-MM');
        case 'week':
          return format(startOfWeek(dateObj), 'yyyy-MM-dd');
        case 'day':
          return format(dateObj, 'yyyy-MM-dd');
        default:
          return format(dateObj, 'yyyy-MM');
      }
    };

    // Helper function to get period label
    const getPeriodLabel = (periodKey, breakdown) => {
      switch (breakdown) {
        case 'year':
          return periodKey;
        case 'month':
          return format(parseISO(`${periodKey}-01`), 'MMMM yyyy');
        case 'week':
          const weekStart = parseISO(periodKey);
          const weekEnd = endOfWeek(weekStart);
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
        case 'day':
          return format(parseISO(periodKey), 'EEEE, MMM d, yyyy');
        default:
          return periodKey;
      }
    };

    const analysisData = {};
    const allToursForColumns = new Set(); // This will hold all unique full tour names for column headers

    // Process orders by time period and tour
    ordersWithProfits.forEach(order => {
      const purchaseDate = order.purchase_date || order.created_date;
      if (!purchaseDate) return;

      const periodKey = getPeriodKey(purchaseDate, timeBreakdown);
      const tourName = order.tour;
      if (tourName) {
        allToursForColumns.add(tourName); // Add actual tour name from orders
      }
      

      if (!analysisData[periodKey]) {
        analysisData[periodKey] = {
          periodLabel: getPeriodLabel(periodKey, timeBreakdown),
          tours: {},
          totals: {
            revenue: 0,
            costs: 0,
            grossProfit: 0,
            adSpend: 0,
            operationalCosts: 0, // Added operational costs
            netProfit: 0,
            orders: 0,
            poas: 0
          }
        };
      }

      if (!analysisData[periodKey].tours[tourName]) {
        analysisData[periodKey].tours[tourName] = {
          revenue: 0,
          costs: 0,
          grossProfit: 0,
          adSpend: 0,
          netProfit: 0,
          orders: 0,
          poas: 0
        };
      }

      const revenue = order.total_cost || 0;
      const costs = order.total_ticket_cost || 0;
      const profit = order.projected_profit || 0;

      analysisData[periodKey].tours[tourName].revenue += revenue;
      analysisData[periodKey].tours[tourName].costs += costs;
      analysisData[periodKey].tours[tourName].grossProfit += profit;
      analysisData[periodKey].tours[tourName].orders += 1;

      analysisData[periodKey].totals.revenue += revenue;
      analysisData[periodKey].totals.costs += costs;
      analysisData[periodKey].totals.grossProfit += profit;
      analysisData[periodKey].totals.orders += 1;
    });

    // Process ad spend by time period and tour
    adSpends.forEach(adSpend => {
      const periodKey = getPeriodKey(adSpend.date, timeBreakdown);
      const adSpendTourKey = getNormalizedTourKey(adSpend.tour_name);
      
      // Try to match ad spend tour name to an existing order tour name via normalized map
      let matchedTourName = normalizedToFullTourNameMap.get(adSpendTourKey);
      
      // If no matching order tour name, use the ad spend's tour name directly
      if (!matchedTourName && adSpend.tour_name) {
          matchedTourName = adSpend.tour_name;
      }

      if (!matchedTourName) return; // Skip if no valid tour name can be determined

      allToursForColumns.add(matchedTourName); // Add to the set of all tours for columns

      const cost = adSpend.cost || 0;

      if (!analysisData[periodKey]) {
        analysisData[periodKey] = {
          periodLabel: getPeriodLabel(periodKey, timeBreakdown),
          tours: {},
          totals: {
            revenue: 0, costs: 0, grossProfit: 0, adSpend: 0, operationalCosts: 0, netProfit: 0, orders: 0, poas: 0
          }
        };
      }

      if (!analysisData[periodKey].tours[matchedTourName]) {
        analysisData[periodKey].tours[matchedTourName] = {
          revenue: 0, costs: 0, grossProfit: 0, adSpend: 0, netProfit: 0, orders: 0, poas: 0
        };
      }
      analysisData[periodKey].tours[matchedTourName].adSpend += cost;
      analysisData[periodKey].totals.adSpend += cost;
    });

    // Calculate net profits and POAS
    Object.keys(analysisData).forEach(periodKey => {
      const period = analysisData[periodKey];
      
      // For monthly breakdown, add operational costs directly
      if (timeBreakdown === 'month' && operationalCostsByPeriod[periodKey]) {
        period.totals.operationalCosts = operationalCostsByPeriod[periodKey];
      }
      
      // For yearly breakdown, sum up all months in that year
      if (timeBreakdown === 'year') {
        const yearOperationalCosts = Object.entries(operationalCostsByPeriod)
          .filter(([monthKey]) => monthKey.startsWith(periodKey))
          .reduce((sum, [, cost]) => sum + cost, 0);
        period.totals.operationalCosts = yearOperationalCosts;
      }

      period.totals.netProfit = period.totals.grossProfit - period.totals.adSpend - period.totals.operationalCosts;
      period.totals.poas = period.totals.adSpend > 0 ? (period.totals.revenue / period.totals.adSpend) : 0;

      Object.keys(period.tours).forEach(tourName => {
        const tour = period.tours[tourName];
        tour.netProfit = tour.grossProfit - tour.adSpend;
        tour.poas = tour.adSpend > 0 ? (tour.revenue / tour.adSpend) : 0;
      });
    });

    return { analysisData, allTours: Array.from(allToursForColumns).sort() };
  }, [orders, adSpends, timeBreakdown, operationalCostsByPeriod]);

  const availablePeriods = useMemo(() => {
    const periods = new Set();
    Object.keys(timeBasedAnalysis.analysisData).forEach(periodKey => {
      if (timeBreakdown === 'month') {
        periods.add(periodKey); // e.g., '2025-07'
      } else {
        // For weeks and days, group by month for the filter dropdown
        const monthKey = periodKey.substring(0, 7); // 'YYYY-MM'
        periods.add(monthKey);
      }
    });
    return Array.from(periods).sort().reverse(); // Sort periods descending
  }, [timeBasedAnalysis, timeBreakdown]);


  const profitStats = useMemo(() => {
    const ordersWithProfits = orders.filter(isValidOrderForProfits);

    const totalRevenue = ordersWithProfits.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const totalCosts = ordersWithProfits.reduce((sum, o) => sum + (o.total_ticket_cost || 0), 0);
    const totalProfit = ordersWithProfits.reduce((sum, o) => sum + (o.projected_profit || 0), 0);

    // Calculate total ad spend
    const totalAdSpend = adSpends.reduce((sum, ad) => sum + (ad.cost || 0), 0);

    // Calculate total operational costs
    const totalOperationalCosts = monthlyCosts.reduce((sum, cost) => {
      return sum + (cost.va_costs || 0) + (cost.make_com || 0) + (cost.gmail_templates || 0) + 
             (cost.slack || 0) + (cost.siteground || 0) + (cost.sendgrid || 0) + 
             (cost.google_workspace || 0) + (cost.zerobounce || 0) + (cost.digital_ocean || 0) + 
             (cost.base44 || 0) + (cost.other_costs || 0);
    }, 0);


    // Net profit after ad costs and operational costs
    const netProfit = totalProfit - totalAdSpend - totalOperationalCosts;

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const completedOrders = ordersWithProfits.filter(o => o.status === 'completed');
    const actualRevenue = completedOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0);
    const actualProfit = completedOrders.reduce((sum, o) => sum + (o.projected_profit || 0), 0);

    // Create a map from a normalized key to the full tour name, for ad spend matching
    const normalizedToFullTourNameMap = new Map();
    ordersWithProfits.forEach(order => {
        if (order.tour) {
            const key = getNormalizedTourKey(order.tour);
            if (!normalizedToFullTourNameMap.has(key)) {
                normalizedToFullTourNameMap.set(key, order.tour);
            }
        }
    });

    // Group by tour type with ad spend
    const tourProfits = {};
    ordersWithProfits.forEach(order => {
      if (!tourProfits[order.tour]) {
        tourProfits[order.tour] = { revenue: 0, profit: 0, count: 0, adSpend: 0 };
      }
      tourProfits[order.tour].revenue += order.total_cost || 0;
      tourProfits[order.tour].profit += order.projected_profit || 0;
      tourProfits[order.tour].count += 1;
    });

    // Add ad spend to tour profits using the smart mapping
    adSpends.forEach(ad => {
      const adSpendTourKey = getNormalizedTourKey(ad.tour_name);
      const orderTourName = normalizedToFullTourNameMap.get(adSpendTourKey); // Get the original tour name from orders
      if (orderTourName && tourProfits[orderTourName]) { // Only add if a corresponding order tour name exists
        tourProfits[orderTourName].adSpend += ad.cost || 0;
      }
    });

    // Count excluded orders for reporting
    const excludedOrders = orders.filter(o => 
      (o.status === 'cancelled' || o.status === 'failed' || o.status === 'refunded') &&
      o.projected_profit != null && o.total_cost > 0
    );

    return {
      totalRevenue,
      totalCosts,
      totalProfit,
      totalAdSpend,
      totalOperationalCosts,
      netProfit,
      profitMargin,
      netMargin,
      actualRevenue,
      actualProfit,
      ordersCount: ordersWithProfits.length,
      completedCount: completedOrders.length,
      excludedCount: excludedOrders.length,
      tourProfits,
      ordersNeedingUpdate: orders.filter(o =>
        (o.projected_profit == null || o.total_ticket_cost == null) &&
        o.tickets && o.tickets.length > 0 &&
        o.total_cost > 0
      ).length
    };
  }, [orders, adSpends, monthlyCosts]);

  // Tour breakdown filtered by month
  const tourBreakdownByMonth = useMemo(() => {
    let filteredOrders = orders.filter(isValidOrderForProfits);
    let filteredAdSpends = adSpends;

    // Filter by selected month if not "all"
    if (selectedTourBreakdownMonth !== "all") {
      filteredOrders = filteredOrders.filter(order => {
        const date = order.purchase_date || order.created_date;
        if (!date) return false;
        const monthKey = format(parseISO(date), 'yyyy-MM');
        return monthKey === selectedTourBreakdownMonth;
      });

      filteredAdSpends = filteredAdSpends.filter(ad => {
        const date = ad.date;
        if (!date) return false;
        const monthKey = format(parseISO(date), 'yyyy-MM');
        return monthKey === selectedTourBreakdownMonth;
      });
    }

    // Create a map from a normalized key to the full tour name
    const normalizedToFullTourNameMap = new Map();
    filteredOrders.forEach(order => {
      if (order.tour) {
        const key = getNormalizedTourKey(order.tour);
        if (!normalizedToFullTourNameMap.has(key)) {
          normalizedToFullTourNameMap.set(key, order.tour);
        }
      }
    });

    // Group by tour type
    const tourProfits = {};
    filteredOrders.forEach(order => {
      if (!tourProfits[order.tour]) {
        tourProfits[order.tour] = { revenue: 0, profit: 0, count: 0, adSpend: 0 };
      }
      tourProfits[order.tour].revenue += order.total_cost || 0;
      tourProfits[order.tour].profit += order.projected_profit || 0;
      tourProfits[order.tour].count += 1;
    });

    // Add ad spend to tour profits - CREATE ENTRIES FOR TOURS WITH NO ORDERS
    filteredAdSpends.forEach(ad => {
      const adSpendTourKey = getNormalizedTourKey(ad.tour_name);
      let orderTourName = normalizedToFullTourNameMap.get(adSpendTourKey);
      
      // If no matching order tour, use the ad spend tour name as-is
      if (!orderTourName) {
        orderTourName = ad.tour_name;
      }
      
      // Create entry if it doesn't exist (for tours with ad spend but no orders)
      if (!tourProfits[orderTourName]) {
        tourProfits[orderTourName] = { revenue: 0, profit: 0, count: 0, adSpend: 0 };
      }
      
      tourProfits[orderTourName].adSpend += ad.cost || 0;
    });

    return tourProfits;
  }, [orders, adSpends, selectedTourBreakdownMonth]);

  // Available months for tour breakdown (same as order detail months)
  const tourBreakdownAvailableMonths = useMemo(() => {
    const monthSet = new Set();
    orders.filter(isValidOrderForProfits).forEach(order => {
      const date = order.purchase_date || order.created_date;
      if (date) {
        const monthKey = format(parseISO(date), 'yyyy-MM');
        monthSet.add(monthKey);
      }
    });
    return Array.from(monthSet).sort().reverse().map(key => ({
      key,
      label: format(parseISO(`${key}-01`), 'MMMM yyyy')
    }));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(isValidOrderForProfits);

    if (searchTerm) {
      filtered = filtered.filter(order =>
        `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tour?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (tourFilter !== "all") {
      filtered = filtered.filter(order => order.tour === tourFilter);
    }

    return filtered.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [orders, searchTerm, statusFilter, tourFilter]);

  // Group orders by month for the details table
  const ordersByMonth = useMemo(() => {
    const grouped = {};
    
    filteredOrders.forEach(order => {
      const date = order.purchase_date || order.created_date;
      // Ensure date is valid before parsing
      if (!date) return;

      const monthKey = format(parseISO(date), 'yyyy-MM');
      const monthLabel = format(parseISO(date), 'MMMM yyyy');
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: monthLabel,
          orders: [],
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0
        };
      }
      
      grouped[monthKey].orders.push(order);
      grouped[monthKey].totalRevenue += order.total_cost || 0;
      grouped[monthKey].totalCost += order.total_ticket_cost || 0;
      grouped[monthKey].totalProfit += order.projected_profit || 0;
    });
    
    // Sort by month (newest first) and then map to array
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, data]) => ({ monthKey: key, ...data }));
  }, [filteredOrders]);

  // Available months for selector
  const availableMonths = useMemo(() => {
    return ordersByMonth.map(m => ({ key: m.monthKey, label: m.label }));
  }, [ordersByMonth]);

  // Filter to selected month
  const displayedMonths = useMemo(() => {
    if (selectedMonth === "all") {
      return ordersByMonth.slice(0, 3); // Show only first 3 months when "all" is selected
    }
    return ordersByMonth.filter(m => m.monthKey === selectedMonth);
  }, [ordersByMonth, selectedMonth]);

  const uniqueTours = useMemo(() => {
    const tourSet = new Set(orders.map(o => o.tour).filter(Boolean));
    return Array.from(tourSet).sort();
  }, [orders]);

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
          <DollarSign className="w-8 h-8 text-emerald-400" />
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
          <DollarSign className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Profit Analytics</h1>
            <p className="text-slate-300 mt-1">
              Financial overview with ad spend and operational costs (Admin Only)
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleBulkCalculation}
            disabled={isUpdating}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="w-4 h-4 mr-2" />
                Update All Profits
              </>
            )}
          </Button>
        </div>
      </div>

      {profitStats.ordersNeedingUpdate > 0 && (
        <Alert className="border-amber-900 bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <strong>{profitStats.ordersNeedingUpdate} orders</strong> need profit calculations.
            Click "Update All Profits" to automatically calculate 11€ profit margins.
          </AlertDescription>
        </Alert>
      )}

      {profitStats.excludedCount > 0 && (
        <Alert className="border-blue-900 bg-blue-950">
          <AlertTriangle className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200">
            <strong>{profitStats.excludedCount} orders</strong> (cancelled, failed, or refunded) are excluded from profit calculations.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
        <Card className="border-emerald-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-emerald-400 flex items-center gap-2 text-sm">
              <Banknote className="w-4 h-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-300">
              {formatCurrency(profitStats.totalRevenue)}
            </p>
            <p className="text-xs text-emerald-400/70 mt-1">
              {profitStats.ordersCount} valid orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-red-400 flex items-center gap-2 text-sm">
              <TrendingDown className="w-4 h-4" />
              Ticket Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-300">
              {formatCurrency(profitStats.totalCosts)}
            </p>
            <p className="text-xs text-red-400/70 mt-1">
              Agent ticket costs
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-orange-400 flex items-center gap-2 text-sm">
              <Megaphone className="w-4 h-4" />
              Ad Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-300">
              {formatCurrency(profitStats.totalAdSpend)}
            </p>
            <p className="text-xs text-orange-400/70 mt-1">
              {adSpends.length} ad records
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-600 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-300 flex items-center gap-2 text-sm">
              <Receipt className="w-4 h-4" />
              Op. Costs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-slate-200">
              {formatCurrency(profitStats.totalOperationalCosts)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {monthlyCosts.length} months tracked
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-blue-400 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4" />
              Gross Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-300">
              {formatCurrency(profitStats.totalProfit)}
            </p>
            <p className="text-xs text-blue-400/70 mt-1">
              {profitStats.profitMargin.toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-900 bg-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-purple-400 flex items-center gap-2 text-sm">
              <Target className="w-4 h-4" />
              Net Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-300">
              {formatCurrency(profitStats.netProfit)}
            </p>
            <p className="text-xs text-purple-400/70 mt-1">
              {profitStats.netMargin.toFixed(1)}% net margin
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time-Based Analysis Controls */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Profit Analysis Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Select value={timeBreakdown} onValueChange={setTimeBreakdown}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">By Year</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
                <SelectItem value="week">By Week</SelectItem>
                <SelectItem value="day">By Day</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Filter Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time Periods</SelectItem>
                {availablePeriods.map(period => (
                  <SelectItem key={period} value={period}>
                    {format(parseISO(`${period}-01`), 'MMMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-700 border-slate-600">
                  <TableHead className="font-semibold text-slate-300">Period</TableHead>
                  <TableHead className="font-semibold text-emerald-400 bg-emerald-950">Net Profit</TableHead>
                  <TableHead className="font-semibold text-slate-300 bg-yellow-950">Gross Profit</TableHead>
                  <TableHead className="font-semibold text-slate-300">Ad Spend</TableHead>
                  {(timeBreakdown === 'month' || timeBreakdown === 'year') && (
                    <TableHead className="font-semibold text-slate-300">Op. Costs</TableHead>
                  )}
                  <TableHead className="font-semibold text-blue-400">POAS</TableHead>
                  {timeBasedAnalysis.allTours.map(tourName => (
                    <TableHead key={tourName} className="font-semibold text-slate-300 bg-slate-750">
                      {tourName ? tourName.replace(' Tour', '') : 'N/A'}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(timeBasedAnalysis.analysisData)
                  .filter(([periodKey]) => {
                    if (selectedPeriod === "all") return true;
                    return periodKey.startsWith(selectedPeriod);
                  })
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([periodKey, periodData]) => (
                    <TableRow key={periodKey} className="hover:bg-slate-700/50 border-slate-700">
                      <TableCell className="font-medium text-slate-300">
                        {periodData.periodLabel}
                      </TableCell>
                      <TableCell className={`font-bold bg-emerald-950 ${
                        periodData.totals.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(periodData.totals.netProfit)}
                      </TableCell>
                      <TableCell className="font-medium bg-yellow-950 text-yellow-300">
                        {formatCurrency(periodData.totals.grossProfit)}
                      </TableCell>
                      <TableCell className="text-orange-400">
                        {formatCurrency(periodData.totals.adSpend)}
                      </TableCell>
                      {(timeBreakdown === 'month' || timeBreakdown === 'year') && (
                        <TableCell className="text-slate-400">
                          {formatCurrency(periodData.totals.operationalCosts)}
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-blue-400">
                        {periodData.totals.poas.toFixed(2)}x
                      </TableCell>
                      {timeBasedAnalysis.allTours.map(tourName => {
                        const tourData = periodData.tours[tourName];
                        // Calculate sum of all tour net profits for this period
                        const sumOfTourNetProfits = Object.values(periodData.tours).reduce((sum, t) => sum + (t.netProfit || 0), 0);
                        const profitPercentage = sumOfTourNetProfits !== 0 ? (tourData?.netProfit / sumOfTourNetProfits) * 100 : 0;
                        
                        return (
                         <TableCell key={tourName} className="bg-slate-750">
                           {tourData && (tourData.netProfit !== 0 || tourData.adSpend !== 0) ? (
                             <div className="text-center">
                               <div className={`font-medium ${tourData.netProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                                 {formatCurrency(tourData.netProfit)}
                               </div>
                               {sumOfTourNetProfits !== 0 && tourData.netProfit !== 0 && (
                                 <div className="text-xs text-blue-400">
                                   {profitPercentage.toFixed(1)}% of total
                                 </div>
                               )}
                               <div className="text-xs text-slate-400 mt-1">
                                 {tourData.orders} completed
                               </div>
                             </div>
                           ) : (
                             <div className="text-center text-slate-500">-</div>
                           )}
                         </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {Object.keys(timeBasedAnalysis.analysisData).length === 0 && (
            <div className="text-center py-8">
              <CalendarIcon className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-200 mb-2">No data for selected period</h3>
              <p className="text-slate-400 text-sm">Try selecting a different time period or breakdown</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tour Breakdown */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-white flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Overall Profit by Tour Type (Including Ad Spend)
            </CardTitle>
            <Select value={selectedTourBreakdownMonth} onValueChange={setSelectedTourBreakdownMonth}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                {tourBreakdownAvailableMonths.map(month => (
                  <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(tourBreakdownByMonth).map(([tourName, data]) => {
              const netProfit = data.profit - data.adSpend;
              const netMargin = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;

              return (
                <div key={tourName} className="p-4 bg-slate-700 rounded-lg">
                  <h4 className="font-medium text-slate-200 mb-2">{tourName}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Revenue:</span>
                      <span className="font-medium text-slate-300">{formatCurrency(data.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gross Profit:</span>
                      <span className="font-medium text-emerald-400">{formatCurrency(data.profit)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ad Spend:</span>
                      <span className="font-medium text-orange-400">-{formatCurrency(data.adSpend)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-600 pt-1">
                      <span className="text-slate-400">Net Profit:</span>
                      <span className={`font-bold ${netProfit >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                        {formatCurrency(netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Orders:</span>
                      <span className="font-medium text-slate-300">{data.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Net Margin:</span>
                      <span className={`font-medium ${netMargin >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                        {netMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(tourBreakdownByMonth).length === 0 && (
            <div className="text-center py-8">
              <PieChart className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-200 mb-2">No tour data for selected period</h3>
              <p className="text-slate-400 text-sm">Try selecting a different month</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-slate-700 bg-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Order Profit Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Recent (Last 3 Months)</SelectItem>
                {availableMonths.map(month => (
                  <SelectItem key={month.key} value={month.key}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="reserved_date">Reserved</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
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

          {displayedMonths.length > 0 && selectedMonth === "all" && (
            <Alert className="border-blue-900 bg-blue-950 mb-4">
              <AlertTriangle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200">
                Showing the <strong>3 most recent months</strong>. Use the month selector above to view a specific month or see all {ordersByMonth.length} months of data.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {displayedMonths.map(({ monthKey, label, orders, totalRevenue, totalCost, totalProfit }) => (
              <div key={monthKey} className="space-y-3">
                {/* Month Header */}
                <div className="bg-slate-700 px-4 py-3 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border border-slate-600">
                  <div>
                    <h3 className="font-semibold text-slate-200 text-lg">{label}</h3>
                    <p className="text-sm text-slate-400">{orders.length} orders</p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-slate-400">Revenue</p>
                      <p className="font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Cost</p>
                      <p className="font-bold text-red-400">{formatCurrency(totalCost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400">Profit</p>
                      <p className="font-bold text-purple-400">{formatCurrency(totalProfit)}</p>
                    </div>
                  </div>
                </div>

                {/* Orders Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-700 border-slate-600">
                        <TableHead className="text-slate-300">Date</TableHead>
                        <TableHead className="text-slate-300">Order</TableHead>
                        <TableHead className="text-slate-300">Customer</TableHead>
                        <TableHead className="text-slate-300">Tour</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Revenue</TableHead>
                        <TableHead className="text-slate-300">Agent Cost</TableHead>
                        <TableHead className="text-slate-300">Profit</TableHead>
                        <TableHead className="text-slate-300">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => {
                        const margin = order.total_cost > 0 ? (order.projected_profit / order.total_cost) * 100 : 0;
                        const orderDate = order.purchase_date || order.created_date;
                        return (
                          <TableRow key={order.id} className="hover:bg-slate-700/50 border-slate-700">
                            <TableCell className="text-sm text-slate-400">
                              {orderDate ? format(parseISO(orderDate), 'MMM d') : 'N/A'}
                            </TableCell>
                            <TableCell className="font-medium text-sm text-slate-300">
                              {order.order_id || `#${order.id.slice(-6)}`}
                            </TableCell>
                            <TableCell className="text-sm text-slate-300">
                              {order.first_name} {order.last_name}
                            </TableCell>
                            <TableCell className="text-sm text-slate-300">{order.tour}</TableCell>
                            <TableCell>
                              <Badge className={
                                order.status === 'completed' ? 'bg-green-950 text-green-400 border-green-900' :
                                order.status === 'new' ? 'bg-red-950 text-red-400 border-red-900' :
                                order.status === 'cancelled' || order.status === 'failed' || order.status === 'refunded' ? 'bg-gray-800 text-gray-400' :
                                'bg-blue-950 text-blue-400 border-blue-900'
                              }>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-slate-300">
                              {formatCurrency(order.total_cost, order.currency)}
                            </TableCell>
                            <TableCell className="text-red-400">
                              {formatCurrency(order.total_ticket_cost, order.currency)}
                            </TableCell>
                            <TableCell className="font-medium text-emerald-400">
                              {formatCurrency(order.projected_profit, order.currency)}
                            </TableCell>
                            <TableCell className="font-medium text-slate-300">
                              {margin.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          {displayedMonths.length === 0 && (
            <div className="text-center py-8">
              <BarChart3 className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-200 mb-2">No orders found</h3>
              <p className="text-slate-400 text-sm">Try adjusting your filters</p>
            </div>
          )}

          {displayedMonths.length > 0 && (
            <p className="text-sm text-slate-400 mt-4 text-center">
              {selectedMonth === "all" 
                ? `Showing ${displayedMonths.reduce((sum, m) => sum + m.orders.length, 0)} orders from ${displayedMonths.length} months (${ordersByMonth.length} total months available)`
                : `Showing ${displayedMonths[0].orders.length} orders for ${displayedMonths[0].label}`
              }
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}