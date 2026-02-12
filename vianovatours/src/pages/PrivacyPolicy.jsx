import React, { useState, useEffect } from "react";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { base44 } from "@/api/base44Client";
import TourFooter from "../components/tour-landing/TourFooter";
import TourNavigation from "../components/tour-landing/TourNavigation";

PrivacyPolicy.useLayout = false;

export default function PrivacyPolicy() {
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
        <title>Privacy Policy – {tourConfig.tour_name}</title>
        <meta name="description" content={`Privacy policy for ${tourConfig.tour_name} ticket booking service.`} />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <TourNavigation tourName={tourConfig.tour_name} />

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
          <p className="text-slate-600 mb-8"><strong>Last updated:</strong> 2/9/2026</p>

          <p className="text-slate-700 mb-4">
            This Privacy Policy explains how <strong>Blue Muse LLC</strong>, doing business as <strong>Via Nova Tours</strong> ("Via Nova Tours," "we," "us," or "our"),
            collects, uses, discloses, and protects your personal information when you use our website(s) (the "Site") and our booking services.
          </p>

          <p className="text-slate-700 mb-8">
            By using our Site, you agree to the collection and use of information in accordance with this Privacy Policy.
          </p>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1) Information We Collect</h2>
            <p className="text-slate-700 mb-4">We may collect the following categories of information:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li><strong>Personal information:</strong> name, email address, phone number, and other contact details you provide during checkout or support inquiries.</li>
              <li><strong>Booking information:</strong> attraction/tour selected, date and time, ticket quantities, and related reservation details.</li>
              <li><strong>Payment information:</strong> payment details are processed securely by our payment providers (e.g., Stripe or similar). We do not store full card numbers on our servers.</li>
              <li><strong>Technical data:</strong> IP address, browser type, device information, operating system, referring URLs, and general usage data.</li>
              <li><strong>Cookies and similar technologies:</strong> used for functionality, analytics, and performance optimization.</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2) How We Use Your Information</h2>
            <p className="text-slate-700 mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Process and manage your booking and deliver tickets or booking confirmations</li>
              <li>Communicate with you about your order, including confirmations, updates, or issues</li>
              <li>Provide customer support and respond to inquiries</li>
              <li>Improve our website, services, and user experience</li>
              <li>Prevent fraud, abuse, or misuse of our services</li>
              <li>Comply with legal, regulatory, and accounting obligations</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3) Legal Bases for Processing (For EEA/UK Users)</h2>
            <p className="text-slate-700 mb-4">
              If you are located in the European Economic Area (EEA) or the United Kingdom, we process your personal data under the following legal bases:
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>To perform a contract (e.g., to process and manage your booking)</li>
              <li>To comply with legal obligations</li>
              <li>For our legitimate interests (e.g., fraud prevention, service improvement, customer support)</li>
              <li>With your consent, where required (e.g., for certain cookies or marketing communications)</li>
            </ul>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4) How We Share Your Information</h2>
            <p className="text-slate-700 mb-4">We may share your information with:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li><strong>Suppliers (attractions, tour operators, ticket providers):</strong> to fulfill your booking and provide the experience</li>
              <li><strong>Payment processors:</strong> to process payments securely</li>
              <li><strong>Service providers:</strong> such as email delivery services, hosting providers, analytics providers, and customer support tools</li>
              <li><strong>Authorities or legal advisors:</strong> where required by law, regulation, or legal process</li>
            </ul>
            <p className="text-slate-700 mb-4">
              We do not sell your personal information.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5) International Data Transfers</h2>
            <p className="text-slate-700 mb-4">
              We are based in the United States. Your information may be transferred to, processed, and stored in the United States or other countries
              where our service providers or partners operate. Where required by law, we use appropriate safeguards to protect your data.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6) Data Security</h2>
            <p className="text-slate-700 mb-4">
              We implement reasonable technical and organizational measures to protect your personal information against unauthorized access, loss,
              misuse, or alteration. Payment information is handled by PCI-compliant payment processors and is not stored directly on our servers.
            </p>
            <p className="text-slate-700 mb-4">
              However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7) Data Retention</h2>
            <p className="text-slate-700 mb-4">
              We retain your personal information only as long as necessary to fulfill the purposes described in this Privacy Policy, including
              for legal, accounting, or reporting requirements.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8) Cookies and Tracking Technologies</h2>
            <p className="text-slate-700 mb-4">
              We use cookies and similar technologies to:
            </p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Enable core website functionality</li>
              <li>Analyze website traffic and usage</li>
              <li>Improve performance and user experience</li>
            </ul>
            <p className="text-slate-700 mb-4">
              You can control or disable cookies through your browser settings. Please note that disabling cookies may affect the functionality of the Site.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9) Your Rights</h2>
            <p className="text-slate-700 mb-4">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 text-slate-700 space-y-2 mb-4">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate or incomplete data</li>
              <li>Request deletion of your personal data (subject to legal obligations)</li>
              <li>Object to or restrict certain processing</li>
              <li>Request data portability</li>
              <li>Withdraw consent where processing is based on consent</li>
              <li>Opt out of marketing communications at any time</li>
            </ul>
            <p className="text-slate-700 mb-4">
              To exercise your rights, please contact us using the details below.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10) Third-Party Links</h2>
            <p className="text-slate-700 mb-4">
              Our Site may contain links to third-party websites. We are not responsible for the privacy practices or content of those websites.
              We encourage you to review their privacy policies before providing any personal information.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11) Children's Privacy</h2>
            <p className="text-slate-700 mb-4">
              Our services are not directed to children under 13 (or under 16 in certain jurisdictions), and we do not knowingly collect personal
              information from children. If you believe a child has provided us with personal data, please contact us so we can delete it.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">12) Changes to This Privacy Policy</h2>
            <p className="text-slate-700 mb-4">
              We may update this Privacy Policy from time to time. The "Last updated" date at the top indicates when it was last revised.
              Continued use of the Site after changes means you accept the updated policy.
            </p>
          </section>

          <hr className="my-8 border-slate-200" />

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">13) Contact Us</h2>
            <p className="text-slate-700 mb-4">
              If you have any questions about this Privacy Policy or how we handle your data, please contact us:
            </p>
            <p className="text-slate-700 mb-4">
              <strong>Via Nova Tours (Blue Muse LLC)</strong><br />
              Email: <a href="mailto:info@vianovatours.com" className="text-emerald-600 hover:underline">info@vianovatours.com</a>
            </p>
          </section>
        </div>
      </div>

      <TourFooter tourConfig={tourConfig} />
      </div>
    </HelmetProvider>
  );
}