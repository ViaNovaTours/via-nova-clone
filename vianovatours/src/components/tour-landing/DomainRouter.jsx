import React, { useState, useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import TourLandingPage from "./TourLandingPage";
import MainHomepage from "../main-site/MainHomepage";

export default function DomainRouter() {
  const [tourConfig, setTourConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMainSite, setIsMainSite] = useState(false);

  useEffect(() => {
    const loadTourConfig = async () => {
      try {
        const hostname = window.location.hostname;
        
        // Check if this is the main Via Nova Tours site
        if (hostname === 'vianovatours.com' || hostname === 'www.vianovatours.com') {
          setIsMainSite(true);
          setIsLoading(false);
          return;
        }
        
        // Fetch tour configuration based on domain
        const tours = await base44.entities.TourLandingPage.filter({ 
          domain: hostname,
          is_active: true 
        });

        if (tours.length > 0) {
          setTourConfig(tours[0]);
        } else {
          setError("Tour not found for this domain");
        }
      } catch (err) {
        console.error("Error loading tour config:", err);
        setError("Failed to load tour configuration");
      } finally {
        setIsLoading(false);
      }
    };

    loadTourConfig();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (isMainSite) {
    return (
      <HelmetProvider>
        <MainHomepage />
      </HelmetProvider>
    );
  }

  if (error || !tourConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Tour Not Found</h1>
          <p className="text-slate-400">{error || "This domain is not configured"}</p>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <TourLandingPage tourConfig={tourConfig} />
    </HelmetProvider>
  );
}