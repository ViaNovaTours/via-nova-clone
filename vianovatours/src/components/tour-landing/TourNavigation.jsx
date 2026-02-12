import React, { useState, useEffect } from "react";

export default function TourNavigation({ tourName }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo/Tour Name */}
          <h1 className="text-xl font-bold text-slate-900">{tourName}</h1>

          {/* Right Side Actions */}
          <a 
            href="/#book-now"
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-md transition-colors font-medium"
          >
            Book Now
          </a>
        </div>
      </div>
    </nav>
  );
}