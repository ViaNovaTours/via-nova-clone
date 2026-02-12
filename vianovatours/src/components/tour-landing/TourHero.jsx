import React from "react";

export default function TourHero({ title, subtitle, imageUrl }) {
  return (
    <div 
      className="relative h-[400px] bg-cover bg-center"
      style={{ backgroundImage: imageUrl ? `url(${imageUrl})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>
      <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center">
        <div className="text-white max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">{title}</h1>
          {subtitle && (
            <p className="text-xl md:text-2xl font-light">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}