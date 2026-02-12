import React from "react";
import { CheckCircle } from "lucide-react";

export default function TourHighlights({ highlights }) {
  return (
    <div className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Tour Highlights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {highlights.map((highlight, index) => (
            <div key={index} className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <p className="text-lg text-slate-700">{highlight}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}