import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Calendar as CalendarIcon, Clock, Users, ShoppingCart, CheckCircle } from "lucide-react";
import { format, addHours, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import StripeCheckout from "./StripeCheckout";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function BookingWidget({ tourConfig }) {
  const [stripePromise, setStripePromise] = useState(null);
  const { toast } = useToast();
  const [step, setStep] = useState(1); // 1: Date/Time, 2: Tickets, 3: Checkout, 4: Confirmation
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [tickets, setTickets] = useState({});
  const [customerInfo, setCustomerInfo] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: ""
  });
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [emailError, setEmailError] = useState("");

  // Load Stripe publishable key
  useState(() => {
    const loadStripeKey = async () => {
      try {
        const response = await base44.functions.invoke('getStripePublishableKey');
        if (response.data.publishable_key) {
          setStripePromise(loadStripe(response.data.publishable_key));
        }
      } catch (error) {
        console.error('Failed to load Stripe key:', error);
      }
    };
    loadStripeKey();
  }, []);

  const handleDateTimeNext = () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Selection Required",
        description: "Please select both a date and time",
        variant: "destructive"
      });
      return;
    }
    setStep(2);
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleTicketsNext = () => {
    const totalTickets = Object.values(tickets).reduce((sum, qty) => sum + qty, 0);
    if (totalTickets === 0) {
      toast({
        title: "No Tickets Selected",
        description: "Please select at least one ticket",
        variant: "destructive"
      });
      return;
    }
    setStep(3);
  };

  const calculateTotal = () => {
    let total = 0;
    Object.entries(tickets).forEach(([ticketId, quantity]) => {
      const ticketType = tourConfig.ticket_types.find(t => t.id === ticketId);
      if (ticketType) {
        total += ticketType.price * quantity;
      }
    });
    return total;
  };

  const handlePaymentSuccess = async (paymentMethodObj) => {
    setPaymentMethod(paymentMethodObj);
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
        currency: tourConfig.ticket_types[0]?.currency || 'USD',
        payment_method_id: paymentMethodObj.id,
        payment_processor: tourConfig.payment_processor || 'stripe'
      };

      const response = await base44.functions.invoke('processLandingPageBooking', bookingData);
      
      if (response.data && response.data.success) {
        setOrderId(response.data.order_id);
        setStep(4);
        toast({
          title: "Booking Confirmed!",
          description: "Check your email for confirmation details"
        });
      } else {
        throw new Error(response.data?.error || 'Booking failed. Please try again.');
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Booking Failed",
        description: error.response?.data?.error || error.message || "Payment processing failed. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const handlePaymentError = (errorMessage) => {
    toast({
      title: "Payment Error",
      description: errorMessage,
      variant: "destructive"
    });
  };

  // Get available times for a specific date
  const getAvailableTimesForDate = (date) => {
    if (!date) return [];
    
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    console.log('Getting times for day:', dayOfWeek);
    console.log('tourConfig.day_specific_times:', tourConfig.day_specific_times);
    console.log('tourConfig.available_times:', tourConfig.available_times);
    
    // Check if there are day-specific times for this day
    const daySpecificTimes = tourConfig.day_specific_times?.[dayOfWeek];
    console.log('daySpecificTimes for day', dayOfWeek, ':', daySpecificTimes);
    
    // Only use day-specific times if it's explicitly set to a non-empty array
    if (Array.isArray(daySpecificTimes)) {
      console.log('Using day-specific times:', daySpecificTimes);
      if (daySpecificTimes.length === 0) {
        return [];
      }
      return daySpecificTimes;
    }
    
    // Fall back to default times
    console.log('Using default times:', tourConfig.available_times);
    return tourConfig.available_times || [];
  };

  // Check if a time slot is available based on advance booking hours
  const isTimeSlotAvailable = (date, time) => {
    if (!tourConfig.advance_booking_hours || tourConfig.advance_booking_hours === 0) {
      return true; // No minimum advance booking required
    }

    try {
      const tourTimezone = tourConfig.timezone || 'UTC';
      
      // Create a date string representing the tour time in the tour's timezone
      const dateStr = format(date, 'yyyy-MM-dd');
      const tourDateTimeString = `${dateStr}T${time}:00`;
      
      // Parse this as an ISO date (this will be interpreted in UTC initially)
      const parsedDate = parseISO(tourDateTimeString);
      
      // Now treat this parsed date as if it were in the tour's timezone and convert to UTC
      const tourStartTimeUtc = fromZonedTime(parsedDate, tourTimezone);
      
      // Calculate the cutoff time in UTC by subtracting the advance booking hours
      const cutoffTimeUtc = addHours(tourStartTimeUtc, -tourConfig.advance_booking_hours);
      
      // Get the current UTC time
      const nowUtc = new Date();
      
      // The slot is available if we're still before the cutoff
      return nowUtc < cutoffTimeUtc;
    } catch (error) {
      console.error('Error checking time slot availability:', error);
      return true; // Default to available on error
    }
  };

  // Step 1: Date and Time Selection
  if (step === 1) {
    const availableTimes = selectedDate ? getAvailableTimesForDate(selectedDate) : [];
    
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setSelectedTime(""); // Reset time when date changes
                }}
                disabled={(date) => date < new Date()}
                className="rounded-md border w-full flex justify-center"
              />
            </div>

            {selectedDate && availableTimes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xl font-semibold text-slate-900">Select Time</h3>
                </div>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTimes.map(time => {
                      const available = isTimeSlotAvailable(selectedDate, time);
                      return (
                        <SelectItem 
                          key={time} 
                          value={time}
                          disabled={!available}
                        >
                          {time} {!available ? '(Not available)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {tourConfig.advance_booking_hours > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Tickets must be purchased at least {tourConfig.advance_booking_hours} hour{tourConfig.advance_booking_hours !== 1 ? 's' : ''} before the tour time
                  </p>
                )}
              </div>
            )}
            
            {selectedDate && availableTimes.length === 0 && (
              <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm">
                  No time slots available for this date. Please select another date.
                </p>
              </div>
            )}

            <div className="flex justify-center">
              <Button 
                onClick={handleDateTimeNext}
                className="w-full max-w-md bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                Continue to Ticket Selection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Ticket Selection
  if (step === 2) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xl font-semibold text-slate-900">Select Tickets</h3>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-slate-600">
                <strong>Date:</strong> {format(selectedDate, 'MMMM dd, yyyy')}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Time:</strong> {selectedTime}
              </p>
            </div>

            <div className="space-y-4">
              {tourConfig.ticket_types.map(ticketType => {
                const currencySymbol = ticketType.currency === 'EUR' ? '€' : 
                                     ticketType.currency === 'USD' ? '$' : 
                                     ticketType.currency;
                return (
                <div key={ticketType.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-semibold text-slate-900">{ticketType.name}</h4>
                    <p className="text-sm text-slate-600">{ticketType.description}</p>
                    <p className="text-lg font-bold text-emerald-600 mt-2">
                      {currencySymbol}{ticketType.price.toFixed(2)}
                    </p>
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
                    <span className="w-12 text-center font-semibold">
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

            <div className="border-t pt-4">
              <div className="flex justify-between text-xl font-bold text-slate-900">
                <span>Total:</span>
                <span className="text-emerald-600">
                  {(() => {
                    const currency = tourConfig.ticket_types[0]?.currency;
                    return currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
                  })()}{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                onClick={handleTicketsNext}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                size="lg"
              >
                Continue to Checkout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Checkout
  if (step === 3) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h3 className="text-xl font-semibold text-slate-900">Customer Information</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={customerInfo.firstName}
                  onChange={(e) => setCustomerInfo({...customerInfo, firstName: e.target.value})}
                  placeholder="John"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={customerInfo.lastName}
                  onChange={(e) => setCustomerInfo({...customerInfo, lastName: e.target.value})}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={customerInfo.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setCustomerInfo({...customerInfo, email});
                  if (email && !validateEmail(email)) {
                    setEmailError("Please enter a valid email address");
                  } else {
                    setEmailError("");
                  }
                }}
                placeholder="john@example.com"
                className={emailError ? "border-red-500" : ""}
              />
              {emailError && (
                <p className="text-red-500 text-sm mt-1">{emailError}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            {tourConfig.collect_address && (
              <>
                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={customerInfo.address}
                    onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={customerInfo.city}
                      onChange={(e) => setCustomerInfo({...customerInfo, city: e.target.value})}
                      placeholder="San Francisco"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State/Region *</Label>
                    <Input
                      id="state"
                      value={customerInfo.state}
                      onChange={(e) => setCustomerInfo({...customerInfo, state: e.target.value})}
                      placeholder="CA"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zip">Zip/Postal Code *</Label>
                    <Input
                      id="zip"
                      value={customerInfo.zip}
                      onChange={(e) => setCustomerInfo({...customerInfo, zip: e.target.value})}
                      placeholder="94102"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={customerInfo.country}
                      onChange={(e) => setCustomerInfo({...customerInfo, country: e.target.value})}
                      placeholder="United States"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="border-t pt-4">
              <h4 className="font-semibold text-slate-900 mb-2">Order Summary</h4>
              <p className="text-sm text-slate-600">
                <strong>Date:</strong> {format(selectedDate, 'MMMM dd, yyyy')} at {selectedTime}
              </p>
              {Object.entries(tickets).filter(([_, qty]) => qty > 0).map(([ticketId, quantity]) => {
                const ticketType = tourConfig.ticket_types.find(t => t.id === ticketId);
                const currencySymbol = ticketType.currency === 'EUR' ? '€' : 
                                     ticketType.currency === 'USD' ? '$' : 
                                     ticketType.currency;
                return (
                  <p key={ticketId} className="text-sm text-slate-600">
                    {quantity}x {ticketType.name} - {currencySymbol}{(ticketType.price * quantity).toFixed(2)}
                  </p>
                );
              })}
              <div className="flex justify-between text-xl font-bold text-slate-900 mt-4">
                <span>Total:</span>
                <span className="text-emerald-600">
                  {(() => {
                    const currency = tourConfig.ticket_types[0]?.currency;
                    return currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
                  })()}{calculateTotal().toFixed(2)}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-slate-900 mb-4">Payment Information</h4>
              {(tourConfig.payment_processor === 'airwallex') ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  Airwallex payment integration coming soon. Please contact us to complete your booking.
                </div>
              ) : !stripePromise ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                </div>
              ) : (
                <Elements stripe={stripePromise}>
                  <StripeCheckout
                    amount={calculateTotal()}
                    currency={tourConfig.ticket_types[0]?.currency || 'USD'}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    disabled={!agreeToTerms || !customerInfo.email || !validateEmail(customerInfo.email) || !customerInfo.firstName || !customerInfo.lastName}
                    isParentProcessing={isProcessing}
                  />
                </Elements>
              )}
            </div>

            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <Checkbox
                id="terms"
                checked={agreeToTerms}
                onCheckedChange={setAgreeToTerms}
                className="mt-1"
              />
              <Label htmlFor="terms" className="text-sm text-slate-700 cursor-pointer">
                I agree to the{" "}
                <Link to={createPageUrl("TermsAndConditions")} className="text-emerald-600 hover:underline" target="_blank">
                  Terms & Conditions
                </Link>{" "}
                and{" "}
                <Link to={createPageUrl("PrivacyPolicy")} className="text-emerald-600 hover:underline" target="_blank">
                  Privacy Policy
                </Link>
              </Label>
            </div>

            <Button 
              variant="outline"
              onClick={() => setStep(2)}
              className="w-full"
              disabled={isProcessing}
            >
              Back to Ticket Selection
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Confirmation
  if (step === 4) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Booking Confirmed!</h3>
            <p className="text-slate-600">
              Thank you for your booking. A confirmation email has been sent to{" "}
              <strong>{customerInfo.email}</strong>
            </p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Order ID:</strong> {orderId}
              </p>
              <p className="text-sm text-slate-600">
                <strong>Date:</strong> {format(selectedDate, 'MMMM dd, yyyy')} at {selectedTime}
              </p>
            </div>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Book Another Visit
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}