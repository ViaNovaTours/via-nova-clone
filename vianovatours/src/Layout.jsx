import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Plus,
  CheckCircle,
  Calendar,
  Clock,
  XCircle,
  CalendarDays,
  DollarSign, // Added DollarSign icon
  Megaphone, // Added Megaphone icon for Ad Spend
  FileText, // Added FileText icon for Export Orders
  Settings, // Added Settings icon for Tour Setup
  MapPin, // Added MapPin icon for Tours
  LogOut, // Added LogOut icon
  Globe, // Added Globe icon for Tour Landing Admin
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/toaster";
import { User } from '@/entities/User'; // Added User entity import
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { isAdminHost } from "@/lib/host-routing";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Calendar",
    url: createPageUrl("Calendar"),
    icon: Calendar,
  },
  {
    title: "Tours",
    url: createPageUrl("Tours"),
    icon: MapPin,
  }
];

// Admin-only navigation items
const adminNavigationItems = [
  {
    title: "Profits",
    url: createPageUrl("Profits"),
    icon: DollarSign,
  },
  {
    title: "Ad Spend",
    url: createPageUrl("AdSpend"),
    icon: Megaphone,
  },
  {
    title: "Export Orders",
    url: createPageUrl("ExportOrders"),
    icon: FileText,
  },
  {
    title: "Tour Setup",
    url: createPageUrl("TourSetup"),
    icon: Settings,
  },
  {
    title: "Tour Landing Admin",
    url: createPageUrl("TourLandingAdmin"),
    icon: Globe,
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [sidebarStats, setSidebarStats] = useState({ new: 0, reserved: 0, complete: 0, failed: 0 });
  const [user, setUser] = useState(null);
  const hostname = window.location.hostname;
  const showDashboardLayout = isAdminHost(hostname);

  // Load user and stats for sidebar
  useEffect(() => {
    const loadData = async () => {
      if (!showDashboardLayout) {
        return;
      }
      try {
        // Load user info
        const currentUser = await User.me();
        setUser(currentUser);

        // Load stats
        const { Order } = await import('@/entities/Order');
        const orders = await Order.list();

        const unprocessedCount = orders.filter(o => o.status === 'unprocessed').length;
        const reservedCount = orders.filter(o => o.tags && o.tags.includes('reserved_date')).length;
        const completeCount = orders.filter(o => o.status === 'completed').length;
        const failedCount = orders.filter(o => o.status === 'failed').length;

        setSidebarStats({ unprocessed: unprocessedCount, reserved: reservedCount, complete: completeCount, failed: failedCount });
      } catch (error) {
        console.log('Could not load sidebar data', error);
      }
    };

    loadData();
  }, [showDashboardLayout]);

  // Combine regular navigation with admin-only items if user is admin
  const allNavigationItems = useMemo(() => {
    const items = [...navigationItems];
    if (user?.role === 'admin') {
      items.push(...adminNavigationItems);
    }
    return items;
  }, [user]); // Dependency on user state

  if (!showDashboardLayout) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-slate-900">
        <Sidebar className="border-r border-slate-700 bg-slate-800">
          <SidebarHeader className="border-b border-slate-700 p-6 bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">Order Console</h2>
                <p className="text-xs text-slate-400">VA Ticket Management</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4 bg-slate-800">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                Operations
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {allNavigationItems.map((item) => ( // Using allNavigationItems
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-slate-700 transition-all duration-200 rounded-lg px-3 py-2 ${
                          location.pathname === item.url
                            ? 'bg-slate-700 text-white font-medium'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="w-5 h-5" />
                          <span>{item.title}</span>
                          {(item.title === "Profits" || item.title === "Ad Spend" || item.title === "Export Orders" || item.title === "Tour Setup" || item.title === "Tour Landing Admin") && (
                            <Badge className="ml-auto bg-emerald-100 text-emerald-800 text-xs px-1.5 py-0.5">Admin</Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-700 p-4 bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.role === 'admin' ? 'A' : 'VA'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-200 text-sm truncate">
                  {user?.role === 'admin' ? 'Administrator' : 'Virtual Assistant'}
                </p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => base44.auth.logout()}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-700 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-white">Order Console</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-slate-900">
            {children}
          </div>
        </main>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}