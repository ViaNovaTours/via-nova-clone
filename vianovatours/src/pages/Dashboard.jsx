import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Order } from "@/entities/Order";
import { WooCommerceCredentials } from "@/entities/WooCommerceCredentials";
import { Tour } from "@/entities/Tour";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { RefreshCw, Bell, SortAsc, SortDesc, Download, AlertTriangle, Wrench } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

import StatsOverview from "../components/dashboard/StatsOverview";
import OrdersTable from "../components/dashboard/OrdersTable";
import WooCommerceSync from "../components/integrations/WooCommerceSync"; 
import UpdateOrderStatuses from "../components/integrations/UpdateOrderStatuses";
import { fetchWooCommerceOrders } from "@/functions/fetchWooCommerceOrders";
import { migrateWooCommerceCredentials } from "@/functions/migrateWooCommerceCredentials";
import { fixCompleteStatus } from "@/functions/fixCompleteStatus";

export default function Dashboard() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tourFilter, setTourFilter] = useState("all");
  const [sortBy, setSortBy] = useState("purchase_date");
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkTagAction, setBulkTagAction] = useState("");
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [hasStatusBug, setHasStatusBug] = useState(false);
  const [isFixingStatus, setIsFixingStatus] = useState(false);
  const [siteUrls, setSiteUrls] = useState({});
  const { toast } = useToast();

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await Order.list(); 
      setOrders(data);
      
      // Check for status bug
      const hasComplete = data.some(o => o.status === 'complete');
      setHasStatusBug(hasComplete);
    } catch (error) {
      console.error("Error loading orders:", error);
    }
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            // Check authentication
            const user = await base44.auth.me();
            if (!user) {
              base44.auth.redirectToLogin();
              return;
            }
            setIsCheckingAuth(false);
            
            await loadOrders();
            
            // Load WooCommerce site URLs for order links
            const credentials = await WooCommerceCredentials.list();
            const urlMap = {};
            credentials.forEach(cred => {
              urlMap[cred.site_name] = cred.website_url;
            });
            setSiteUrls(urlMap);
            
            // Check if migration is needed
            if (credentials.length === 0) {
              setNeedsMigration(true);
            }
        } catch (error) {
            console.error("Error loading initial data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    loadInitialData();
  }, [loadOrders]);

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const { data } = await migrateWooCommerceCredentials();
      
      if (data.success) {
        toast({
          title: "Migration Complete! 🎉",
          description: `${data.message} You can now sync your WooCommerce orders!`,
          duration: 5000,
        });
        setNeedsMigration(false);
      } else {
        throw new Error(data.error || 'Migration failed');
      }
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsMigrating(false);
  };

  const handleFixStatus = async () => {
    setIsFixingStatus(true);
    try {
      const { data } = await fixCompleteStatus();
      
      if (data.success) {
        toast({
          title: "Status Fixed! ✅",
          description: `Updated ${data.total_fixed} orders from "complete" to "completed"`,
          duration: 5000,
        });
        await loadOrders();
      } else {
        throw new Error(data.error || 'Fix failed');
      }
    } catch (error) {
      toast({
        title: "Fix Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsFixingStatus(false);
  };

  // Auto-sync every 1 minute for near-instant updates
  useEffect(() => {
    const autoSync = async () => {
      setIsAutoSyncing(true);
      try {
        const { data } = await fetchWooCommerceOrders();
        
        if (data.success) {
          await loadOrders();
          setLastSyncTime(new Date());
          
          // Show toast notification for new orders
          if (data.total_new_orders > 0) {
            toast({
              title: "🎉 New Orders Arrived!",
              description: `${data.total_new_orders} new order${data.total_new_orders > 1 ? 's' : ''} imported`,
              duration: 5000,
            });
          }
          
          // Silent update for status changes
          if (data.status_updates > 0 && data.total_new_orders === 0) {
            console.log(`${data.status_updates} order status(es) updated`);
          }
        }
      } catch (error) {
        console.error("Auto-sync failed:", error);
      }
      setIsAutoSyncing(false);
    };

    // Run initial sync after 5 seconds (to not interfere with page load)
    const initialTimeout = setTimeout(() => {
      autoSync();
    }, 5000);

    // Then run every 60 seconds (1 minute) for near-instant updates
    const interval = setInterval(() => {
      autoSync();
    }, 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [loadOrders, toast]);

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = orders;

    if (searchTerm) {
      filtered = filtered.filter(order =>
        `${order.first_name} ${order.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tour?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      // Check if it's a tag filter (starts with "tag:")
      if (statusFilter.startsWith('tag:')) {
        const tag = statusFilter.replace('tag:', '');
        filtered = filtered.filter(order => order.tags && order.tags.includes(tag));
      } else if (statusFilter === 'priority') {
        // Priority filter: unprocessed orders with tour_date within next 72 hours (including today)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const next72Hours = new Date(today.getTime() + 72 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
          if (order.status !== 'unprocessed' || !order.tour_date) return false;
          const tourDate = new Date(order.tour_date);
          const tourDay = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate());
          return tourDay >= today && tourDay < next72Hours;
        });
      } else if (statusFilter === 'next_30_days') {
        // Next 30 days filter: unprocessed orders with tour_date within next 30 days
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(order => {
          if (order.status !== 'unprocessed' || !order.tour_date) return false;
          const tourDate = new Date(order.tour_date);
          const tourDay = new Date(tourDate.getFullYear(), tourDate.getMonth(), tourDate.getDate());
          return tourDay >= today && tourDay < next30Days;
        });
      } else {
        const statuses = statusFilter.split(',');
        filtered = filtered.filter(order => statuses.includes(order.status));
      }
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(order => order.priority === priorityFilter);
    }

    if (tourFilter !== "all") {
      filtered = filtered.filter(order => order.tour === tourFilter);
    }
    
    filtered.sort((a, b) => {
        if (sortBy === 'tour_date') {
            const dateA = a.tour_date ? new Date(a.tour_date) : new Date('9999-12-31');
            const dateB = b.tour_date ? new Date(b.tour_date) : new Date('9999-12-31');
            return dateA - dateB;
        } else {
            const dateA = new Date(a.purchase_date || a.created_date);
            const dateB = new Date(b.purchase_date || b.created_date);
            return dateB - dateA;
        }
    });

    return filtered;
  }, [orders, searchTerm, statusFilter, priorityFilter, tourFilter, sortBy]);

  const uniqueTours = useMemo(() => {
    if (isLoading || !orders.length) return [];
    const tourSet = new Set(orders.map(o => o.tour).filter(Boolean));
    return Array.from(tourSet).sort();
  }, [orders, isLoading]);

  const handleSyncComplete = () => {
    loadOrders();
    setLastSyncTime(new Date());
    toast({
        title: "Sync Complete",
        description: "Your orders have been successfully synced.",
        status: "success",
    });
  };

  const handleStatusClick = (status) => {
    setStatusFilter(status);
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return "Syncing in 5s...";
    const now = new Date();
    const secondsAgo = Math.floor((now - lastSyncTime) / 1000);
    if (secondsAgo < 5) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return "1m ago";
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(filteredAndSortedOrders.map(o => o.id));
      setSelectedOrders(allIds);
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId, checked) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleBulkStatusChange = async () => {
    if (selectedOrders.size === 0 || (!bulkStatus && !bulkTagAction)) return;

    const applyTagAction = (currentTags, action) => {
      const nextTags = Array.isArray(currentTags) ? [...currentTags] : [];
      const tagSet = new Set(nextTags);

      switch (action) {
        case "add:reserved_date":
          tagSet.add("reserved_date");
          break;
        case "add:awaiting_reply":
          tagSet.add("awaiting_reply");
          break;
        case "remove:reserved_date":
          tagSet.delete("reserved_date");
          break;
        case "remove:awaiting_reply":
          tagSet.delete("awaiting_reply");
          break;
        case "clear":
          return [];
        default:
          return nextTags;
      }

      return Array.from(tagSet);
    };
    
    setIsUpdatingBulk(true);
    try {
      const updatePromises = Array.from(selectedOrders).map(orderId => {
        const currentOrder = orders.find(o => o.id === orderId);
        const updates = {};

        if (bulkStatus) {
          updates.status = bulkStatus;
        }

        if (bulkTagAction) {
          const currentTags = currentOrder?.tags || [];
          const nextTags = applyTagAction(currentTags, bulkTagAction);
          if (JSON.stringify(nextTags) !== JSON.stringify(currentTags)) {
            updates.tags = nextTags;
          }
        }

        if (Object.keys(updates).length === 0) {
          return Promise.resolve(null);
        }

        return Order.update(orderId, updates);
      });
      await Promise.all(updatePromises);
      
      await loadOrders();
      setSelectedOrders(new Set());
      setBulkStatus("");
      setBulkTagAction("");

      const summary = [];
      if (bulkStatus) {
        summary.push(`status → ${bulkStatus}`);
      }
      if (bulkTagAction) {
        const tagLabelMap = {
          "add:reserved_date": "add tag: Reserved Date",
          "add:awaiting_reply": "add tag: Awaiting Reply",
          "remove:reserved_date": "remove tag: Reserved Date",
          "remove:awaiting_reply": "remove tag: Awaiting Reply",
          clear: "clear all tags",
        };
        summary.push(tagLabelMap[bulkTagAction] || "update tags");
      }
      
      toast({
        title: "Bulk Update Complete ✅",
        description: `Updated ${selectedOrders.size} orders (${summary.join(", ")})`,
        duration: 4000,
      });
    } catch (error) {
      console.error("Bulk update failed:", error);
      toast({
        title: "Bulk Update Failed ❌",
        description: "There was an error updating orders",
        variant: "destructive",
      });
    }
    setIsUpdatingBulk(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Status Bug Alert */}
      {hasStatusBug && (
        <Alert className="border-red-900 bg-red-950">
          <Wrench className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <strong>Status Bug Detected:</strong> Some orders have incorrect status "complete" instead of "completed". Click to fix automatically.
              </div>
              <Button
                onClick={handleFixStatus}
                disabled={isFixingStatus}
                size="sm"
                className="bg-red-600 hover:bg-red-700 whitespace-nowrap text-white"
              >
                {isFixingStatus ? 'Fixing...' : 'Fix Now'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Migration Alert */}
      {needsMigration && (
        <Alert className="border-amber-900 bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <strong>Setup Required:</strong> Import your existing WooCommerce credentials to start syncing orders.
              </div>
              <Button
                onClick={handleMigration}
                disabled={isMigrating}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 whitespace-nowrap text-white"
              >
                {isMigrating ? 'Importing...' : 'Import Credentials'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Order Console</h1>
          <p className="text-sm md:text-base text-slate-300 mt-1 flex items-center gap-2">
            <span className="text-xs md:text-sm">
              {isAutoSyncing ? '🔄 Syncing...' : `✓ Auto-sync: ${formatLastSyncTime()}`}
            </span>
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 md:gap-3">
            <WooCommerceSync onSyncComplete={handleSyncComplete} />
        </div>
      </div>

      <StatsOverview 
        orders={orders} 
        isLoading={isLoading}
        onStatusClick={handleStatusClick}
      />

      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-700">
          <div className="flex flex-col gap-3 md:gap-4">
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            />
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[110px] md:w-40 text-xs md:text-sm bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending-payment">Pending Payment</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="tag:reserved_date">🏷️ Reserved Date</SelectItem>
                  <SelectItem value="tag:awaiting_reply">🏷️ Awaiting Reply</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] md:w-40 text-xs md:text-sm bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tour_date">
                    <div className="flex items-center gap-2">
                        <SortAsc className="w-3 h-3 md:w-4 md:h-4"/> Tour Date
                    </div>
                  </SelectItem>
                  <SelectItem value="purchase_date">
                    <div className="flex items-center gap-2">
                        <SortDesc className="w-3 h-3 md:w-4 md:h-4"/> Order Date
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={tourFilter} onValueChange={setTourFilter}>
                <SelectTrigger className="w-[110px] md:w-40 text-xs md:text-sm bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All Tours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tours</SelectItem>
                  {uniqueTours.map(tour => (
                    <SelectItem key={tour} value={tour}>{tour}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedOrders.size > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-700 rounded-lg border border-slate-600">
              <span className="text-xs md:text-sm font-medium text-white">
                {selectedOrders.size} selected
              </span>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-full sm:w-48 text-xs md:text-sm bg-slate-600 border-slate-500 text-white">
                  <SelectValue placeholder="Change status to..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending-payment">Pending Payment</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bulkTagAction} onValueChange={setBulkTagAction}>
                <SelectTrigger className="w-full sm:w-56 text-xs md:text-sm bg-slate-600 border-slate-500 text-white">
                  <SelectValue placeholder="Update tags..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add:reserved_date">Add tag: Reserved Date</SelectItem>
                  <SelectItem value="add:awaiting_reply">Add tag: Awaiting Reply</SelectItem>
                  <SelectItem value="remove:reserved_date">Remove tag: Reserved Date</SelectItem>
                  <SelectItem value="remove:awaiting_reply">Remove tag: Awaiting Reply</SelectItem>
                  <SelectItem value="clear">Clear all tags</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleBulkStatusChange}
                  disabled={(!bulkStatus && !bulkTagAction) || isUpdatingBulk}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none text-xs md:text-sm text-white"
                >
                  {isUpdatingBulk ? 'Updating...' : 'Apply'}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedOrders(new Set());
                    setBulkStatus("");
                    setBulkTagAction("");
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-xs md:text-sm text-slate-300 hover:text-white hover:bg-slate-600"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <OrdersTable 
          orders={filteredAndSortedOrders} 
          isLoading={isLoading}
          selectedOrders={selectedOrders}
          onSelectAll={handleSelectAll}
          onSelectOrder={handleSelectOrder}
          siteUrls={siteUrls}
        />
      </div>
    </div>
  );
}