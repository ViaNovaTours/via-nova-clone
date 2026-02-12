import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, User, Calendar, MapPin, Ticket, DollarSign, Phone, Home, Tags, PlusCircle, X } from "lucide-react";
import { Tour } from "@/entities/Tour";
import { TicketType } from "@/entities/TicketType";

export default function OrderForm({ onSubmit, isSubmitting, initialData = {}, onCancel, mode = "create" }) {
  const [tours, setTours] = useState([]);
  const [availableTicketTypes, setAvailableTicketTypes] = useState([]);
  const [selectedTour, setSelectedTour] = useState(null);

  const formatIncomingDate = (dateString) => {
    if (!dateString) return "";
    try {
      return dateString.split('T')[0];
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState(() => {
    const baseData = {
      order_id: "",
      tour: "",
      tour_date: "",
      tour_time: "",
      tickets: [],
      extras: [],
      first_name: "",
      last_name: "",
      email: "",
      country_code: "",
      phone_number_country: "",
      phone: "",
      address: "",
      city: "",
      state_region: "",
      zip: "",
      country: "",
      venue: "",
      budget_max: "",
      special_instructions: "",
      priority: "normal",
      purchase_url: "",
      purchase_date: new Date().toISOString(),
      ...initialData
    };
    
    // Format dates after spreading initialData
    return {
      ...baseData,
      tour_date: formatIncomingDate(baseData.tour_date),
      purchase_date: formatIncomingDate(baseData.purchase_date)
    };
  });

  const loadTicketTypesForTour = useCallback(async (tourId) => {
    const ticketTypes = await TicketType.filter({ tour_id: tourId });
    setAvailableTicketTypes(ticketTypes);
    return ticketTypes;
  }, []);

  useEffect(() => {
    const fetchToursAndSetInitial = async () => {
      const tourData = await Tour.list();
      setTours(tourData);

      if (formData.tour && tourData.length > 0) {
        const initialTour = tourData.find(t => t.name === formData.tour);
        if (initialTour) {
          setSelectedTour(initialTour);
          const fetchedTicketTypes = await loadTicketTypesForTour(initialTour.id);
          
          // Initialize form tickets based on available types, preserving initial quantities
          const initialTicketsMap = new Map((initialData.tickets || []).map(t => [t.ticket_type_id || t.type, t.quantity]));
          
          const newTickets = fetchedTicketTypes.map(tt => ({
            ticket_type_id: tt.id,
            type: tt.name,
            quantity: initialTicketsMap.get(tt.id) || initialTicketsMap.get(tt.name) || 0, // Fallback for old data
            cost_per_ticket: tt.price
          }));
          
          setFormData(prev => ({ ...prev, tickets: newTickets }));
        }
      }
    };
    fetchToursAndSetInitial();
  }, [formData.tour, loadTicketTypesForTour, initialData.tickets]);

  const handleTourChange = async (tourName) => {
    const tour = tours.find(t => t.name === tourName);
    setSelectedTour(tour);
    
    const fetchedTicketTypes = await loadTicketTypesForTour(tour.id);
    
    setFormData(prev => ({
      ...prev,
      tour: tour.name,
      purchase_url: tour.site_url,
      tickets: fetchedTicketTypes.map(tt => ({ 
        ticket_type_id: tt.id,
        type: tt.name,
        quantity: 0,
        cost_per_ticket: tt.price
      })),
      extras: (tour.extras || []).map(name => ({ name, quantity: 0 }))
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleTicketChange = (ticket_type_id, quantity) => {
    setFormData(prev => ({
      ...prev,
      tickets: prev.tickets.map(t => t.ticket_type_id === ticket_type_id ? { ...t, quantity } : t)
    }));
  };

  const handleExtraChange = (name, quantity) => {
    setFormData(prev => ({
      ...prev,
      extras: prev.extras.map(e => e.name === name ? { ...e, quantity } : e)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submissionData = {
      ...formData,
      tickets: formData.tickets.filter(t => t.quantity > 0),
      extras: formData.extras.filter(e => e.quantity > 0)
    };
    onSubmit(submissionData);
  };

  const getTotalTickets = () => {
    return formData.tickets.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ... Tour Details Card ... */}
      <Card className="border-slate-200">
        {/* ... CardHeader ... */}
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Tour Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tour" className="text-slate-700">Select Tour *</Label>
              <Select 
                onValueChange={handleTourChange} 
                value={formData.tour}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tour..." />
                </SelectTrigger>
                <SelectContent>
                  {tours.map(tour => (
                    <SelectItem key={tour.id} value={tour.name}>{tour.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="order_id" className="text-slate-700">Order ID</Label>
              <Input
                id="order_id"
                value={formData.order_id}
                onChange={(e) => handleChange('order_id', e.target.value)}
                placeholder="Auto-generated if empty"
                disabled={mode === "edit"}
              />
            </div>
          </div>
          {/* ... rest of tour details inputs ... */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tour_date" className="text-slate-700">Tour Date</Label>
              <Input
                id="tour_date"
                type="date"
                value={formData.tour_date}
                onChange={(e) => handleChange('tour_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tour_time" className="text-slate-700">Tour Time</Label>
              <Input
                id="tour_time"
                type="time"
                value={formData.tour_time}
                onChange={(e) => handleChange('tour_time', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue" className="text-slate-700">Venue</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => handleChange('venue', e.target.value)}
                placeholder="Venue name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedTour && (
        <>
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5" />
                Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {formData.tickets.map(ticket => (
                  <div key={ticket.ticket_type_id} className="space-y-2">
                    <Label htmlFor={`ticket_${ticket.ticket_type_id}`} className="text-slate-700">{ticket.type}</Label>
                    <Input
                      id={`ticket_${ticket.ticket_type_id}`}
                      type="number"
                      min="0"
                      value={ticket.quantity}
                      onChange={(e) => handleTicketChange(ticket.ticket_type_id, parseInt(e.target.value, 10) || 0)}
                    />
                  </div>
                ))}
              </div>
               <div className="bg-slate-50 p-4 rounded-lg mt-6">
                <p className="text-sm font-medium text-slate-700">
                  Total Tickets: <span className="text-emerald-600 font-bold">{getTotalTickets()}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {selectedTour.extras && selectedTour.extras.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5" />
                  Extras & Add-ons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {formData.extras.map(extra => (
                    <div key={extra.name} className="space-y-2">
                      <Label htmlFor={`extra_${extra.name.replace(/\s/g, '_').toLowerCase()}`} className="text-slate-700">{extra.name}</Label>
                      <Input
                        id={`extra_${extra.name.replace(/\s/g, '_').toLowerCase()}`}
                        type="number"
                        min="0"
                        value={extra.quantity}
                        onChange={(e) => handleExtraChange(extra.name, parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ... Customer and Address Info Cards ... */}
      <Card className="border-slate-200">
        {/* ... Customer Info Header ... */}
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ... Customer Info Fields ... */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="text-slate-700">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="First name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name" className="text-slate-700">Last Name *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="Last name"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-700">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="customer@email.com"
              required
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="country_code" className="text-slate-700">Country Code</Label>
              <Input
                id="country_code"
                value={formData.country_code}
                onChange={(e) => handleChange('country_code', e.target.value)}
                placeholder="+1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_number_country" className="text-slate-700">Phone Country</Label>
              <Input
                id="phone_number_country"
                value={formData.phone_number_country}
                onChange={(e) => handleChange('phone_number_country', e.target.value)}
                placeholder="US"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-700">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* ... Address Info Card ... */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <Home className="w-5 h-5" />
            Address Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-slate-700">Street Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="123 Main Street"
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-slate-700">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="New York"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state_region" className="text-slate-700">State/Region</Label>
              <Input
                id="state_region"
                value={formData.state_region}
                onChange={(e) => handleChange('state_region', e.target.value)}
                placeholder="NY"
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="zip" className="text-slate-700">Zip Code</Label>
              <Input
                id="zip"
                value={formData.zip}
                onChange={(e) => handleChange('zip', e.target.value)}
                placeholder="10001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country" className="text-slate-700">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* ... Processing Details Card ... */}
      <Card className="border-slate-200">
        {/* ... Processing Details Header ... */}
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Processing Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ... Processing Details Fields ... */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-slate-700">Priority</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => handleChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_max" className="text-slate-700">Max Budget/Ticket</Label>
              <Input
                id="budget_max"
                type="number"
                step="0.01"
                value={formData.budget_max}
                onChange={(e) => handleChange('budget_max', parseFloat(e.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="purchase_url" className="text-slate-700">Ticketing Website</Label>
            <Input
              id="purchase_url"
              type="url"
              value={formData.purchase_url}
              onChange={(e) => handleChange('purchase_url', e.target.value)}
              placeholder="https://ticketmaster.com/..."
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="special_instructions" className="text-slate-700">Special Instructions</Label>
            <Textarea
              id="special_instructions"
              value={formData.special_instructions}
              onChange={(e) => handleChange('special_instructions', e.target.value)}
              placeholder="Any specific requirements or notes for the VA..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-6 gap-3">
        {onCancel && (
          <Button 
            type="button" 
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        )}
        <Button 
          type="submit" 
          disabled={isSubmitting || !selectedTour}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {mode === 'create' ? 'Create Order' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}