import React, { useState, useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import TourFooter from "../components/tour-landing/TourFooter";
import TourNavigation from "../components/tour-landing/TourNavigation";

export default function TermsAndConditions() {
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
        <title>Terms & Conditions – {tourConfig.tour_name}</title>
        <meta name="description" content={`Terms and conditions for ${tourConfig.tour_name} ticket booking service.`} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <TourNavigation tourName={tourConfig.tour_name} />

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms & Conditions</h1>
          <p className="text-slate-600 mb-8"><strong>Last updated:</strong> 2/9/2026</p>

          <p className="text-slate-700 mb-4">
            These Terms & Conditions ("Terms") govern your use of this website (the "Site") and any booking made through it.
            The Site is operated by <strong>Blue Muse LLC</strong>, doing business as <strong>Via Nova Tours</strong> ("Via Nova Tours," "we," "us," "our").
          </p>
          <p className="text-slate-700 mb-8">By accessing the Site or completing a booking, you agree to be bound by these Terms.</p>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1) Who We Are</h2>
            <p className="text-slate-700 mb-4">
              Via Nova Tours operates an independent online booking platform that facilitates access to attraction tickets and travel experiences
              offered by third-party providers (the "Suppliers"), such as attractions, tour operators, and authorized ticket distributors.
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>We are <strong>not</strong> the operator of the experiences listed on the Site.</li>
              <li>We do <strong>not</strong> control the venues, attractions, or tours.</li>
              <li>We provide a <strong>booking and payment facilitation service</strong> and customer support related to your reservation.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2) Booking Relationship (Contracting Parties)</h2>
            <p className="text-slate-700 mb-4">When you book through the Site:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>The <strong>contract for the experience</strong> is formed <strong>directly between you and the Supplier</strong>.</li>
              <li>
                Via Nova Tours acts as a <strong>platform and facilitator</strong> that enables you to discover, book, and pay for the Supplier's
                services and receive your ticket or booking confirmation.
              </li>
              <li>
                The Supplier is solely responsible for providing the experience, including entry, operations, safety, accessibility, schedule changes,
                and cancellations.
              </li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3) Supplier Terms Take Precedence</h2>
            <p className="text-slate-700 mb-4">
              Your use of the booked experience is subject to the <strong>Supplier's own terms, conditions, rules, and entry requirements</strong>
              ("Supplier Terms").
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>You agree to comply with all applicable Supplier Terms.</li>
              <li>
                If there is any conflict between these Terms and the Supplier Terms regarding the delivery of the experience,
                the <strong>Supplier Terms shall prevail</strong>.
              </li>
              <li>Via Nova Tours is not responsible for the content or enforcement of Supplier Terms.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4) Prices, Fees, and Currency</h2>
            <p className="text-slate-700 mb-4">Prices displayed at checkout may include:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>the Supplier's ticket price,</li>
              <li>our <strong>service/booking fee</strong>, and</li>
              <li>payment processing and operational costs.</li>
            </ul>
            <p className="text-slate-700 mb-4"><strong>Important:</strong></p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Prices may be above face value to reflect service fees, demand, fulfillment costs, customer support, and processing.</li>
              <li>Prices may change at any time prior to purchase.</li>
              <li>If currency conversion applies, your bank or payment provider may apply its own exchange rate and additional fees.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5) Taxes (VAT / Sales Tax)</h2>
            <p className="text-slate-700 mb-4">
              Where required by law or the Supplier's policies, applicable taxes (including VAT or similar consumption taxes) may be included in the
              price shown at checkout or applied as required.
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Any legally required <strong>tax invoice</strong> for the experience is generally issued by the <strong>Supplier</strong>.</li>
              <li>Via Nova Tours can provide a <strong>payment receipt</strong> upon request.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6) Order Processing & Ticket Delivery</h2>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Tickets or booking confirmations are delivered electronically (typically via email). We do not mail physical tickets.</li>
              <li>Some bookings may be fulfilled immediately; others may be fulfilled later if official inventory is released closer to the visit date.</li>
              <li>You are responsible for providing a correct email address and checking spam/junk folders.</li>
              <li>Tickets are valid <strong>only</strong> for the date/time selected unless otherwise stated.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7) Customer Responsibilities</h2>
            <p className="text-slate-700 mb-4">You agree to:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>arrive on time (we recommend at least <strong>15 minutes early</strong>),</li>
              <li>follow all venue rules, security requirements, and staff instructions,</li>
              <li>bring any required identification and/or the payment card used,</li>
              <li>verify names, dates, times, and quantities before purchase.</li>
            </ul>
            <p className="text-slate-700 mb-4">
              Entry may be refused by the Supplier for reasons outside our control (e.g., late arrival, ID mismatch, security rules, capacity or safety restrictions).
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8) Changes, Unavailability, and Substitutions</h2>
            <p className="text-slate-700 mb-4">If your selected time/date becomes unavailable due to Supplier inventory or operational changes:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>we may offer an alternative time/date (typically the same day or nearest available), or</li>
              <li>if no suitable alternative is available, we will refund according to Section 9.</li>
            </ul>
            <p className="text-slate-700 mb-4">
              If we request your response to an alternative, you agree to respond promptly. If no response is received within a reasonable timeframe
              (e.g., <strong>4 hours</strong> for near-term visits), we may issue a refund to avoid delivering unusable tickets.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9) Cancellation & Refund Policy</h2>
            <p className="text-slate-700 mb-4"><strong>All sales are final once tickets are issued/confirmed</strong>, except where required by law or as stated below.</p>

            <p className="text-slate-700 mb-4">Refunds may be issued only if:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>we cannot fulfill your booking,</li>
              <li>the Supplier cancels the experience and authorizes refunds, or</li>
              <li>there is a verified duplicate charge or billing/technical error attributable to us.</li>
            </ul>

            <p className="text-slate-700 mb-4">No refunds are issued for:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>no-shows or late arrivals,</li>
              <li>personal schedule conflicts, travel delays, or weather,</li>
              <li>venue policy decisions (unless the Supplier authorizes refunds),</li>
              <li>dissatisfaction with the experience once delivered by the Supplier.</li>
            </ul>

            <p className="text-slate-700 mb-4">
              Approved refunds are issued to the original payment method where possible. Processing times vary by bank and may take
              <strong> 5–10 business days</strong> or longer.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10) Payments & Chargebacks</h2>
            <p className="text-slate-700 mb-4">
              If you have an issue with your booking, contact us before initiating a chargeback. Unjustified chargebacks may result in booking restrictions
              and the submission of documentation (tickets issued, supplier confirmations, communications) to the payment network or bank.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11) Limitation of Liability</h2>
            <p className="text-slate-700 mb-4">To the maximum extent permitted by law:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>
                Via Nova Tours is not liable for the acts or omissions of Suppliers, venue closures, schedule changes, denied entry, force majeure events,
                or the quality of the experience.
              </li>
              <li>Our total liability for any claim related to a booking shall not exceed the amount you paid for that booking through the Site.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">12) Intellectual Property</h2>
            <p className="text-slate-700 mb-4">
              All Site content (including text, graphics, logos, and design) is owned by or licensed to Via Nova Tours and may not be copied or reused
              without permission.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">13) Changes to These Terms</h2>
            <p className="text-slate-700 mb-4">
              We may update these Terms at any time. The "Last updated" date reflects the most recent revision. Continued use of the Site after changes
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">14) Contact</h2>
            <p className="text-slate-700 mb-4">
              <strong>Via Nova Tours (Blue Muse LLC)</strong><br />
              Email: <a href="mailto:info@vianovatours.com" className="text-emerald-600 hover:underline">info@vianovatours.com</a>
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">15) Governing Law</h2>
            <p className="text-slate-700 mb-4">
              These Terms are governed by the laws of the <strong>State of Washington, USA</strong>, without regard to conflict of laws principles.
            </p>
          </section>
        </div>
      </div>

      <TourFooter tourConfig={tourConfig} />
      </div>
    </HelmetProvider>
  );
}

TermsAndConditions.useLayout = false;