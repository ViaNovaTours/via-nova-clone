import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TourFooter({ tourConfig }) {
  const currentYear = new Date().getFullYear();
  const domain = window.location.hostname;

  return (
    <footer className="bg-slate-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-lg font-bold mb-4">{tourConfig.tour_name}</h3>
            <p className="text-slate-400 text-sm">
              Premium ticket booking service for {tourConfig.tour_name}. Skip the line and enjoy your visit.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-slate-300">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/#book-now" className="text-slate-400 hover:text-white transition">Book Now</a></li>
              <li><a href="/#highlights" className="text-slate-400 hover:text-white transition">Highlights</a></li>
              <li><a href="/#location" className="text-slate-400 hover:text-white transition">Location</a></li>
              <li><Link to={createPageUrl("About")} className="text-slate-400 hover:text-white transition">About Us</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-slate-300">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy-policy" className="text-slate-400 hover:text-white transition">Privacy Policy</Link></li>
              <li><Link to="/terms-and-conditions" className="text-slate-400 hover:text-white transition">Terms & Conditions</Link></li>
              <li><Link to="/refund-policy" className="text-slate-400 hover:text-white transition">Refund Policy</Link></li>
              <li><Link to={createPageUrl("Contact")} className="text-slate-400 hover:text-white transition">Contact Us</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold mb-4 text-slate-300">Support</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {tourConfig.confirmation_email_from && (
                <li>Email: {tourConfig.confirmation_email_from}</li>
              )}
              <li>Response time: 24-48 hours</li>
              <li>Available: Mon-Fri 9AM-5PM</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-center">
          <p className="text-slate-400 text-sm">
            © {currentYear} {tourConfig.tour_name} Tickets. All rights reserved.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            {domain}
          </p>
        </div>
      </div>
    </footer>
  );
}