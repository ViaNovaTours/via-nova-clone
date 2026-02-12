import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { format, parse } from 'npm:date-fns@3.6.0';



Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, downloadLink } = await req.json();
    
    if (!orderId) {
      return Response.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Get order details
    const orders = await base44.entities.Order.filter({ order_id: orderId });
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const order = orders[0];
    
    // Validate email and ticket files
    if (!order.email) {
      return Response.json({ error: 'Order has no customer email' }, { status: 400 });
    }
    
    if (!order.ticket_files || order.ticket_files.length === 0) {
      return Response.json({ error: 'No ticket files uploaded yet' }, { status: 400 });
    }

    // Get tour details - optimized with filter
    const tours = await base44.asServiceRole.entities.Tour.filter({ name: order.tour });
    const tour = tours && tours.length > 0 ? tours[0] : null;
    
    // Get tour landing page for confirmation email address
    const landingPages = await base44.asServiceRole.entities.TourLandingPage.filter({ tour_name: order.tour });
    const landingPage = landingPages && landingPages.length > 0 ? landingPages[0] : null;
    
    console.log('Tour:', order.tour);
    console.log('Physical address:', tour?.physical_address);
    
    // Get recommended tours from manual selection - optimized
    let recommendedTours = [];
    if (tour?.recommended_tours && tour.recommended_tours.length > 0) {
      // Fetch only the recommended tours we need
      const recommendedLandingPages = await base44.asServiceRole.entities.TourLandingPage.filter({
        tour_name: { $in: tour.recommended_tours }
      });
      
      const recommendedToursData = await base44.asServiceRole.entities.Tour.filter({
        name: { $in: tour.recommended_tours }
      });
      
      console.log('Tour has recommended_tours:', tour.recommended_tours);
      console.log('Found landing pages:', recommendedLandingPages.map(lp => lp.tour_name));
      
      recommendedTours = tour.recommended_tours
        .map(tourName => {
          const recommendedTour = recommendedToursData.find(t => t.name === tourName);
          const lp = recommendedLandingPages.find(page => page.tour_name === tourName);
          console.log(`Mapping ${tourName} to landing page:`, lp ? lp.tour_name : 'NOT FOUND');
          return lp ? { ...lp, image_url: recommendedTour?.image_url } : null;
        })
        .filter(lp => lp && lp.is_active !== false && lp.domain)
        .slice(0, 3);
      
      console.log('Final recommended tours:', recommendedTours.map(t => t?.tour_name));
    }

    // Download PDF attachments from Google Drive
    const attachments = [];
    const accessToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
    
    for (const fileUrl of order.ticket_files) {
      try {
        // Extract Google Drive file ID from URL
        const fileIdMatch = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (!fileIdMatch) {
          console.warn('Could not extract file ID from URL:', fileUrl);
          continue;
        }
        
        const fileId = fileIdMatch[1];
        
        // Download file from Google Drive
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const fileResponse = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!fileResponse.ok) {
          console.warn('Failed to download file:', fileId);
          continue;
        }
        
        const fileBytes = new Uint8Array(await fileResponse.arrayBuffer());
        
        // Convert ArrayBuffer to base64 in chunks to avoid maximum call stack size
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < fileBytes.length; i += chunkSize) {
          const chunk = fileBytes.slice(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Content = btoa(binary);
        
        console.log('Successfully downloaded and encoded file:', fileId);
        
        attachments.push({
          content: base64Content,
          filename: `${order.tour.replace(/[^a-zA-Z0-9]/g, '-')}-Ticket.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        });
      } catch (err) {
        console.error('Error downloading attachment:', err, err.stack);
      }
    }
    
    console.log('Total attachments prepared:', attachments.length);

    // Format tour date
    let formattedDate = order.tour_date;
    if (order.tour_date) {
      try {
        const dateObj = parse(order.tour_date, 'yyyy-MM-dd', new Date());
        formattedDate = format(dateObj, 'MMMM d, yyyy');
      } catch (e) {
        console.warn('Could not format date:', order.tour_date);
      }
    }

    // Build email HTML
    const emailHtml = buildEmailTemplate({
      customerName: `${order.first_name} ${order.last_name}`,
      tourName: order.tour,
      tourDate: formattedDate,
      tourTime: order.tour_time,
      location: tour?.physical_address || '',
      recommendedTours,
      downloadLink: downloadLink || null
    });

    // Send email via SendGrid
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');
    if (!sendGridApiKey) {
      return Response.json({ error: 'SendGrid not configured' }, { status: 500 });
    }

    const emailPayload = {
      personalizations: [{
        to: [{ email: order.email, name: `${order.first_name} ${order.last_name}` }],
        bcc: [{ email: 'vianovatours@gmail.com' }],
        subject: `Your ${order.tour} Ticket is Attached`,
        custom_args: {
          order_id: order.order_id
        }
      }],
      from: {
        email: 'info@vianovatours.com',
        name: order.tour
      },
      content: [{
        type: 'text/html',
        value: emailHtml
      }],
      tracking_settings: {
        click_tracking: { enable: true },
        open_tracking: { enable: true }
      }
    };
    
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const sendResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('SendGrid error:', errorText);
      console.error('Email payload size:', JSON.stringify(emailPayload).length);
      return Response.json({ error: 'Failed to send email', details: errorText }, { status: 500 });
    }
    
    console.log('Email sent successfully with', attachments.length, 'attachments');

    // Log communication to order
    const communication = {
      timestamp: new Date().toISOString(),
      message: `Ticket email sent to ${order.email}`,
      sent_by: user.email,
      type: 'email_sent',
      subject: `Your ${order.tour} Ticket is Attached`
    };
    
    const existingComms = order.customer_communication || [];
    await base44.entities.Order.update(order.id, {
      customer_communication: [...existingComms, communication]
    });

    return Response.json({ success: true, message: 'Ticket email sent successfully' });

  } catch (error) {
    console.error('Send ticket email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildEmailTemplate({ customerName, tourName, tourDate, tourTime, location, recommendedTours, downloadLink }) {

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
                       ${(tour.image_url || tour.hero_image_url) ? `<img src="${tour.image_url || tour.hero_image_url}" alt="${tour.tour_name}" style="width: 100%; height: 180px; object-fit: cover; display: block;" />` : ''}
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
    <!-- Header -->
    <tr>
      <td style="background-color: #4c51bf; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Your Ticket is Below</h1>
      </td>
    </tr>
    
    <!-- Main Content -->
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
        
        <!-- Tour Details Box -->
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
    
    <!-- Footer -->
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