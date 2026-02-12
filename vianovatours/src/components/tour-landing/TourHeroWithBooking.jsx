import React, { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar as CalendarIcon, Clock, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function TourHeroWithBooking({ tourConfig, bookingRef }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [tickets, setTickets] = useState({});
  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const { toast } = useToast();

  const calculateTotal = () => {
    let total = 0;
    Object.entries(tickets).forEach(([ticketId, quantity]) => {
      const ticketType = tourConfig.ticket_types?.find(t => t.id === ticketId);
      if (ticketType) {
        total += ticketType.price * quantity;
      }
    });
    return total;
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Selection Required",
        description: "Please select both a date and time",
        variant: "destructive"
      });
      return;
    }

    const totalTickets = Object.values(tickets).reduce((sum, qty) => sum + qty, 0);
    if (totalTickets === 0) {
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket",
        variant: "destructive"
      });
      return;
    }

    setShowCheckout(true);
  };

  const handleBooking = async () => {
    if (!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email) {
      toast({
        title: "Information Required",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const bookingData = {
        tour_landing_page_id: tourConfig.id,
        tour_name: tourConfig.tour_name,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        tickets: Object.entries(tickets).map(([ticketId, quantity]) => {
          const ticketType = tourConfig.ticket_types.find(t => t.id === ticketId);
          return {
            ticket_type_id: ticketId,
            type: ticketType.name,
            quantity,
            price: ticketType.price
          };
        }),
        customer: customerInfo,
        total: calculateTotal(),
        currency: tourConfig.ticket_types[0]?.currency || 'USD'
      };

      const response = await base44.functions.invoke('processLandingPageBooking', bookingData);
      
      if (response.data.success) {
        toast({
          title: "Booking Confirmed!",
          description: "Check your email for confirmation details"
        });
        // Reset form
        setSelectedDate(null);
        setSelectedTime("");
        setTickets({});
        setCustomerInfo({ firstName: "", lastName: "", email: "", phone: "" });
        setShowCheckout(false);
      } else {
        throw new Error(response.data.error || 'Booking failed');
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Booking Failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      ref={bookingRef}
      className="relative min-h-[600px] bg-cover bg-center"
      style={{ backgroundImage: tourConfig.hero_image_url ? `url(${tourConfig.hero_image_url})` : 'none' }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 py-12 min-h-[600px] flex items-center">
        <div className="grid md:grid-cols-2 gap-8 w-full items-start">
          {/* Left: Hero Text */}
          <div className="text-white pt-12">
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              {tourConfig.tour_name}
            </h1>
            {tourConfig.hero_subtitle && (
              <p className="text-2xl mb-6 font-light">{tourConfig.hero_subtitle}</p>
            )}
            
            <div className="space-y-3 text-lg">
              <p className="font-semibold">Book Now Before Spots Sell Out</p>
              <p>Skip-the-line access · Fast entry · Easy mobile tickets</p>
              {tourConfig.ticket_types && tourConfig.ticket_types.length > 0 && (() => {
                const lowestPriceTicket = tourConfig.ticket_types.reduce((min, ticket) => 
                  ticket.price < min.price ? ticket : min
                );
                const currencySymbol = lowestPriceTicket.currency === 'EUR' ? '€' : 
                                     lowestPriceTicket.currency === 'USD' ? '$' : 
                                     lowestPriceTicket.currency;
                return (
                  <p>
                    From <span className="font-bold">{currencySymbol}{lowestPriceTicket.price.toFixed(2)}</span> | 
                    Family-friendly | Book for the whole group
                  </p>
                );
              })()}
              <p className="text-sm">Reserve Your Spot Today — Tours Sell Out Daily</p>
            </div>
          </div>

          {/* Right: Booking Card */}
          <Card className="bg-white p-6 shadow-2xl">
            {!showCheckout ? (
              <>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Select Date & Time</h3>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>

                {selectedDate && (() => {
                  // Get day of week (0 = Sunday, 6 = Saturday)
                  const dayOfWeek = selectedDate.getDay();
                  
                  // Check if there are day-specific times for this day
                  const daySpecificTimes = tourConfig.day_specific_times?.[dayOfWeek];
                  
                  // Use day-specific times if they exist and are a valid non-empty array, otherwise use default
                  const availableTimes = (Array.isArray(daySpecificTimes) && daySpecificTimes.length > 0) 
                    ? daySpecificTimes 
                    : (tourConfig.available_times || []);
                  
                  // Only show time selector if there are available times
                  if (!availableTimes || availableTimes.length === 0) {
                    return (
                      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-orange-800 text-sm">
                          No time slots available for this date. Please select another date.
                        </p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="mb-6">
                      <Label className="text-slate-900 font-semibold mb-2 block">Select Time</Label>
                      <Select value={selectedTime} onValueChange={setSelectedTime}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a time" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTimes.map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {selectedDate && selectedTime && tourConfig.ticket_types && (
                  <div className="mb-6">
                    <Label className="text-slate-900 font-semibold mb-3 block">Select Tickets</Label>
                    <div className="space-y-3">
                      {tourConfig.ticket_types.map(ticketType => {
                       const currencySymbol = ticketType.currency === 'EUR' ? '€' : 
                                            ticketType.currency === 'USD' ? '$' : 
                                            ticketType.currency;
                       return (
                       <div key={ticketType.id} className="flex items-center justify-between p-3 border rounded">
                         <div>
                           <p className="font-semibold text-slate-900">{ticketType.name}</p>
                           <p className="text-sm text-slate-600">{currencySymbol}{ticketType.price.toFixed(2)}</p>
                         </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTickets(prev => ({
                                ...prev,
                                [ticketType.id]: Math.max(0, (prev[ticketType.id] || 0) - 1)
                              }))}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center font-semibold">
                              {tickets[ticketType.id] || 0}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setTickets(prev => ({
                                ...prev,
                                [ticketType.id]: (prev[ticketType.id] || 0) + 1
                              }))}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                )}

                {selectedDate && selectedTime && Object.values(tickets).some(qty => qty > 0) && (() => {
                  const firstTicketCurrency = tourConfig.ticket_types[0]?.currency;
                  const currencySymbol = firstTicketCurrency === 'EUR' ? '€' : 
                                       firstTicketCurrency === 'USD' ? '$' : 
                                       firstTicketCurrency;
                  return (
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-xl font-bold mb-4">
                      <span>Total:</span>
                      <span className="text-emerald-600">
                        {currencySymbol}{calculateTotal().toFixed(2)}
                      </span>
                    </div>
                    <Button 
                      onClick={handleContinue}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      size="lg"
                    >
                      Continue <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                  );
                })()}
              </>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4 text-slate-900">Your Information</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={customerInfo.firstName}
                      onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={customerInfo.lastName}
                      onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  />
                </div>

                <div className="border-t pt-4 space-y-2 text-sm text-slate-600">
                  <p><strong>Date:</strong> {format(selectedDate, 'MMMM dd, yyyy')} at {selectedTime}</p>
                  <p><strong>Total:</strong> {(() => {
                    const currency = tourConfig.ticket_types[0]?.currency;
                    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
                    return symbol;
                  })()}{calculateTotal().toFixed(2)}</p>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline"
                    onClick={() => setShowCheckout(false)}
                    className="flex-1"
                    disabled={isProcessing}
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleBooking}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Complete Booking'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}