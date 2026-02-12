import React, { useState, useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import TourFooter from "../components/tour-landing/TourFooter";
import TourNavigation from "../components/tour-landing/TourNavigation";

RefundPolicy.useLayout = false;

export default function RefundPolicy() {
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
        <title>Refund Policy – {tourConfig.tour_name}</title>
        <meta name="description" content={`Refund policy for ${tourConfig.tour_name} ticket bookings.`} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <TourNavigation tourName={tourConfig.tour_name} />

      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Refund Policy</h1>
        
        <div className="prose prose-slate max-w-none">
          <p className="text-slate-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Standard Policy</h2>
            <p className="text-slate-700 mb-4">
              <strong>These tickets cannot be cancelled or rescheduled once purchased.</strong> 
              Due to the nature of advance bookings and venue requirements, we are unable to offer refunds for change of plans, 
              missed visits, or late arrivals.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Eligible Refunds</h2>
            <p className="text-slate-700 mb-4">
              Refunds will be issued in the following circumstances:
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2">
              <li><strong>Venue Closure:</strong> If the venue is closed on your scheduled date due to unforeseen circumstances</li>
              <li><strong>Booking Errors:</strong> If we made an error in processing your booking</li>
              <li><strong>Duplicate Charges:</strong> If you were charged more than once for the same booking</li>
              <li><strong>Service Not Delivered:</strong> If tickets were not provided as promised</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">How to Request a Refund</h2>
            <p className="text-slate-700 mb-4">
              If you believe your situation qualifies for a refund:
            </p>
            <ol className="list-decimal pl-6 text-slate-700 space-y-2">
              <li>Contact us within 48 hours of your scheduled visit</li>
              <li>Provide your booking confirmation number</li>
              <li>Explain the reason for your refund request</li>
              <li>Include any supporting documentation (venue closure notices, etc.)</li>
            </ol>
            {tourConfig.confirmation_email_from && (
              <p className="text-slate-700 mt-4">Email: {tourConfig.confirmation_email_from}</p>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Refund Processing</h2>
            <ul className="list-disc pl-6 text-slate-700 space-y-2">
              <li>Refund requests are reviewed within 3-5 business days</li>
              <li>Approved refunds are processed within 7-10 business days</li>
              <li>Refunds are issued to the original payment method</li>
              <li>Processing fees may be deducted from the refund amount</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Travel Insurance</h2>
            <p className="text-slate-700 mb-4">
              We strongly recommend purchasing travel insurance to protect your booking against unforeseen circumstances such as:
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2">
              <li>Personal illness or injury</li>
              <li>Flight cancellations or delays</li>
              <li>Family emergencies</li>
              <li>Weather-related travel disruptions</li>
            </ul>
            <p className="text-slate-700 mt-4">
              Travel insurance can provide coverage when our standard refund policy does not apply.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Questions?</h2>
            <p className="text-slate-700">
              If you have questions about our refund policy, please contact our customer support team. 
              We're here to help and will do our best to assist you with your situation.
            </p>
          </section>
        </div>
      </div>

      <TourFooter tourConfig={tourConfig} />
      </div>
    </HelmetProvider>
  );
}