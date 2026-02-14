import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, ExternalLink, Loader2, Edit2, Save, X, FileText, Square, Mail, Upload, Image as ImageIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import PDFPresetEditor from "../components/tours/PDFPresetEditor";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Athens",
  "Europe/Bucharest",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland"
];

export default function ToursPage() {
  const [tours, setTours] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [currentNotes, setCurrentNotes] = useState({ tourId: null, notes: '' });
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState({ tourId: null, tourName: '', preset: null });
  const [recommendedDialogOpen, setRecommendedDialogOpen] = useState(false);
  const [currentRecommended, setCurrentRecommended] = useState({ tourId: null, tourName: '', recommended: [] });
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [currentUser, toursData] = await Promise.all([
          base44.auth.me(),
          base44.entities.Tour.list(),
        ]);
        setUser(currentUser);
        setTours(toursData);

        try {
          const credsData = await base44.entities.WooCommerceCredentials.list();
          setCredentials(credsData || []);
        } catch (credentialsError) {
          // Staff may not have credentials-table access; tours page should still load.
          setCredentials([]);
        }
      } catch (error) {
        console.error("Error loading tours:", error);
      }
      setIsLoading(false);
    };

    loadData();
  }, []);

  const getWooCommerceInfo = (tourName) => {
    return credentials.find(c => c.site_name === tourName || c.tour_name === tourName);
  };

  const canManageTours = ["admin", "staff"].includes(
    String(user?.role || "").toLowerCase()
  );

  const handleEdit = (tour) => {
    const wooInfo = getWooCommerceInfo(tour.woocommerce_site_name);
    setEditingId(tour.id);
    setEditForm({
      site_url: tour.site_url || wooInfo?.website_url || '',
      official_ticketing_url: tour.official_ticketing_url || '',
      physical_address: tour.physical_address || '',
      sop_url: tour.sop_url || '',
      video_url: tour.video_url || '',
      google_drive_receipts_url: tour.google_drive_receipts_url || '',
      timezone: tour.timezone || '',
      card_number: tour.card_number || '',
      card_expiry: tour.card_expiry || '',
      card_cvv: tour.card_cvv || '',
      image_url: tour.image_url || ''
    });
  };

  const handleImageUpload = async (tourId, file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Tour.update(tourId, { image_url: file_url });
      const updatedTours = await base44.entities.Tour.list();
      setTours(updatedTours);
      toast({
        title: "Success",
        description: "Tour image uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSave = async (tourId) => {
    try {
      await base44.entities.Tour.update(tourId, editForm);
      const updatedTours = await base44.entities.Tour.list();
      setTours(updatedTours);
      setEditingId(null);
      setEditForm({});
      toast({
        title: "Success",
        description: "Tour updated successfully",
      });
    } catch (error) {
      console.error("Error updating tour:", error);
      toast({
        title: "Error",
        description: "Failed to update tour",
        variant: "destructive",
      });
    }
  };

  const handleOpenNotes = (tour) => {
    setCurrentNotes({ tourId: tour.id, notes: tour.notes || '' });
    setNotesDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    try {
      await base44.entities.Tour.update(currentNotes.tourId, { notes: currentNotes.notes });
      const updatedTours = await base44.entities.Tour.list();
      setTours(updatedTours);
      setNotesDialogOpen(false);
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    }
  };

  const handleOpenPresetEditor = (tour) => {
    setCurrentPreset({ 
      tourId: tour.id, 
      tourName: tour.name,
      preset: tour.pdf_redaction_preset || null 
    });
    setPresetDialogOpen(true);
  };

  const handleSavePreset = async (preset) => {
    try {
      await base44.entities.Tour.update(currentPreset.tourId, { pdf_redaction_preset: preset });
      const updatedTours = await base44.entities.Tour.list();
      setTours(updatedTours);
      setPresetDialogOpen(false);
      toast({
        title: "Success",
        description: "PDF redaction preset saved successfully",
      });
    } catch (error) {
      console.error("Error saving preset:", error);
      toast({
        title: "Error",
        description: "Failed to save preset",
        variant: "destructive",
      });
    }
  };

  const handleOpenRecommendedEditor = (tour) => {
    setCurrentRecommended({ 
      tourId: tour.id, 
      tourName: tour.name,
      recommended: tour.recommended_tours || [] 
    });
    setRecommendedDialogOpen(true);
  };

  const handleSaveRecommended = async () => {
    try {
      await base44.entities.Tour.update(currentRecommended.tourId, { 
        recommended_tours: currentRecommended.recommended 
      });
      const updatedTours = await base44.entities.Tour.list();
      setTours(updatedTours);
      setRecommendedDialogOpen(false);
      toast({
        title: "Success",
        description: "Recommended tours saved successfully",
      });
    } catch (error) {
      console.error("Error saving recommended tours:", error);
      toast({
        title: "Error",
        description: "Failed to save recommended tours",
        variant: "destructive",
      });
    }
  };

  const toggleRecommended = (tourName) => {
    setCurrentRecommended(prev => {
      const isCurrentlySelected = prev.recommended.includes(tourName);
      return {
        ...prev,
        recommended: isCurrentlySelected 
          ? prev.recommended.filter(t => t !== tourName)
          : [...prev.recommended, tourName]
      };
    });
  };



  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <MapPin className="w-8 h-8 text-emerald-600" />
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tours Reference</h1>
          <p className="text-slate-600 mt-1">Quick access to tour information and resources</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg text-slate-900">Tours Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-800 hover:bg-emerald-800">
                  <TableHead className="text-white font-semibold">Tour</TableHead>
                  <TableHead className="text-white font-semibold">Image</TableHead>
                  <TableHead className="text-white font-semibold">Timezone</TableHead>
                  <TableHead className="text-white font-semibold">Physical Address</TableHead>
                  <TableHead className="text-white font-semibold">Via Nova Site</TableHead>
                  <TableHead className="text-white font-semibold">Official Site</TableHead>
                  <TableHead className="text-white font-semibold">SOP</TableHead>
                  <TableHead className="text-white font-semibold">Video</TableHead>
                  <TableHead className="text-white font-semibold">Card Number</TableHead>
                  <TableHead className="text-white font-semibold">Expiry</TableHead>
                  <TableHead className="text-white font-semibold">CVV</TableHead>
                  <TableHead className="text-white font-semibold">Notes</TableHead>
                  <TableHead className="text-white font-semibold">PDF Preset</TableHead>
                  <TableHead className="text-white font-semibold">Email Recommendations</TableHead>
                  {canManageTours && <TableHead className="text-white font-semibold">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tours.map((tour) => {
                  const wooInfo = getWooCommerceInfo(tour.woocommerce_site_name);
                  const isEditing = editingId === tour.id;
                  
                  return (
                    <TableRow key={tour.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900">
                        {tour.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tour.image_url ? (
                            <img 
                              src={tour.image_url} 
                              alt={tour.name} 
                              className="w-16 h-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-slate-400" />
                            </div>
                          )}
                          {canManageTours && (
                            <>
                              <input
                                id={`upload-${tour.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(tour.id, file);
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => document.getElementById(`upload-${tour.id}`).click()}
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editForm.timezone || ''}
                            onValueChange={(value) => setEditForm({...editForm, timezone: value})}
                          >
                            <SelectTrigger className="w-48 text-sm">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONES.map(tz => (
                                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={tour.timezone ? "text-slate-900" : "text-slate-400"}>
                            {tour.timezone || "-"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.physical_address || ''}
                            onChange={(e) => setEditForm({...editForm, physical_address: e.target.value})}
                            placeholder="123 Main St, City, Country"
                            className="text-sm min-w-64"
                          />
                        ) : tour.physical_address ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 text-sm">{tour.physical_address}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(tour.physical_address);
                                toast({ title: "Copied!", description: "Address copied to clipboard" });
                              }}
                              className="h-6 px-2"
                            >
                              📋
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.site_url || ''}
                            onChange={(e) => setEditForm({...editForm, site_url: e.target.value})}
                            placeholder="https://..."
                            className="text-sm"
                          />
                        ) : (tour.site_url || wooInfo?.website_url) ? (
                          <a
                            href={tour.site_url || wooInfo.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                          >
                            {(tour.site_url || wooInfo.website_url).replace(/^https?:\/\//, '')} 
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.official_ticketing_url}
                            onChange={(e) => setEditForm({...editForm, official_ticketing_url: e.target.value})}
                            placeholder="https://..."
                            className="text-sm"
                          />
                        ) : tour.official_ticketing_url ? (
                          <a
                            href={tour.official_ticketing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                          >
                            {tour.official_ticketing_url.replace(/^https?:\/\//, '')}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.sop_url}
                            onChange={(e) => setEditForm({...editForm, sop_url: e.target.value})}
                            placeholder="https://..."
                            className="text-sm"
                          />
                        ) : tour.sop_url ? (
                          <a
                            href={tour.sop_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                          >
                            View SOP
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.video_url}
                            onChange={(e) => setEditForm({...editForm, video_url: e.target.value})}
                            placeholder="https://..."
                            className="text-sm"
                          />
                        ) : tour.video_url ? (
                          <a
                            href={tour.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                          >
                            Watch Video
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.card_number || ''}
                            onChange={(e) => setEditForm({...editForm, card_number: e.target.value})}
                            placeholder="4733 4441 4998 0688"
                            className="text-sm font-mono"
                          />
                        ) : tour.card_number ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-mono text-sm">{tour.card_number}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(tour.card_number);
                                toast({ title: "Copied!", description: "Card number copied to clipboard" });
                              }}
                              className="h-6 px-2"
                            >
                              📋
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.card_expiry || ''}
                            onChange={(e) => setEditForm({...editForm, card_expiry: e.target.value})}
                            placeholder="09/30"
                            className="text-sm font-mono w-24"
                          />
                        ) : tour.card_expiry ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-mono text-sm">{tour.card_expiry}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(tour.card_expiry);
                                toast({ title: "Copied!", description: "Expiry date copied" });
                              }}
                              className="h-6 px-2"
                            >
                              📋
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.card_cvv || ''}
                            onChange={(e) => setEditForm({...editForm, card_cvv: e.target.value})}
                            placeholder="893"
                            className="text-sm font-mono w-20"
                          />
                        ) : tour.card_cvv ? (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-mono text-sm">{tour.card_cvv}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(tour.card_cvv);
                                toast({ title: "Copied!", description: "CVV copied" });
                              }}
                              className="h-6 px-2"
                            >
                              📋
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenNotes(tour)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenPresetEditor(tour)}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <Square className="w-4 h-4" />
                          {tour.pdf_redaction_preset?.masks?.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {tour.pdf_redaction_preset.masks.length}
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenRecommendedEditor(tour)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Mail className="w-4 h-4" />
                          {tour.recommended_tours?.length > 0 && (
                            <Badge variant="secondary" className="ml-1">
                              {tour.recommended_tours.length}
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      {canManageTours && (
                        <TableCell>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSave(tour.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancel}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(tour)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {tours.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Tours Yet</h3>
              <p className="text-slate-600">Tours will appear here once they're added to the system.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tour Notes</DialogTitle>
            <DialogDescription>
              Add or edit notes for this tour. These notes are visible to staff and admins.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={currentNotes.notes}
              onChange={(e) => setCurrentNotes({ ...currentNotes, notes: e.target.value })}
              placeholder="Enter notes about this tour..."
              rows={10}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes} className="bg-emerald-600 hover:bg-emerald-700">
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PDF Redaction Preset Editor</DialogTitle>
            <DialogDescription>
              Upload a sample PDF and draw white rectangles to mask sensitive information. These masks will be applied to all uploaded tickets for this tour.
            </DialogDescription>
          </DialogHeader>
          <PDFPresetEditor 
            tourName={currentPreset.tourName}
            preset={currentPreset.preset}
            onSave={handleSavePreset}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={recommendedDialogOpen} onOpenChange={setRecommendedDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Recommendations for {currentRecommended.tourName}</DialogTitle>
            <DialogDescription>
              Select tours to recommend in confirmation emails. These will appear at the bottom of ticket emails sent to customers.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tours
                .filter(t => t.name !== currentRecommended.tourName)
                .map(tour => {
                  const isSelected = currentRecommended.recommended.includes(tour.name);
                  return (
                    <div 
                      key={tour.id}
                      onClick={() => toggleRecommended(tour.name)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{tour.name}</span>
                        {isSelected && (
                          <Badge className="bg-blue-600">Selected</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            {currentRecommended.recommended.length === 0 && (
              <div className="text-center text-slate-500 py-8">
                No tours selected. Click on tours above to recommend them in emails.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecommendedDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecommended} className="bg-blue-600 hover:bg-blue-700">
              Save Recommendations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}