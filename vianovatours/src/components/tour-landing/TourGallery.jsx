import React from "react";

export default function TourGallery({ images }) {
  return (
    <div className="py-16 bg-slate-50 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Gallery</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img, index) => (
            <div 
              key={index}
              className="aspect-square overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              <img 
                src={img} 
                alt={`Gallery image ${index + 1}`}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}