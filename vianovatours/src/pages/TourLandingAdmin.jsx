import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Edit2, Trash2, Save, X, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TourLandingAdmin() {
  const [tours, setTours] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [timesInputValue, setTimesInputValue] = useState('');
  const [dayTimesInputs, setDayTimesInputs] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        if (currentUser?.role !== 'admin') {
          return;
        }

        const toursData = await base44.entities.TourLandingPage.list();
        setTours(toursData);
      } catch (error) {
        console.error("Error loading tours:", error);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const startCreate = () => {
    setIsCreating(true);
    setFormData({
      domain: '',
      tour_name: '',
      slug: '',
      hero_title: '',
      hero_subtitle: '',
      hero_image_url: '',
      description: '',
      highlights: [],
      faqs: [],
      ticket_types: [],
      available_times: [],
      timezone: 'America/New_York',
      is_active: true
    });
    setTimesInputValue('');
    setDayTimesInputs({});
  };

  const startEdit = (tour) => {
    setEditingId(tour.id);
    setFormData({
      domain: tour.domain || '',
      tour_name: tour.tour_name || '',
      slug: tour.slug || '',
      favicon_url: tour.favicon_url || '',
      hero_title: tour.hero_title || '',
      hero_subtitle: tour.hero_subtitle || '',
      hero_image_url: tour.hero_image_url || '',
      description: tour.description || '',
      highlights: tour.highlights || [],
      faqs: tour.faqs || [],
      ticket_types: tour.ticket_types || [],
      available_times: tour.available_times || [],
      day_specific_times: tour.day_specific_times || {},
      advance_booking_hours: tour.advance_booking_hours || 0,
      gallery_images: tour.gallery_images || [],
      timezone: tour.timezone || 'America/New_York',
      collect_address: tour.collect_address || false,
      is_active: tour.is_active !== false
    });
    
    // Initialize input strings
    setTimesInputValue((tour.available_times || []).join(', '));
    const dayInputs = {};
    for (let i = 0; i < 7; i++) {
      const dayTimes = (tour.day_specific_times || {})[i];
      if (Array.isArray(dayTimes)) {
        dayInputs[i] = dayTimes.length === 0 ? 'CLOSED' : dayTimes.join(', ');
      } else {
        dayInputs[i] = '';
      }
    }
    setDayTimesInputs(dayInputs);
  };

  const handleSave = async () => {
    try {
      if (!formData.domain || !formData.tour_name || !formData.slug) {
        toast({
          title: "Required Fields Missing",
          description: "Please fill in domain, tour name, and slug",
          variant: "destructive"
        });
        return;
      }

      // Process all day inputs - MUST explicitly set ALL 7 days to prevent merge issues
      const finalDaySpecificTimes = {
        0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null
      };
      
      for (let i = 0; i < 7; i++) {
        const inputValue = dayTimesInputs[i];
        
        console.log(`Day ${i} raw input:`, inputValue);
        
        // Empty or undefined = null (use defaults)
        if (!inputValue || inputValue.trim() === '') {
          console.log(`Day ${i}: Setting to null (will use defaults)`);
          finalDaySpecificTimes[i] = null;
          continue;
        }
        
        const trimmed = inputValue.trim();
        
        if (trimmed.toLowerCase() === 'closed') {
          // CLOSED means empty array
          console.log(`Day ${i}: Setting as CLOSED (empty array)`);
          finalDaySpecificTimes[i] = [];
        } else {
          // Parse times
          const dayTimes = trimmed.split(',').map(t => t.trim()).filter(Boolean);
          if (dayTimes.length > 0) {
            console.log(`Day ${i}: Setting times:`, dayTimes);
            finalDaySpecificTimes[i] = dayTimes;
          } else {
            console.log(`Day ${i}: No valid times, setting to null`);
            finalDaySpecificTimes[i] = null;
          }
        }
      }

      console.log('Final day_specific_times to save:', finalDaySpecificTimes);

      // Build clean data object
      const { day_specific_times: _, ...restFormData } = formData;
      
      const dataToSave = {
        ...restFormData,
        day_specific_times: finalDaySpecificTimes
      };

      console.log('Data to save:', dataToSave);

      if (isCreating) {
        await base44.entities.TourLandingPage.create(dataToSave);
        toast({ title: "Success", description: "Tour landing page created" });
      } else {
        console.log('=== Saving with explicit all-7-days update ===');
        console.log('Data to save:', dataToSave);
        
        // Single update with all 7 days explicitly set (no two-step needed)
        await base44.entities.TourLandingPage.update(editingId, dataToSave);
        
        const afterSave = await base44.entities.TourLandingPage.get(editingId);
        console.log('After save, day_specific_times in DB:', afterSave.day_specific_times);
        
        toast({ title: "Success", description: "Tour landing page updated" });
      }

      // Wait a moment for DB to fully persist
      await new Promise(resolve => setTimeout(resolve, 200));

      const updatedTours = await base44.entities.TourLandingPage.list();
      const updatedTour = updatedTours.find(t => t.id === editingId);
      console.log('After save, tour data from DB:', updatedTour?.day_specific_times);
      
      setTours(updatedTours);
      setIsCreating(false);
      setEditingId(null);
      setFormData({});
      setTimesInputValue('');
      setDayTimesInputs({});
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this tour landing page?")) return;

    try {
      await base44.entities.TourLandingPage.delete(id);
      const updatedTours = await base44.entities.TourLandingPage.list();
      setTours(updatedTours);
      toast({ title: "Success", description: "Tour landing page deleted" });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({});
  };

  const addHighlight = () => {
    setFormData({
      ...formData,
      highlights: [...(formData.highlights || []), '']
    });
  };

  const updateHighlight = (index, value) => {
    const updated = [...(formData.highlights || [])];
    updated[index] = value;
    setFormData({ ...formData, highlights: updated });
  };

  const removeHighlight = (index) => {
    const updated = [...(formData.highlights || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, highlights: updated });
  };

  const addTicketType = () => {
    setFormData({
      ...formData,
      ticket_types: [...(formData.ticket_types || []), {
        id: `ticket-${Date.now()}`,
        name: '',
        description: '',
        price: 0,
        currency: 'USD'
      }]
    });
  };

  const updateTicketType = (index, field, value) => {
    const updated = [...(formData.ticket_types || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, ticket_types: updated });
  };

  const removeTicketType = (index) => {
    const updated = [...(formData.ticket_types || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, ticket_types: updated });
  };

  const handleGenerateContent = async () => {
    if (!formData.tour_name) {
      toast({
        title: "Tour Name Required",
        description: "Please enter a tour name first",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateTourContent', {
        tour_name: formData.tour_name
      });

      if (response.data.success) {
        const content = response.data.content;
        setFormData({
          ...formData,
          hero_title: content.hero_title || formData.hero_title,
          hero_subtitle: content.hero_subtitle || formData.hero_subtitle,
          description: content.description || formData.description,
          timezone: content.timezone || formData.timezone,
          location_address: content.location_address || formData.location_address,
          highlights: content.highlights || formData.highlights,
          faqs: content.faqs || formData.faqs
        });
        toast({
          title: "Content Generated!",
          description: "AI has generated tour content. Review and edit as needed."
        });
      } else {
        throw new Error(response.data.error || 'Generation failed');
      }
    } catch (error) {
      console.error("Generate error:", error);
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
    setIsGenerating(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Access denied. This page is only accessible to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isCreating || editingId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{isCreating ? 'Create' : 'Edit'} Tour Landing Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Domain *</Label>
                <Input
                  value={formData.domain}
                  onChange={(e) => setFormData({...formData, domain: e.target.value})}
                  placeholder="himejicastletickets.com"
                />
              </div>
              <div>
                <Label>Tour Name *</Label>
                <Input
                  value={formData.tour_name}
                  onChange={(e) => setFormData({...formData, tour_name: e.target.value})}
                  placeholder="Himeji Castle"
                />
              </div>
            </div>

            <div>
              <Label>Slug *</Label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData({...formData, slug: e.target.value})}
                placeholder="himeji-castle"
              />
            </div>

            <div>
              <Label>Favicon</Label>
              <div className="space-y-2">
                {formData.favicon_url && (
                  <div className="flex items-center gap-3">
                    <img src={formData.favicon_url} alt="Favicon preview" className="w-8 h-8 object-contain border border-slate-200 rounded" />
                    <span className="text-sm text-slate-600">Current favicon</span>
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const response = await base44.integrations.Core.UploadFile({ file });
                        setFormData({...formData, favicon_url: response.file_url});
                        toast({ title: "Success", description: "Favicon uploaded" });
                      } catch (error) {
                        toast({ title: "Error", description: "Failed to upload favicon", variant: "destructive" });
                      }
                    }
                  }}
                />
                <p className="text-sm text-slate-500">Upload a square image (recommended: 32x32 or 64x64 pixels)</p>
              </div>
            </div>

            <Alert className="bg-emerald-50 border-emerald-200">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-slate-700">
                  Let AI research and generate content for this tour
                </span>
                <Button
                  onClick={handleGenerateContent}
                  disabled={isGenerating || !formData.tour_name}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  size="sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Content
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>

            <div>
              <Label>Hero Title</Label>
              <Input
                value={formData.hero_title}
                onChange={(e) => setFormData({...formData, hero_title: e.target.value})}
                placeholder="Experience the Beauty of Himeji Castle"
              />
            </div>

            <div>
              <Label>Hero Subtitle</Label>
              <Input
                value={formData.hero_subtitle}
                onChange={(e) => setFormData({...formData, hero_subtitle: e.target.value})}
                placeholder="Japan's Most Spectacular Castle"
              />
            </div>

            <div>
              <Label>Hero Image</Label>
              <div className="space-y-2">
                {formData.hero_image_url && (
                  <img src={formData.hero_image_url} alt="Hero preview" className="w-full h-48 object-cover rounded-lg" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const response = await base44.integrations.Core.UploadFile({ file });
                        setFormData({...formData, hero_image_url: response.file_url});
                        toast({ title: "Success", description: "Image uploaded" });
                      } catch (error) {
                        toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <Label>Description (Markdown)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={6}
                placeholder="Enter tour description..."
              />
            </div>

            <div>
              <Label>Timezone</Label>
              <Input
                value={formData.timezone}
                onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                placeholder="America/New_York"
              />
            </div>

            <div>
              <Label>Default Available Times (comma-separated)</Label>
              <Input
                value={timesInputValue}
                onChange={(e) => setTimesInputValue(e.target.value)}
                onBlur={(e) => {
                  const parsed = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  setFormData({ ...formData, available_times: parsed });
                }}
                placeholder="09:00, 10:00, 11:00, 14:00, 15:00"
              />
              <p className="text-xs text-slate-500 mt-1">These times apply to all days unless overridden below</p>
            </div>

            <div>
              <Label>Day-Specific Time Slots (Optional)</Label>
              <div className="space-y-3 mt-2">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-sm font-medium">{day}</Label>
                      {dayTimesInputs[idx] && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = {...dayTimesInputs};
                            updated[idx] = '';
                            setDayTimesInputs(updated);
                          }}
                          className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <Input
                      value={dayTimesInputs[idx] || ''}
                      onChange={(e) => {
                        setDayTimesInputs({
                          ...dayTimesInputs,
                          [idx]: e.target.value
                        });
                      }}
                      placeholder={`Leave empty to use default, or type "CLOSED" to close this day`}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Override default times for specific days. Leave empty to use default, or type "CLOSED" to mark a day as closed.</p>
            </div>

            <div>
              <Label>Minimum Advance Booking Time</Label>
              <select
                value={formData.advance_booking_hours || 0}
                onChange={(e) => setFormData({...formData, advance_booking_hours: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="0">No minimum (instant booking)</option>
                <option value="1">1 hour before tour time</option>
                <option value="2">2 hours before tour time</option>
                <option value="3">3 hours before tour time</option>
                <option value="4">4 hours before tour time</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">Based on tour timezone ({formData.timezone || 'not set'})</p>
            </div>

            <div>
              <Label>Gallery Images</Label>
              <div className="space-y-2">
                {formData.gallery_images && formData.gallery_images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {formData.gallery_images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-32 object-cover rounded-lg" />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            const updated = [...(formData.gallery_images || [])];
                            updated.splice(idx, 1);
                            setFormData({...formData, gallery_images: updated});
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      try {
                        const uploads = await Promise.all(
                          files.map(file => base44.integrations.Core.UploadFile({ file }))
                        );
                        const urls = uploads.map(r => r.file_url);
                        setFormData({
                          ...formData, 
                          gallery_images: [...(formData.gallery_images || []), ...urls]
                        });
                        toast({ title: "Success", description: `${files.length} image(s) uploaded` });
                      } catch (error) {
                        toast({ title: "Error", description: "Failed to upload images", variant: "destructive" });
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Highlights</Label>
              {(formData.highlights || []).map((highlight, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={highlight}
                    onChange={(e) => updateHighlight(index, e.target.value)}
                    placeholder="Enter highlight"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeHighlight(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addHighlight}>
                <Plus className="w-4 h-4 mr-2" /> Add Highlight
              </Button>
            </div>

            <div>
              <Label className="mb-2 block">Ticket Types</Label>
              {(formData.ticket_types || []).map((ticket, index) => (
                <Card key={index} className="mb-4 p-4">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={ticket.name}
                        onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                        placeholder="Ticket name (e.g., Adult)"
                      />
                      <Input
                        value={ticket.description}
                        onChange={(e) => updateTicketType(index, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                    <div>
                      <Input
                        value={ticket.internal_name || ''}
                        onChange={(e) => updateTicketType(index, 'internal_name', e.target.value)}
                        placeholder="Internal name for VAs (e.g., 'Adulto', 'Bilet Adult')"
                        className="text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        The actual ticket name on the ticketing site (may be in different language) - for VA reference only
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        value={ticket.price}
                        onChange={(e) => updateTicketType(index, 'price', parseFloat(e.target.value))}
                        placeholder="Price"
                      />
                      <Input
                        value={ticket.currency}
                        onChange={(e) => updateTicketType(index, 'currency', e.target.value)}
                        placeholder="Currency"
                      />
                      <Button
                        variant="destructive"
                        onClick={() => removeTicketType(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addTicketType}>
                <Plus className="w-4 h-4 mr-2" /> Add Ticket Type
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.collect_address}
                  onCheckedChange={(checked) => setFormData({...formData, collect_address: checked})}
                />
                <Label>Collect Customer Address at Checkout</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                />
                <Label>Active</Label>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tour Landing Pages</h1>
          <p className="text-slate-600 mt-1">Manage custom domain tour pages</p>
        </div>
        <Button onClick={startCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Create Tour Page
        </Button>
      </div>

      <div className="grid gap-4">
        {tours.map(tour => (
          <Card key={tour.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{tour.tour_name}</h3>
                  <p className="text-slate-600 mt-1">
                    <strong>Domain:</strong> {tour.domain}
                  </p>
                  <p className="text-slate-600">
                    <strong>Slug:</strong> {tour.slug}
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    {tour.ticket_types?.length || 0} ticket types, {tour.available_times?.length || 0} time slots
                  </p>
                  <div className="mt-2">
                    {tour.is_active ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                    ) : (
                      <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(tour)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(tour.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {tours.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-slate-600">No tour landing pages yet. Create your first one!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}