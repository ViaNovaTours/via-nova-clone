import React, { useState, useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import TourLandingPage from "../components/tour-landing/TourLandingPage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TourPreview() {
  const [tours, setTours] = useState([]);
  const [selectedTour, setSelectedTour] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTours = async () => {
      try {
        const toursData = await base44.entities.TourLandingPage.list();
        setTours(toursData);
        if (toursData.length > 0) {
          setSelectedTour(toursData[0]);
        }
      } catch (error) {
        console.error("Error loading tours:", error);
      }
      setIsLoading(false);
    };

    loadTours();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (tours.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">No Tours Available</h1>
          <p className="text-slate-600">Create a tour in the Tour Landing Pages admin section first.</p>
        </div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <div>
        {/* Tour Selector */}
        <div className="bg-slate-900 border-b border-slate-700 p-4">
          <div className="max-w-md mx-auto">
            <Select 
              value={selectedTour?.id} 
              onValueChange={(id) => setSelectedTour(tours.find(t => t.id === id))}
            >
              <SelectTrigger className="bg-slate-800 text-white border-slate-700">
                <SelectValue placeholder="Select a tour to preview" />
              </SelectTrigger>
              <SelectContent>
                {tours.map(tour => (
                  <SelectItem key={tour.id} value={tour.id}>
                    {tour.tour_name} ({tour.domain})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Landing Page Preview */}
        {selectedTour && <TourLandingPage tourConfig={selectedTour} />}
      </div>
    </HelmetProvider>
  );
}