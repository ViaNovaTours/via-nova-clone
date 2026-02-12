import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { WooCommerceCredentials } from "@/entities/WooCommerceCredentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Download
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { migrateWooCommerceCredentials } from "@/functions/migrateWooCommerceCredentials";

export default function TourSetupPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [tours, setTours] = useState([]);
  const [editingTour, setEditingTour] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  
  const [newTour, setNewTour] = useState({
    site_name: "",
    tour_name: "",
    website_url: "",
    consumer_key: "",
    consumer_secret: "",
    profit_margin: 0.25,
    is_active: true
  });
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      const credentials = await WooCommerceCredentials.list();
      setTours(credentials);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const { data } = await migrateWooCommerceCredentials();
      
      if (data.success) {
        toast({
          title: "Migration Complete! 🎉",
          description: data.message,
          duration: 5000,
        });
        await loadData();
      } else {
        throw new Error(data.error || 'Migration failed');
      }
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setIsMigrating(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard! ✅",
      duration: 2000,
    });
  };

  const generateSiteName = (tourName) => {
    return tourName
      .replace(/\s+Tour$/i, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/^./, str => str.toUpperCase());
  };

  const addNewTour = async () => {
    if (!newTour.tour_name || !newTour.website_url || !newTour.consumer_key || !newTour.consumer_secret) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const siteName = newTour.site_name || generateSiteName(newTour.tour_name);
      const apiUrl = newTour.website_url.replace(/\/$/, '') + '/wp-json/wc/v3';

      const tourData = {
        ...newTour,
        site_name: siteName,
        api_url: apiUrl
      };

      await WooCommerceCredentials.create(tourData);
      
      setNewTour({
        site_name: "",
        tour_name: "",
        website_url: "",
        consumer_key: "",
        consumer_secret: "",
        profit_margin: 0.25,
        is_active: true
      });
      
      await loadData();
      
      toast({
        title: "Tour Added! 🎉",
        description: "Your tour is now integrated. Click 'Sync WooCommerce' on the Dashboard to import orders.",
        duration: 5000
      });
    } catch (error) {
      toast({
        title: "Error Adding Tour",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const updateTour = async (tour) => {
    try {
      await WooCommerceCredentials.update(tour.id, {
        tour_name: tour.tour_name,
        website_url: tour.website_url,
        consumer_key: tour.consumer_key,
        consumer_secret: tour.consumer_secret,
        profit_margin: tour.profit_margin,
        is_active: tour.is_active
      });
      
      setEditingTour(null);
      await loadData();
      
      toast({
        title: "Tour Updated! ✅",
        duration: 2000
      });
    } catch (error) {
      toast({
        title: "Error Updating Tour",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteTour = async (tourId) => {
    if (!confirm("Are you sure you want to delete this tour integration?")) {
      return;
    }

    try {
      await WooCommerceCredentials.delete(tourId);
      await loadData();
      
      toast({
        title: "Tour Deleted",
        duration: 2000
      });
    } catch (error) {
      toast({
        title: "Error Deleting Tour",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSecretVisibility = (tourId) => {
    setShowSecrets(prev => ({
      ...prev,
      [tourId]: !prev[tourId]
    }));
  };

  const getWebhookUrl = (siteName) => {
    const configuredFunctionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionsBaseUrl = configuredFunctionsUrl
      ? configuredFunctionsUrl.replace(/\/$/, '')
      : supabaseUrl
        ? `${supabaseUrl}/functions/v1`
        : `${window.location.origin}/functions/v1`;
    const webhookFunction =
      import.meta.env.VITE_WOOCOMMERCE_WEBHOOK_FUNCTION || 'woo-commerce-webhook';

    return `${functionsBaseUrl}/${webhookFunction}?site=${encodeURIComponent(siteName)}`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Settings className="w-8 h-8 text-blue-600 animate-spin" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Loading...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Access Denied:</strong> This page is only available to administrators.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tour Setup & Integration</h1>
          <p className="text-slate-600 mt-1">
            Easy onboarding for new WooCommerce tours - No environment variables needed! 🎉
          </p>
        </div>
      </div>

      {/* Migration Alert - Only show if no tours exist */}
      {tours.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <Download className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Migrate Existing Credentials:</strong> We detected you have WooCommerce credentials in environment variables. Click here to import them automatically!
              </div>
              <Button
                onClick={handleMigration}
                disabled={isMigrating}
                size="sm"
                className="ml-4 bg-amber-600 hover:bg-amber-700"
              >
                {isMigrating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import Now
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Start Guide */}
      <Alert className="border-blue-200 bg-blue-50">
        <CheckCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>Quick Start:</strong> Add your WooCommerce API credentials below, then click "Sync WooCommerce" on the Dashboard to import orders. That's it!
        </AlertDescription>
      </Alert>

      {/* Add New Tour */}
      <Card className="border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-emerald-50">
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Tour
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1 block">
                Tour Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g., Eiffel Tower Tour"
                value={newTour.tour_name}
                onChange={(e) => setNewTour({...newTour, tour_name: e.target.value})}
              />
              <p className="text-xs text-slate-500 mt-1">This will appear in your orders</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1 block">
                Website URL <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="https://example.com"
                value={newTour.website_url}
                onChange={(e) => setNewTour({...newTour, website_url: e.target.value})}
              />
              <p className="text-xs text-slate-500 mt-1">Your WooCommerce site URL</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1 block">
                WooCommerce Consumer Key <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="ck_..."
                value={newTour.consumer_key}
                onChange={(e) => setNewTour({...newTour, consumer_key: e.target.value})}
                type="password"
              />
              <p className="text-xs text-slate-500 mt-1">From WooCommerce → Settings → Advanced → REST API</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1 block">
                WooCommerce Consumer Secret <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="cs_..."
                value={newTour.consumer_secret}
                onChange={(e) => setNewTour({...newTour, consumer_secret: e.target.value})}
                type="password"
              />
              <p className="text-xs text-slate-500 mt-1">From WooCommerce → Settings → Advanced → REST API</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700 mb-1 block">
                Profit Margin %
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="5"
                value={newTour.profit_margin * 100}
                onChange={(e) => setNewTour({...newTour, profit_margin: parseFloat(e.target.value) / 100})}
              />
              <p className="text-xs text-slate-500 mt-1">Expected profit margin (default: 25%)</p>
            </div>
          </div>
          
          <Button onClick={addNewTour} className="bg-blue-600 hover:bg-blue-700" size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Add Tour & Integrate
          </Button>
        </CardContent>
      </Card>

      {/* Current Tours */}
      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50 flex flex-row items-center justify-between">
          <CardTitle className="text-slate-900">Your Tours ({tours.length})</CardTitle>
          <Button 
            onClick={loadData} 
            variant="outline" 
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {tours.length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No tours yet</h3>
              <p className="text-slate-600 mb-4">Add your first WooCommerce tour above or import from environment variables</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tours.map((tour) => (
                <div key={tour.id} className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  {editingTour?.id === tour.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Tour Name</Label>
                          <Input
                            value={editingTour.tour_name}
                            onChange={(e) => setEditingTour({...editingTour, tour_name: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Website URL</Label>
                          <Input
                            value={editingTour.website_url}
                            onChange={(e) => setEditingTour({...editingTour, website_url: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Consumer Key</Label>
                          <Input
                            value={editingTour.consumer_key}
                            onChange={(e) => setEditingTour({...editingTour, consumer_key: e.target.value})}
                            type="password"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Consumer Secret</Label>
                          <Input
                            value={editingTour.consumer_secret}
                            onChange={(e) => setEditingTour({...editingTour, consumer_secret: e.target.value})}
                            type="password"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Profit Margin %</Label>
                          <Input
                            type="number"
                            value={editingTour.profit_margin * 100}
                            onChange={(e) => setEditingTour({...editingTour, profit_margin: parseFloat(e.target.value) / 100})}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={editingTour.is_active}
                            onCheckedChange={(checked) => setEditingTour({...editingTour, is_active: checked})}
                          />
                          <Label>Active</Label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => updateTour(editingTour)} size="sm" className="bg-green-600 hover:bg-green-700">
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button onClick={() => setEditingTour(null)} variant="outline" size="sm">
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg text-slate-900">{tour.tour_name}</h3>
                            {tour.is_active ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                            )}
                            <Badge variant="outline">{(tour.profit_margin * 100).toFixed(0)}% margin</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <ExternalLink className="w-4 h-4" />
                            <a href={tour.website_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                              {tour.website_url}
                            </a>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditingTour(tour)}
                            className="hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => deleteTour(tour.id)}
                            className="hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                        <div>
                          <Label className="text-xs text-slate-600 mb-1 block">Site Identifier</Label>
                          <code className="text-sm bg-white px-2 py-1 rounded border border-slate-200">{tour.site_name}</code>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-slate-600 mb-1 block">API Endpoint</Label>
                          <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block">{tour.api_url}</code>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs text-slate-600">Consumer Key</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSecretVisibility(tour.id)}
                              className="h-6 px-2"
                            >
                              {showSecrets[tour.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </Button>
                          </div>
                          <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block">
                            {showSecrets[tour.id] ? tour.consumer_key : '••••••••••••••••'}
                          </code>
                        </div>

                        <div>
                          <Label className="text-xs text-slate-600 mb-1 block">Consumer Secret</Label>
                          <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block">
                            {showSecrets[tour.id] ? tour.consumer_secret : '••••••••••••••••'}
                          </code>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="text-xs text-slate-600">Webhook URL</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(getWebhookUrl(tour.site_name))}
                              className="h-6 px-2"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block break-all">
                            {getWebhookUrl(tour.site_name)}
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card className="border-emerald-200">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50">
          <CardTitle className="text-emerald-900">📋 How to Complete Setup</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">1</span>
              <div>
                <h4 className="font-medium text-slate-900">Get WooCommerce API Credentials</h4>
                <p className="text-sm text-slate-600 mt-1">
                  In each WooCommerce site: <strong>WooCommerce → Settings → Advanced → REST API → Add Key</strong>
                </p>
                <p className="text-xs text-slate-500 mt-1">Permissions: Read/Write</p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">2</span>
              <div>
                <h4 className="font-medium text-slate-900">Add Tour Above</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Fill in the form and click "Add Tour & Integrate" - that's it!
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">3</span>
              <div>
                <h4 className="font-medium text-slate-900">Set Up Webhook (Optional but Recommended)</h4>
                <p className="text-sm text-slate-600 mt-1">
                  In WooCommerce: <strong>Settings → Advanced → Webhooks → Add Webhook</strong>
                </p>
                <ul className="text-xs text-slate-500 mt-2 space-y-1 ml-4 list-disc">
                  <li>Topic: Order created, Order updated</li>
                  <li>Delivery URL: Copy from tour card above</li>
                  <li>Secret: Use WOOCOMMERCE_WEBHOOK_SECRET from your Environment Variables</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="bg-emerald-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">4</span>
              <div>
                <h4 className="font-medium text-slate-900">Sync Orders</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Go to Dashboard and click <strong>"Sync WooCommerce"</strong> to import all orders
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">5</span>
              <div>
                <h4 className="font-medium text-slate-900">Ad Spend Tracking (Make.com)</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Update your Make.com scenario to use the tour name (without "Tour" suffix)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Example: For "Eiffel Tower Tour", use "Eiffel Tower" in your Google Ads campaign name
                </p>
              </div>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Important:</strong> Your WooCommerce credentials are stored securely in your database. Only admins can view and edit them.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}