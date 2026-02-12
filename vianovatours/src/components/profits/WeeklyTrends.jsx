import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export default function WeeklyTrends({ orders, adSpends }) {
  const weeklyTrends = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now);
    const lastWeekStart = startOfWeek(subWeeks(now, 1));
    
    const getNormalizedTourKey = (tourName) => {
      if (!tourName) return '';
      return tourName
        .replace(/tour$/i, '')
        .replace(/'/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    const isValidOrder = (order) => {
      return order.status !== 'cancelled' && 
             order.status !== 'failed' && 
             order.status !== 'refunded' &&
             order.projected_profit != null && 
             order.total_cost > 0;
    };

    const getWeekData = (weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      const weekOrders = orders.filter(order => {
        if (!isValidOrder(order)) return false;
        const orderDate = parseISO(order.purchase_date || order.created_date);
        return orderDate >= weekStart && orderDate <= weekEnd;
      });

      const tourData = {};
      const normalizedMap = new Map();

      weekOrders.forEach(order => {
        const tourName = order.tour;
        if (!tourName) return;

        const key = getNormalizedTourKey(tourName);
        if (!normalizedMap.has(key)) {
          normalizedMap.set(key, tourName);
        }

        if (!tourData[tourName]) {
          tourData[tourName] = {
            revenue: 0,
            profit: 0,
            orders: 0,
            adSpend: 0
          };
        }

        tourData[tourName].revenue += order.total_cost || 0;
        tourData[tourName].profit += order.projected_profit || 0;
        tourData[tourName].orders += 1;
      });

      // Add ad spend
      adSpends.forEach(ad => {
        const adDate = parseISO(ad.date);
        if (adDate >= weekStart && adDate <= weekEnd) {
          const adTourKey = getNormalizedTourKey(ad.tour_name);
          const matchedTour = normalizedMap.get(adTourKey);
          
          if (matchedTour && tourData[matchedTour]) {
            tourData[matchedTour].adSpend += ad.cost || 0;
          }
        }
      });

      // Calculate net profit
      Object.values(tourData).forEach(data => {
        data.netProfit = data.profit - data.adSpend;
      });

      return tourData;
    };

    const currentWeek = getWeekData(currentWeekStart);
    const lastWeek = getWeekData(lastWeekStart);

    // Calculate trends
    const trends = [];
    const allTours = new Set([...Object.keys(currentWeek), ...Object.keys(lastWeek)]);

    allTours.forEach(tourName => {
      const current = currentWeek[tourName] || { revenue: 0, profit: 0, orders: 0, adSpend: 0, netProfit: 0 };
      const previous = lastWeek[tourName] || { revenue: 0, profit: 0, orders: 0, adSpend: 0, netProfit: 0 };

      const revenueChange = current.revenue - previous.revenue;
      const revenueChangePercent = previous.revenue > 0 
        ? ((revenueChange / previous.revenue) * 100) 
        : (current.revenue > 0 ? 100 : 0);

      const profitChange = current.netProfit - previous.netProfit;
      const profitChangePercent = previous.netProfit !== 0
        ? ((profitChange / Math.abs(previous.netProfit)) * 100)
        : (current.netProfit !== 0 ? 100 : 0);

      trends.push({
        tourName,
        current,
        previous,
        revenueChange,
        revenueChangePercent,
        profitChange,
        profitChangePercent
      });
    });

    // Sort by current week revenue (highest first)
    trends.sort((a, b) => b.current.revenue - a.current.revenue);

    return {
      trends,
      currentWeekLabel: `${format(currentWeekStart, 'MMM d')} - ${format(endOfWeek(currentWeekStart), 'MMM d')}`,
      lastWeekLabel: `${format(lastWeekStart, 'MMM d')} - ${format(endOfWeek(lastWeekStart), 'MMM d')}`
    };
  }, [orders, adSpends]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const getTrendIcon = (change) => {
    if (change > 5) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (change < -5) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendColor = (change) => {
    if (change > 5) return 'text-green-600';
    if (change < -5) return 'text-red-600';
    return 'text-slate-600';
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Weekly Tour Trends
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          Current week ({weeklyTrends.currentWeekLabel}) vs. Last week ({weeklyTrends.lastWeekLabel})
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {weeklyTrends.trends.map(({ tourName, current, previous, revenueChange, revenueChangePercent, profitChange, profitChangePercent }) => (
            <div key={tourName} className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-slate-900">{tourName}</h4>
                <div className="flex items-center gap-2">
                  {getTrendIcon(profitChangePercent)}
                  <span className={`text-sm font-medium ${getTrendColor(profitChangePercent)}`}>
                    {profitChangePercent > 0 ? '+' : ''}{profitChangePercent.toFixed(0)}%
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Revenue</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(current.revenue)}</p>
                  <p className={`text-xs mt-0.5 ${getTrendColor(revenueChangePercent)}`}>
                    {revenueChange > 0 ? '+' : ''}{formatCurrency(revenueChange)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 mb-1">Net Profit</p>
                  <p className={`font-semibold ${current.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(current.netProfit)}
                  </p>
                  <p className={`text-xs mt-0.5 ${getTrendColor(profitChangePercent)}`}>
                    {profitChange > 0 ? '+' : ''}{formatCurrency(profitChange)}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 mb-1">Orders</p>
                  <p className="font-semibold text-slate-900">{current.orders}</p>
                  <p className={`text-xs mt-0.5 ${current.orders - previous.orders >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {current.orders - previous.orders > 0 ? '+' : ''}{current.orders - previous.orders}
                  </p>
                </div>

                <div>
                  <p className="text-slate-500 mb-1">Ad Spend</p>
                  <p className="font-semibold text-orange-600">{formatCurrency(current.adSpend)}</p>
                  <p className={`text-xs mt-0.5 ${current.adSpend - previous.adSpend <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {current.adSpend - previous.adSpend > 0 ? '+' : ''}{formatCurrency(current.adSpend - previous.adSpend)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {weeklyTrends.trends.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-medium text-slate-900 mb-2">No weekly data available</h3>
            <p className="text-slate-500 text-sm">Weekly trends will appear once orders are recorded</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}