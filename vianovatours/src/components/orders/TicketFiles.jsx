import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Upload, Eye, Trash2, Loader2, AlertCircle, ExternalLink, Mail, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { uploadToGoogleDrive } from "@/functions/uploadToGoogleDrive";
import { sendTicketEmail } from "@/functions/sendTicketEmail";
import { sendReservedEmail } from "@/functions/sendReservedEmail";
import { rasterizePDF } from "./PDFRasterizer";
import { base44 } from "@/api/base44Client";

export default function TicketFiles({ order, onUpdate, onRefresh }) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [error, setError] = useState(null);
  const [emailSuccessMessage, setEmailSuccessMessage] = useState("");
  const [loadingFile, setLoadingFile] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [downloadLink, setDownloadLink] = useState('');
  const [isSendingReserved, setIsSendingReserved] = useState(false);
  const [reservedEmailPreview, setReservedEmailPreview] = useState(null);
  const [isLoadingReservedPreview, setIsLoadingReservedPreview] = useState(false);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      let fileToUpload = file;
      
      // Get tour preset for rasterization
      if (file.type === 'application/pdf') {
        try {
          console.log('PDF detected, checking for redaction preset...');
          console.log('Order tour name:', order.tour);
          
          const tours = await base44.entities.Tour.list();
          console.log('All tours:', tours.map(t => t.name));
          console.log('Order tour name:', order.tour);
          
          // Flexible matching: find tour name that is contained in order tour name
          const tour = tours.find(t => {
            const tourNameLower = t.name.toLowerCase();
            const orderTourLower = order.tour.toLowerCase();
            const isExactMatch = tourNameLower === orderTourLower;
            const isContained = orderTourLower.includes(tourNameLower);
            console.log(`Checking "${t.name}": exact=${isExactMatch}, contained=${isContained}`);
            return isExactMatch || isContained;
          });
          console.log('Matched tour:', tour?.name);
          console.log('Tour preset:', tour?.pdf_redaction_preset);
          
          if (tour?.pdf_redaction_preset?.masks?.length > 0) {
            console.log('Rasterizing PDF with', tour.pdf_redaction_preset.masks.length, 'masks...');
            fileToUpload = await rasterizePDF(file, tour.pdf_redaction_preset);
            console.log('PDF rasterized successfully');
          } else {
            console.log('No redaction preset found or no masks defined, uploading original PDF');
          }
        } catch (rasterError) {
          console.error('Rasterization failed:', rasterError);
          console.warn('Uploading original PDF due to rasterization error');
          // Continue with original file
        }
      }
      
      // Convert file to base64
      const reader = new FileReader();
      const fileData = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(fileToUpload);
      });

      const { data } = await uploadToGoogleDrive({
        fileData: fileData.split(',')[1], // Get base64 part only
        fileName: file.name,
        fileType: file.type,
        tourName: order.tour,
        orderId: order.order_id,
        firstName: order.first_name,
        lastName: order.last_name
      });
      
      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      // Store Google Drive URL in order
      const updatedFiles = [...(order.ticket_files || []), data.fileUrl];
      await onUpdate({ ticket_files: updatedFiles });
    } catch (err) {
      console.error("File upload failed:", err);
      setError(err.message || "File upload failed. Please try again.");
    }
    setIsUploading(false);
  };

  const handleViewFile = async (fileUrl) => {
    // Google Drive URLs can be opened directly
    window.open(fileUrl, "_blank");
  };

  const handleDeleteFile = async (fileUrlToDelete) => {
    const updatedFiles = (order.ticket_files || []).filter(
      (url) => url !== fileUrlToDelete
    );
    await onUpdate({ ticket_files: updatedFiles });
  };

  const handlePreviewEmail = async () => {
    setIsLoadingPreview(true);
    setError(null);
    
    try {
      // Get tour details for preview
      const tours = await base44.entities.Tour.list();
      const tour = tours.find(t => {
        const tourNameLower = t.name.toLowerCase();
        const orderTourLower = order.tour.toLowerCase();
        return tourNameLower === orderTourLower || 
               orderTourLower.includes(tourNameLower) ||
               orderTourLower.startsWith(tourNameLower);
      });
      
      // Get landing page for confirmation email
      const landingPages = await base44.entities.TourLandingPage.filter({ tour_name: order.tour });
      const landingPage = landingPages && landingPages.length > 0 ? landingPages[0] : null;
      
      // Get recommended tours
      const allLandingPages = await base44.entities.TourLandingPage.list();
      const recommendedTours = (tour?.recommended_tours || [])
        .map(tourName => allLandingPages.find(page => page.tour_name === tourName))
        .filter(lp => lp && lp.is_active !== false && lp.domain)
        .slice(0, 3);
      
      // Format date
      let formattedDate = order.tour_date;
      if (order.tour_date) {
        try {
          const { parse, format } = await import('date-fns');
          const dateObj = parse(order.tour_date, 'yyyy-MM-dd', new Date());
          formattedDate = format(dateObj, 'MMMM d, yyyy');
        } catch (e) {
          console.warn('Could not format date:', order.tour_date);
        }
      }
      
      setEmailPreview({
        customerName: `${order.first_name} ${order.last_name}`,
        tourName: order.tour,
        tourDate: formattedDate,
        tourTime: order.tour_time,
        location: tour?.physical_address || '',
        recommendedTours,
        downloadLink,
        to: order.email,
        from: 'info@vianovatours.com',
        subject: `Your ${order.tour} Ticket is Attached`
      });
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'Failed to load preview');
    }
    
    setIsLoadingPreview(false);
  };

  const handleSendEmail = async () => {
    if (!order.email) {
      setError('Customer email is missing');
      return;
    }
    
    if (!order.ticket_files || order.ticket_files.length === 0) {
      setError('No ticket files to send');
      return;
    }

    setIsSendingEmail(true);
    setError(null);
    setEmailSuccessMessage("");
    
    try {
      const orderLookup = order.order_id || order.id;
      const response = await sendTicketEmail({ 
        orderId: orderLookup,
        downloadLink: downloadLink || undefined
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send email');
      }
      
      setEmailSuccessMessage(`Ticket email sent successfully to ${order.email}`);
      setTimeout(() => setEmailSuccessMessage(""), 5000);
      
      // Refresh order data to show updated timeline/communications
      if (onRefresh) {
        await onRefresh();
      } else if (onUpdate) {
        await onUpdate({ updated_date: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Send email error:', err);
      setError(err.message || 'Failed to send email');
    }
    
    setIsSendingEmail(false);
  };

  const handleSendTestEmail = async () => {
    if (!order.ticket_files || order.ticket_files.length === 0) {
      setError("No ticket files to send");
      return;
    }

    setIsSendingTestEmail(true);
    setError(null);
    setEmailSuccessMessage("");

    try {
      const orderLookup = order.order_id || order.id;
      const response = await sendTicketEmail({
        orderId: orderLookup,
        downloadLink: downloadLink || undefined,
        testMode: true,
        testEmail: "archive@vianovatours.com",
      });

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to send test email");
      }

      setEmailSuccessMessage(
        "Test email sent successfully to archive@vianovatours.com"
      );
      setTimeout(() => setEmailSuccessMessage(""), 5000);

      if (onRefresh) {
        await onRefresh();
      } else if (onUpdate) {
        await onUpdate({ updated_date: new Date().toISOString() });
      }
    } catch (err) {
      console.error("Send test email error:", err);
      setError(err.message || "Failed to send test email");
    }

    setIsSendingTestEmail(false);
  };

  const handlePreviewReservedEmail = async () => {
    setIsLoadingReservedPreview(true);
    setError(null);
    
    try {
      // Get tour details for physical address
      const tours = await base44.entities.Tour.list();
      const tour = tours.find(t => {
        const tourNameLower = t.name.toLowerCase();
        const orderTourLower = order.tour.toLowerCase();
        return tourNameLower === orderTourLower || 
               orderTourLower.includes(tourNameLower) ||
               orderTourLower.startsWith(tourNameLower);
      });
      
      // Get landing page for confirmation email
      const landingPages = await base44.entities.TourLandingPage.filter({ tour_name: order.tour });
      const landingPage = landingPages && landingPages.length > 0 ? landingPages[0] : null;
      
      // Format date
      let formattedDate = order.tour_date;
      if (order.tour_date) {
        try {
          const { parse, format } = await import('date-fns');
          const dateObj = parse(order.tour_date, 'yyyy-MM-dd', new Date());
          formattedDate = format(dateObj, 'MMMM d, yyyy');
        } catch (e) {
          console.warn('Could not format date:', order.tour_date);
        }
      }
      
      setReservedEmailPreview({
        customerName: `${order.first_name} ${order.last_name}`,
        tourName: order.tour,
        tourDate: formattedDate,
        tourTime: order.tour_time,
        location: tour?.physical_address || '',
        to: order.email,
        from: landingPage?.confirmation_email_from || 'info@vianovatours.com',
        subject: `We've Reserved Your Spot(s)`
      });
    } catch (err) {
      console.error('Reserved preview error:', err);
      setError(err.message || 'Failed to load preview');
    }
    
    setIsLoadingReservedPreview(false);
  };

  const handleSendReservedEmail = async () => {
    if (!order.email) {
      setError('Customer email is missing');
      return;
    }

    setIsSendingReserved(true);
    setError(null);
    
    try {
      const orderLookup = order.order_id || order.id;
      const response = await sendReservedEmail({ 
        orderId: orderLookup
      });
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send email');
      }
      
      alert('Reserved email sent successfully!');
      
      // Refresh order data to show updated timeline/communications
      if (onRefresh) {
        await onRefresh();
      } else if (onUpdate) {
        await onUpdate({ updated_date: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Send reserved email error:', err);
      setError(err.message || 'Failed to send reserved email');
    }
    
    setIsSendingReserved(false);
  };

  const getFileName = (url) => {
    // Extract order ID and filename from Google Drive URL format
    if (url.includes('drive.google.com')) {
      // For Google Drive URLs, we'll show a generic name with link icon
      return 'View in Google Drive';
    }
    try {
      return decodeURIComponent(url.split('/').pop());
    } catch {
      return url.split('/').pop();
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Ticket PDFs
          </div>
          <Badge variant="secondary">{(order.ticket_files || []).length} files</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {emailSuccessMessage && (
          <Alert className="border-green-200 bg-green-50">
            <Mail className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {emailSuccessMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* File List */}
        <div className="space-y-2">
          {(order.ticket_files || []).length > 0 ? (
            order.ticket_files.map((fileUrl) => (
              <div
                key={fileUrl}
                className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200"
              >
                <Button
                  variant="ghost"
                  onClick={() => handleViewFile(fileUrl)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-800 hover:text-blue-600 flex-1 justify-start"
                >
                  <ExternalLink className="w-4 h-4" />
                  {getFileName(fileUrl)}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDeleteFile(fileUrl)}
                  className="h-8 w-8 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-slate-500">
              <p>No ticket PDFs uploaded yet.</p>
            </div>
          )}
        </div>

        {/* Download Link Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Download Link (Optional)
          </label>
          <Input
            type="url"
            value={downloadLink}
            onChange={(e) => setDownloadLink(e.target.value)}
            placeholder="https://example.com/download-ticket"
            className="text-sm"
          />
          <p className="text-xs text-slate-500">
            If provided, adds a "Download Ticket" button to the email
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button asChild variant="outline" className="w-full" disabled={isUploading}>
            <label htmlFor="ticket-upload" className="cursor-pointer flex items-center gap-2">
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{ (order.ticket_files || []).length > 0 ? 'Upload Another' : 'Upload PDF' }</span>
                </>
              )}
              <input
                id="ticket-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                onClick={handlePreviewEmail}
                disabled={isLoadingPreview || !order.ticket_files || order.ticket_files.length === 0}
                className="w-full"
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </>
                )}
              </Button>
            </DialogTrigger>
            {emailPreview && (
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Email Preview</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="bg-slate-100 p-4 rounded-lg space-y-2 text-sm">
                    <div><strong>To:</strong> {emailPreview.to}</div>
                    <div><strong>From:</strong> {emailPreview.from}</div>
                    <div><strong>Subject:</strong> {emailPreview.subject}</div>
                    <div><strong>Attachments:</strong> {order.ticket_files.length} PDF file(s)</div>
                  </div>
                  <div 
                    className="border rounded-lg p-4"
                    dangerouslySetInnerHTML={{ __html: buildEmailHTML(emailPreview) }}
                  />
                </div>
              </DialogContent>
            )}
          </Dialog>
          
          <Button
            onClick={handleSendEmail}
            disabled={isSendingEmail || !order.ticket_files || order.ticket_files.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isSendingEmail ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </>
            )}
          </Button>

          <Button
            onClick={handleSendTestEmail}
            disabled={isSendingTestEmail || !order.ticket_files || order.ticket_files.length === 0}
            variant="outline"
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            {isSendingTestEmail ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sending Test...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Test
              </>
            )}
          </Button>
        </div>

        {/* Reserved Email Section */}
        <div className="pt-4 border-t border-slate-200">
          <p className="text-sm text-slate-600 mb-3 font-medium">
            Send reserved email if tour date is far in advance
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handlePreviewReservedEmail}
                  disabled={isLoadingReservedPreview}
                  className="w-full"
                >
                  {isLoadingReservedPreview ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </>
                  )}
                </Button>
              </DialogTrigger>
              {reservedEmailPreview && (
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Reserved Email Preview</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="bg-slate-100 p-4 rounded-lg space-y-2 text-sm">
                      <div><strong>To:</strong> {reservedEmailPreview.to}</div>
                      <div><strong>From:</strong> {reservedEmailPreview.from}</div>
                      <div><strong>Subject:</strong> {reservedEmailPreview.subject}</div>
                    </div>
                    <div 
                      className="border rounded-lg p-4"
                      dangerouslySetInnerHTML={{ __html: buildReservedEmailHTML(reservedEmailPreview) }}
                    />
                  </div>
                </DialogContent>
              )}
            </Dialog>
            
            <Button
              onClick={handleSendReservedEmail}
              disabled={isSendingReserved}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isSendingReserved ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Send Reserved
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildEmailHTML({ customerName, tourName, tourDate, tourTime, location, recommendedTours, downloadLink }) {
  const recommendedSection = recommendedTours.length > 0 ? `
    <table role="presentation" style="width: 100%; margin-top: 40px;">
      <tr>
        <td style="padding: 20px; background-color: #f7fafc;">
          <h2 style="color: #2d3748; font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 30px;">
            You might also like these tours
          </h2>
          <table role="presentation" style="width: 100%;">
            <tr>
              ${recommendedTours.map(tour => `
                <td style="padding: 10px; vertical-align: top; width: ${100/recommendedTours.length}%;">
                  <table role="presentation" style="width: 100%; background-color: white; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td style="padding: 0;">
                        ${tour.hero_image_url ? `<img src="${tour.hero_image_url}" alt="${tour.tour_name}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px;">
                        <h3 style="color: #2d3748; font-size: 18px; font-weight: bold; margin: 0 0 10px 0;">${tour.tour_name}</h3>
                        <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
                          ${tour.hero_subtitle || tour.description?.substring(0, 100) || ''}
                        </p>
                        <a href="https://${tour.domain}" target="_blank" style="display: inline-block; background-color: #4c51bf; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                          Book Now
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              `).join('')}
            </tr>
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7fafc;">
  <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white;">
    <tr>
      <td style="background-color: #4c51bf; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Ticket is Below</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hello ${customerName},
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Here is your ticket — we've attached it as a PDF for your convenience.<br>
          You can also view the PDF on your mobile phone at ${tourName}, where it will be accepted at the gate.
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          Remember: your tickets are valid during your selected date and time slot on the ticket.
        </p>
        
        ${downloadLink ? `
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${downloadLink}" target="_blank" style="display: inline-block; background-color: #10b981; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            📥 Download Ticket
          </a>
        </div>
        ` : ''}
        
        <table role="presentation" style="width: 100%; background-color: #edf2f7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <tr>
            <td>
              ${location ? `<p style="color: #2d3748; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Location:</strong>
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}" target="_blank" style="color: #4c51bf; text-decoration: none; margin-left: 5px;">
                  📍 ${location}
                </a>
              </p>` : ''}
              ${tourDate ? `<p style="color: #2d3748; font-size: 14px; margin: 0;">
                <strong>Date:</strong> ${tourDate} ${tourTime || ''}
              </p>` : ''}
            </td>
          </tr>
        </table>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0;">
          Thank you for your booking, and enjoy your visit!
        </p>
      </td>
    </tr>
    ${recommendedSection}
    <tr>
      <td style="background-color: #2d3748; padding: 30px; text-align: center;">
        <p style="color: #a0aec0; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Via Nova Tours. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildReservedEmailHTML({ customerName, tourName, tourDate, tourTime, location }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We've Reserved Your Spot(s)</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7fafc;">
  <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: white;">
    <tr>
      <td style="background-color: #4c51bf; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">We've Reserved Your Spot(s)</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hello!
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Thank you for booking your tour with us!
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Your ticket(s) are reserved. Because your tour is still far in advance, our technical team hasn't released the tickets yet (usually 15 - 30 days in advance).
        </p>
        <p style="color: #2d3748; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          You don't need to take any further action—we'll make sure they arrive on time.
        </p>
        <table role="presentation" style="width: 100%; background-color: #edf2f7; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
          <tr>
            <td>
              ${location ? `<p style="color: #2d3748; font-size: 14px; margin: 0 0 10px 0;">
                <strong>Location:</strong> ${location}
              </p>` : ''}
              ${tourDate ? `<p style="color: #2d3748; font-size: 14px; margin: 0;">
                <strong>Date:</strong> ${tourDate} ${tourTime || ''}
              </p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #2d3748; padding: 30px; text-align: center;">
        <p style="color: #a0aec0; font-size: 14px; margin: 0 0 10px 0;">
          Via Nova Tours
        </p>
        <p style="color: #a0aec0; font-size: 14px; margin: 0 0 10px 0;">
          info@vianovatours.com
        </p>
        <p style="color: #718096; font-size: 12px; margin: 0;">
          <a href="#" style="color: #718096; text-decoration: underline;">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}