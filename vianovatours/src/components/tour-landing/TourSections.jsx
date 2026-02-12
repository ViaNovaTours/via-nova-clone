import React, { useState } from "react";
import { Check, X, ChevronDown } from "lucide-react";

export default function TourSections({ tourConfig }) {
  const [activeTab, setActiveTab] = useState("highlights");

  const tabs = [
    { id: "highlights", label: "Highlights" },
    { id: "inclusions", label: "Inclusions" },
    { id: "exclusions", label: "Exclusions" },
    { id: "cancellation", label: "Cancellation policy" },
    { id: "know", label: "Know before you go" }
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 mb-8 overflow-x-auto">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-4 px-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-slate-900 font-semibold text-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Highlights Section */}
      {activeTab === "highlights" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Highlights</h2>
          <div className="space-y-4">
            {tourConfig.highlights && tourConfig.highlights.length > 0 ? (
              tourConfig.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-emerald-600 mt-1">•</span>
                  <p className="text-slate-700">{highlight}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-600">Explore the amazing features of {tourConfig.tour_name}</p>
            )}
          </div>

          {/* Gallery Images */}
          {tourConfig.gallery_images && tourConfig.gallery_images.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mt-8">
              {tourConfig.gallery_images.slice(0, 4).map((image, index) => (
                <div key={index} className="rounded-lg overflow-hidden shadow-md">
                  <img 
                    src={image} 
                    alt={`${tourConfig.tour_name} ${index + 1}`}
                    className="w-full h-64 object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inclusions Section */}
      {activeTab === "inclusions" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Inclusions</h2>
          <div className="space-y-3">
            {tourConfig.highlights && tourConfig.highlights.length > 0 ? (
              tourConfig.highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">{highlight}</p>
                </div>
              ))
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Entry to {tourConfig.tour_name}</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Skip-the-line access</p>
                </div>
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700">Mobile ticket</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Exclusions Section */}
      {activeTab === "exclusions" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Exclusions</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-700">Food and drinks</p>
            </div>
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-700">Transportation to/from the venue</p>
            </div>
            <div className="flex items-start gap-3">
              <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-slate-700">Gratuities</p>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Policy */}
      {activeTab === "cancellation" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Cancellation policy</h2>
          <p className="text-slate-700">
            These tickets can't be cancelled or rescheduled.
          </p>
        </div>
      )}

      {/* Know Before You Go */}
      {activeTab === "know" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-slate-900">Know before you go</h2>
          {tourConfig.description ? (
            <div className="prose max-w-none text-slate-700">
              <p>{tourConfig.description}</p>
            </div>
          ) : (
            <div className="space-y-4 text-slate-700">
              <p>• Please arrive 15 minutes before your scheduled time</p>
              <p>• Bring a valid ID for verification</p>
              <p>• Comfortable walking shoes are recommended</p>
              <p>• Mobile tickets are accepted</p>
            </div>
          )}

          {/* Additional Images */}
          {tourConfig.gallery_images && tourConfig.gallery_images.length > 2 && (
            <div className="mt-8">
              <img 
                src={tourConfig.gallery_images[1]} 
                alt={tourConfig.tour_name}
                className="w-full h-96 object-cover rounded-lg shadow-md"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}