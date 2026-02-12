import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import Dashboard from "./Dashboard";
import DomainRouter from "../components/tour-landing/DomainRouter";
import Layout from "../Layout";
import { isAdminHost } from "@/lib/host-routing";

// This is the main entry point - routes based on domain
Home.useLayout = false;

export default function Home() {
  const [route, setRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const determineRoute = async () => {
      const hostname = window.location.hostname;
      
      // Backend domain - requires auth
      if (isAdminHost(hostname)) {
        // Check if user is authenticated
        try {
          const user = await base44.auth.me();
          if (user) {
            setRoute('dashboard');
          } else {
            base44.auth.redirectToLogin();
            return;
          }
        } catch (error) {
          base44.auth.redirectToLogin();
          return;
        }
      } else {
        // Any other domain = public tour landing page
        setRoute('tour');
      }
      
      setIsLoading(false);
    };

    determineRoute();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (route === 'dashboard') {
    return (
      <Layout currentPageName="Dashboard">
        <Dashboard />
      </Layout>
    );
  }

  if (route === 'tour') {
    return <DomainRouter />;
  }

  return null;
}