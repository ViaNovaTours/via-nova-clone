import React from "react";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import TourNavigation from "./TourNavigation";
import BookingWidget from "./BookingWidget";
import TourFAQ from "./TourFAQ";
import TourFooter from "./TourFooter";
import { Check, X } from "lucide-react";

export default function TourLandingPage({ tourConfig }) {
  // Generate structured data (Schema.org)
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "name": tourConfig.tour_name,
        "description": tourConfig.description || tourConfig.hero_subtitle || `Book tickets for ${tourConfig.tour_name}`,
        "image": tourConfig.hero_image_url,
        "address": tourConfig.location_address ? {
          "@type": "PostalAddress",
          "streetAddress": tourConfig.location_address
        } : undefined
      },
      {
        "@type": "Product",
        "name": `${tourConfig.tour_name} Tickets`,
        "description": tourConfig.hero_subtitle || `Skip-the-line tickets for ${tourConfig.tour_name}`,
        "image": tourConfig.hero_image_url,
        "offers": tourConfig.ticket_types?.map(ticket => ({
          "@type": "Offer",
          "name": ticket.name,
          "price": ticket.price,
          "priceCurrency": ticket.currency || "USD",
          "availability": "https://schema.org/InStock",
          "url": window.location.href
        }))
      },
      tourConfig.faqs && tourConfig.faqs.length > 0 ? {
        "@type": "FAQPage",
        "mainEntity": tourConfig.faqs.map(faq => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
          }
        }))
      } : undefined
    ].filter(Boolean)
  };

  const pageTitle = `${tourConfig.tour_name} Tickets – Skip the Line & Easy Booking`;
  
  // Get lowest price for meta description
  const lowestPrice = tourConfig.ticket_types && tourConfig.ticket_types.length > 0 
    ? tourConfig.ticket_types.reduce((min, ticket) => ticket.price < min.price ? ticket : min)
    : null;
  const priceString = lowestPrice 
    ? `${lowestPrice.currency === 'EUR' ? '€' : lowestPrice.currency === 'USD' ? '$' : lowestPrice.currency}${lowestPrice.price.toFixed(2)}`
    : '$0.00';
  
  const pageDescription = tourConfig.hero_subtitle || `Book ${tourConfig.tour_name} tickets online. Skip-the-line access, instant confirmation, mobile tickets. From ${priceString}. Reserve your spot today.`;

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="keywords" content={`${tourConfig.tour_name}, tickets, skip the line, book online, tours, attractions`} />
        {tourConfig.favicon_url && (
          <>
            <link rel="icon" href={tourConfig.favicon_url} />
            <link rel="shortcut icon" href={tourConfig.favicon_url} />
            <link rel="icon" type="image/png" sizes="32x32" href={tourConfig.favicon_url} />
            <link rel="icon" type="image/png" sizes="16x16" href={tourConfig.favicon_url} />
            <link rel="apple-touch-icon" href={tourConfig.favicon_url} />
          </>
        )}
        
        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={tourConfig.hero_image_url} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={tourConfig.hero_image_url} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      {/* Navigation */}
      <TourNavigation tourName={tourConfig.tour_name} />

      {/* Hero Section with Overlaid Calendar */}
      <div 
        id="book-now"
        className="relative bg-cover bg-center"
        style={{ backgroundImage: tourConfig.hero_image_url ? `url(${tourConfig.hero_image_url})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-8 items-start lg:min-h-[600px]">
            {/* Left: Hero Text */}
            <div className="text-white lg:py-12">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                {tourConfig.hero_title || tourConfig.tour_name}
              </h1>
              {tourConfig.hero_subtitle && (
                <p className="text-lg md:text-xl lg:text-2xl font-light mb-6">{tourConfig.hero_subtitle}</p>
              )}
              <div className="space-y-2 text-base md:text-lg">
                <p>Skip-the-line access · Fast entry · Easy mobile tickets</p>
                {tourConfig.ticket_types && tourConfig.ticket_types.length > 0 && (() => {
                  const lowestPriceTicket = tourConfig.ticket_types.reduce((min, ticket) => 
                    ticket.price < min.price ? ticket : min
                  );
                  const currencySymbol = lowestPriceTicket.currency === 'EUR' ? '€' : 
                                       lowestPriceTicket.currency === 'USD' ? '$' : 
                                       lowestPriceTicket.currency;
                  return (
                    <p>From {currencySymbol}{lowestPriceTicket.price.toFixed(2)} | Family-friendly | Book for the whole group</p>
                  );
                })()}
                <p className="font-semibold">Reserve Your Spot Today — Tours Sell Out Daily</p>
              </div>
            </div>

            {/* Right: Booking Calendar (Desktop Only) */}
            <div className="hidden lg:block lg:py-8">
              <BookingWidget tourConfig={tourConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Booking Widget */}
      <div className="lg:hidden max-w-7xl mx-auto px-4 py-6 bg-white relative z-10">
        <BookingWidget tourConfig={tourConfig} />
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="space-y-8 md:space-y-12">

            {/* Gallery Images */}
            {tourConfig.gallery_images && tourConfig.gallery_images.length > 0 && (
              <section className="scroll-mt-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tourConfig.gallery_images.slice(0, 4).map((image, index) => (
                    <div key={index} className="rounded-lg overflow-hidden shadow-md">
                      <img 
                        src={image} 
                        alt={`${tourConfig.tour_name} view ${index + 1} - historic landmark and tourist attraction`}
                        className="w-full h-48 md:h-64 object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Inclusions Section */}
            <section id="inclusions" className="scroll-mt-20">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">What's Included</h2>
              <div className="space-y-3">
                {tourConfig.highlights && tourConfig.highlights.length > 0 ? (
                  tourConfig.highlights.map((highlight, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-base md:text-lg">{highlight}</p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-base md:text-lg">Entry to {tourConfig.tour_name}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-base md:text-lg">Skip-the-line access</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-slate-700 text-base md:text-lg">Mobile ticket</p>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Exclusions Section */}
            <section id="exclusions" className="scroll-mt-20">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">What's Not Included</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-base md:text-lg">Food and drinks</p>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-base md:text-lg">Transportation to/from the venue</p>
                </div>
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-slate-700 text-base md:text-lg">Gratuities</p>
                </div>
              </div>
            </section>

            {/* Cancellation Policy */}
            <section id="cancellation" className="scroll-mt-20">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Cancellation Policy</h2>
              <p className="text-slate-700 text-base md:text-lg">
                These tickets can't be cancelled or rescheduled.
              </p>
            </section>

            {/* Know Before You Go */}
            <section id="know" className="scroll-mt-20">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">Know Before You Go</h2>
              {tourConfig.description ? (
                <div className="text-slate-700 text-base md:text-lg space-y-4">
                  {tourConfig.description.split('\n\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 text-slate-700 text-base md:text-lg">
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
                    className="w-full h-64 md:h-96 object-cover rounded-lg shadow-md"
                  />
                </div>
              )}
            </section>

            {/* Location Section */}
            {(tourConfig.location_address || tourConfig.location_google_maps_url) && (
              <section id="location" className="scroll-mt-20">
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">How to Arrive</h2>
                {tourConfig.location_address && (
                  <p className="text-slate-700 text-base md:text-lg mb-6">{tourConfig.location_address}</p>
                )}
                {tourConfig.location_google_maps_url && (
                  <div className="w-full h-64 md:h-96 rounded-lg overflow-hidden shadow-md">
                    <iframe
                      src={tourConfig.location_google_maps_url}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                )}
              </section>
            )}
        </div>
      </div>

      {/* FAQ */}
      {tourConfig.faqs && tourConfig.faqs.length > 0 && (
        <div className="py-12 md:py-16 px-4 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <TourFAQ faqs={tourConfig.faqs} />
          </div>
        </div>
      )}

      {/* Footer */}
      <TourFooter tourConfig={tourConfig} />
    </div>
  );
}