import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { format, parse } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await req.json();
    
    if (!orderId) {
      return Response.json({ error: 'Order ID required' }, { status: 400 });
    }

    // Get order details
    const orders = await base44.entities.Order.filter({ order_id: orderId });
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const order = orders[0];
    
    // Validate email
    if (!order.email) {
      return Response.json({ error: 'Order has no customer email' }, { status: 400 });
    }

    // Get tour details for physical address - optimized with filter
    const tours = await base44.asServiceRole.entities.Tour.filter({ name: order.tour });
    const tour = tours && tours.length > 0 ? tours[0] : null;
    
    // Get tour landing page for confirmation email address
    const landingPages = await base44.asServiceRole.entities.TourLandingPage.filter({ tour_name: order.tour });
    const landingPage = landingPages && landingPages.length > 0 ? landingPages[0] : null;

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
    const emailHtml = buildReservedEmailTemplate({
      customerName: `${order.first_name} ${order.last_name}`,
      tourName: order.tour,
      tourDate: formattedDate,
      tourTime: order.tour_time,
      location: tour?.physical_address || ''
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
        subject: `We've Reserved Your Spot(s)`,
        custom_args: {
          order_id: order.order_id
        }
      }],
      from: {
        email: landingPage?.confirmation_email_from || 'info@vianovatours.com',
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
      return Response.json({ error: 'Failed to send email', details: errorText }, { status: 500 });
    }
    
    console.log('Reserved email sent successfully');

    // Log communication to order
    const communication = {
      timestamp: new Date().toISOString(),
      message: `Reserved email sent to ${order.email}`,
      sent_by: user.email,
      type: 'email_sent',
      subject: `We've Reserved Your Spot(s)`
    };
    
    const existingComms = order.customer_communication || [];
    await base44.entities.Order.update(order.id, {
      customer_communication: [...existingComms, communication]
    });

    return Response.json({ success: true, message: 'Reserved email sent successfully' });

  } catch (error) {
    console.error('Send reserved email error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildReservedEmailTemplate({ customerName, tourName, tourDate, tourTime, location }) {
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
    <!-- Header -->
    <tr>
      <td style="background-color: #4c51bf; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">We've Reserved Your Spot(s)</h1>
      </td>
    </tr>
    
    <!-- Main Content -->
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
        
        <!-- Tour Details Box -->
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
    
    <!-- Footer -->
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