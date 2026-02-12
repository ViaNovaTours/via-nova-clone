import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, MapPin, Globe, Search, ChevronRight, Star, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function MainHomepage() {
  const [allTours, setAllTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadTours = async () => {
      try {
        const [tourPages, tourDetails, wooCredentials] = await Promise.all([
          base44.entities.TourLandingPage.filter({ is_active: true }),
          base44.entities.Tour.list(),
          base44.entities.WooCommerceCredentials.filter({ is_active: true })
        ]);

        // Landing page tours
        const landingTours = tourPages
          .map(page => {
            const details = tourDetails.find(t => t.name === page.tour_name);
            return {
              id: page.id,
              name: page.tour_name,
              country: details?.country || "Other",
              image_url: details?.image_url || page.hero_image_url,
              description: page.hero_subtitle || page.description?.substring(0, 120),
              url: `https://${page.domain}`,
              type: 'landing',
              physical_address: details?.physical_address
            };
          })
          .filter(t => t.url);

        // WooCommerce tours
        const wooTours = wooCredentials
          .map(cred => {
            const details = tourDetails.find(t => t.woocommerce_site_name === cred.site_name);
            return {
              id: cred.id,
              name: cred.tour_name,
              country: details?.country || "Other",
              image_url: details?.image_url,
              description: `Explore ${cred.tour_name} with instant ticket booking`,
              url: cred.website_url,
              type: 'woocommerce',
              physical_address: details?.physical_address
            };
          })
          .filter(t => t.url);

        const combined = [...landingTours, ...wooTours];
        setAllTours(combined);
      } catch (error) {
        console.error("Error loading tours:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTours();
  }, []);

  const filteredTours = allTours.filter(tour =>
    tour.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tour.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tour.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedByCountry = filteredTours.reduce((acc, tour) => {
    const country = tour.country || "Other";
    if (!acc[country]) acc[country] = [];
    acc[country].push(tour);
    return acc;
  }, {});

  // Extract city from physical address
  const extractCity = (address) => {
    if (!address) return null;
    const parts = address.split(',');
    if (parts.length >= 2) {
      return parts[parts.length - 2].trim();
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section with Search */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/20"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              The world's best experiences<br/>
              <span className="text-emerald-200">curated just for you</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-2xl mx-auto">
              Discover amazing destinations and iconic landmarks around the world
            </p>
            
            {/* Search Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for destinations, cities, or experiences..."
                  className="w-full pl-12 pr-4 py-6 text-lg rounded-xl border-0 shadow-2xl bg-white/95 backdrop-blur-sm focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Value Props */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Only the finest</h3>
              <p className="text-sm text-slate-600">We do the hard work so you don't have to</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">💚</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Greed is good</h3>
              <p className="text-sm text-slate-600">Best prices, last-minute availability, 24x7 support</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎭</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-2">Experience every flavour</h3>
              <p className="text-sm text-slate-600">Tours, shows, museums - we have them all</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">😎</span>
              </div>
              <h3 className="font-bold text-slate-900 mb-2">No pain, only gain</h3>
              <p className="text-sm text-slate-600">We'll give you your money back. Not cocky, confident.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tours by Country */}
      <div className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-16">
          {Object.keys(groupedByCountry).length > 0 ? (
            <div className="space-y-16">
              {Object.entries(groupedByCountry).map(([country, countryTours]) => {
                // Group by city within each country
                const toursByCity = countryTours.reduce((acc, tour) => {
                  const city = extractCity(tour.physical_address) || 'Featured';
                  if (!acc[city]) acc[city] = [];
                  acc[city].push(tour);
                  return acc;
                }, {});

                return (
                  <div key={country}>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                          <Globe className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-bold text-slate-900">{country}</h2>
                          <p className="text-slate-600">{countryTours.length} experiences available</p>
                        </div>
                      </div>
                    </div>

                    {/* Cities within country */}
                    {Object.entries(toursByCity).map(([city, cityTours]) => (
                      <div key={city} className="mb-12">
                        <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-emerald-600" />
                          {city}
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {cityTours.map((tour) => (
                            <Card 
                              key={tour.id} 
                              className="group overflow-hidden border-slate-200 hover:border-emerald-400 transition-all duration-300 hover:shadow-2xl bg-white"
                            >
                              <CardContent className="p-0">
                                <a href={tour.url} target="_blank" rel="noopener noreferrer" className="block">
                                  <div className="relative h-56 overflow-hidden">
                                    {tour.image_url ? (
                                      <>
                                        <img 
                                          src={tour.image_url} 
                                          alt={tour.name}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                                      </>
                                    ) : (
                                      <div className="h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                                        <MapPin className="w-16 h-16 text-white/30" />
                                      </div>
                                    )}
                                    
                                    {/* Type Badge */}
                                    <div className="absolute top-3 right-3">
                                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-slate-900 backdrop-blur-sm">
                                        {tour.type === 'landing' ? '⚡ Instant' : '🎟️ Book Now'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="p-5">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
                                      {tour.name}
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                                      {tour.description}
                                    </p>
                                    
                                    <div className="flex items-center justify-between">
                                      <span className="text-emerald-600 text-sm font-semibold flex items-center gap-1">
                                        View Details
                                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                      </span>
                                    </div>
                                  </div>
                                </a>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <MapPin className="w-20 h-20 text-slate-300 mx-auto mb-6" />
              <h3 className="text-3xl font-bold text-slate-900 mb-3">
                {searchQuery ? 'No results found' : 'No Tours Available Yet'}
              </h3>
              <p className="text-slate-600 text-lg">
                {searchQuery ? 'Try searching for something else' : 'Check back soon for amazing destinations!'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-emerald-400">Via Nova Tours</h3>
              <p className="text-slate-400 mb-4">
                Your gateway to unforgettable experiences around the world. Book with confidence.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-emerald-400">Quick Stats</h4>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {Object.keys(groupedByCountry).length} Countries
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {allTours.length} Destinations
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  24/7 Support
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-emerald-400">Contact</h4>
              <a href="mailto:vianovatours@gmail.com" className="text-slate-400 hover:text-emerald-400 transition-colors">
                vianovatours@gmail.com
              </a>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 text-center text-slate-500">
            <p>© {new Date().getFullYear()} Via Nova Tours. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}