import React, { useState, useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import { Shield, Clock, Award, Users } from "lucide-react";
import TourFooter from "../components/tour-landing/TourFooter";
import TourNavigation from "../components/tour-landing/TourNavigation";

About.useLayout = false;

export default function About() {
  const [tourConfig, setTourConfig] = useState(null);

  useEffect(() => {
    const loadTourConfig = async () => {
      const hostname = window.location.hostname;
      const tours = await base44.entities.TourLandingPage.filter({ 
        domain: hostname,
        is_active: true 
      });
      if (tours.length > 0) setTourConfig(tours[0]);
    };
    loadTourConfig();
  }, []);

  if (!tourConfig) return null;

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-white">
      <Helmet>
        <title>About Us – {tourConfig.tour_name}</title>
        <meta name="description" content={`Learn about ${tourConfig.tour_name} ticket booking service and why thousands trust us.`} />
      </Helmet>

      <TourNavigation tourName={tourConfig.tour_name} />

      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">About {tourConfig.tour_name} Tickets</h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Your trusted partner for hassle-free ticket booking and unforgettable experiences.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Mission</h2>
            <p className="text-slate-700 mb-4 text-lg">
              We're dedicated to making your visit to {tourConfig.tour_name} as smooth and enjoyable as possible. 
              By providing skip-the-line tickets and instant confirmations, we help you spend less time waiting 
              and more time exploring.
            </p>
            <p className="text-slate-700 text-lg">
              Founded on the principle that travel should be stress-free, we've helped thousands of visitors 
              secure their tickets quickly and reliably.
            </p>
          </div>

          <div>
            {tourConfig.hero_image_url && (
              <img 
                src={tourConfig.hero_image_url} 
                alt={tourConfig.tour_name}
                className="w-full h-80 object-cover rounded-lg shadow-lg"
              />
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Secure Booking</h3>
            <p className="text-sm text-slate-600">Safe and encrypted payment processing</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Instant Confirmation</h3>
            <p className="text-sm text-slate-600">Get your tickets immediately via email</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">Best Prices</h3>
            <p className="text-sm text-slate-600">Competitive rates for all ticket types</p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">24/7 Support</h3>
            <p className="text-sm text-slate-600">Friendly customer service team</p>
          </div>
        </div>

        <div className="bg-slate-50 p-8 md:p-12 rounded-lg">
          <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">Why Book With Us?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex gap-4">
              <span className="text-emerald-600 font-bold text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Skip-the-Line Access</h3>
                <p className="text-slate-700">Avoid long queues and maximize your time at the attraction.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="text-emerald-600 font-bold text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Mobile Tickets</h3>
                <p className="text-slate-700">No printing required - just show your phone at the entrance.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="text-emerald-600 font-bold text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Easy Booking Process</h3>
                <p className="text-slate-700">Select your date, tickets, and complete checkout in minutes.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <span className="text-emerald-600 font-bold text-2xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Trusted by Thousands</h3>
                <p className="text-slate-700">Join countless satisfied visitors who booked through us.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TourFooter tourConfig={tourConfig} />
      </div>
    </HelmetProvider>
  );
}