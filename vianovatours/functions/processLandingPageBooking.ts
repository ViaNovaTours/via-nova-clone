import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const bookingData = await req.json();

        // Get existing orders to generate next order number
        const existingOrders = await base44.asServiceRole.entities.Order.list();
        const existingNumbers = existingOrders
            .map(o => {
                const match = o.order_id?.match(/Order (\d+)$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(n => n >= 1000);
        
        const nextOrderNumber = existingNumbers.length > 0 
            ? Math.max(...existingNumbers) + 1 
            : 1000;

        const orderId = `${bookingData.tour_name} | Online Tickets - Order ${nextOrderNumber}`;

        // Process Stripe payment
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(bookingData.total * 100), // Convert to cents
            currency: bookingData.currency.toLowerCase(),
            payment_method: bookingData.payment_method_id,
            confirm: true,
            description: orderId,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            }
        });

        if (paymentIntent.status !== 'succeeded') {
            return Response.json({
                success: false,
                error: 'Payment failed. Please try again.'
            }, { status: 400 });
        }

        // Create order in database
        const orderData = {
            order_id: orderId,
            tour: bookingData.tour_name,
            tour_date: bookingData.date,
            tour_time: bookingData.time,
            tickets: bookingData.tickets,
            extras: [],
            first_name: bookingData.customer.firstName,
            last_name: bookingData.customer.lastName,
            email: bookingData.customer.email,
            phone: bookingData.customer.phone || '',
            address: bookingData.customer.address || '',
            city: bookingData.customer.city || '',
            state_region: bookingData.customer.state_region || '',
            zip: bookingData.customer.zip || '',
            country: bookingData.customer.country || '',
            status: 'unprocessed',
            priority: 'normal',
            purchase_date: new Date().toISOString(),
            currency: bookingData.currency,
            total_cost: bookingData.total,
            payment_method: 'stripe',
            payment_status: paymentIntent.status,
            payment_captured: true,
            payment_transaction_id: paymentIntent.id,
            payment_customer_id: paymentIntent.customer,
            payment_fee: paymentIntent.charges?.data[0]?.balance_transaction?.fee || 0,
            payment_net_amount: paymentIntent.charges?.data[0]?.balance_transaction?.net || bookingData.total,
            purchase_url: `Landing Page - ${bookingData.tour_name}`
        };

        const createdOrder = await base44.asServiceRole.entities.Order.create(orderData);

        // Send confirmation emails and Slack notification asynchronously (don't wait)
        Promise.all([
            // Send Slack notification
            (async () => {
                try {
                    const slackToken = await base44.asServiceRole.connectors.getAccessToken('slack');
                    const ticketsList = bookingData.tickets.map(t => 
                        `• ${t.quantity}x ${t.type} - ${bookingData.currency} ${(t.price * t.quantity).toFixed(2)}`
                    ).join('\n');

                    const slackMessage = {
                        text: `🎫 New Order: ${bookingData.tour_name}`,
                        blocks: [
                            {
                                type: "header",
                                text: {
                                    type: "plain_text",
                                    text: `🎫 New Order: ${bookingData.tour_name}`
                                }
                            },
                            {
                                type: "section",
                                fields: [
                                    {
                                        type: "mrkdwn",
                                        text: `*Order Number:*\n${createdOrder.order_id}`
                                    },
                                    {
                                        type: "mrkdwn",
                                        text: `*Total:*\n${bookingData.currency} ${bookingData.total.toFixed(2)}`
                                    }
                                ]
                            },
                            {
                                type: "section",
                                fields: [
                                    {
                                        type: "mrkdwn",
                                        text: `*Customer:*\n${bookingData.customer.firstName} ${bookingData.customer.lastName}`
                                    },
                                    {
                                        type: "mrkdwn",
                                        text: `*Email:*\n${bookingData.customer.email}`
                                    }
                                ]
                            },
                            {
                                type: "section",
                                fields: [
                                    {
                                        type: "mrkdwn",
                                        text: `*Date:*\n${bookingData.date}`
                                    },
                                    {
                                        type: "mrkdwn",
                                        text: `*Time:*\n${bookingData.time}`
                                    }
                                ]
                            },
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: `*Tickets:*\n${ticketsList}`
                                }
                            },
                            {
                                type: "actions",
                                elements: [
                                    {
                                        type: "button",
                                        text: {
                                            type: "plain_text",
                                            text: "View Order"
                                        },
                                        url: `https://backend.vianovatours.com/OrderDetail?id=${createdOrder.id}`,
                                        style: "primary"
                                    }
                                ]
                            }
                        ]
                    };

                    await fetch('https://slack.com/api/chat.postMessage', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${slackToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            channel: '#new-tours',
                            ...slackMessage
                        })
                    });
                } catch (slackError) {
                    console.error('Failed to send Slack notification:', slackError);
                }
            })(),
            // Send customer confirmation email
            (async () => {
                try {
                    const ticketRows = bookingData.tickets.map(t => `
                <tr>
                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
                        <strong>${t.type}</strong>
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: center;">
                        ×${t.quantity}
                    </td>
                    <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                        ${bookingData.currency} ${(t.price * t.quantity).toFixed(2)}
                    </td>
                </tr>
            `).join('');

            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #059669; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">${bookingData.tour_name}</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Your order has been received!</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
            <h2 style="font-size: 24px; font-weight: bold; margin: 0 0 20px 0; color: #111827;">
                This is your receipt. Your final confirmation and tickets will be emailed to you shortly.
            </h2>

            <p style="font-size: 16px; color: #374151; margin: 0 0 15px 0;">Hi ${bookingData.customer.firstName},</p>
            
            <p style="font-size: 16px; color: #374151; margin: 0 0 30px 0;">
                Just to let you know — we've received your order, and it is now being processed.
            </p>

            <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0; font-weight: 600;">
                Here's a reminder of what you've ordered:
            </p>

            <!-- Order Summary -->
            <div style="margin: 30px 0;">
                <h3 style="font-size: 20px; font-weight: bold; margin: 0 0 15px 0; color: #111827;">Order summary</h3>
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">
                    Order #${createdOrder.order_id} (${bookingData.date})
                </p>

                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; background-color: #ffffff;">
                    <thead>
                        <tr style="background-color: #f9fafb;">
                            <th style="padding: 15px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Ticket Type</th>
                            <th style="padding: 15px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Quantity</th>
                            <th style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ticketRows}
                        <tr>
                            <td colspan="2" style="padding: 20px 15px; text-align: right; font-weight: bold; font-size: 18px; color: #111827;">
                                Total:
                            </td>
                            <td style="padding: 20px 15px; text-align: right; font-weight: bold; font-size: 18px; color: #059669;">
                                ${bookingData.currency} ${bookingData.total.toFixed(2)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Tour Details -->
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h4 style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #111827;">Tour Details</h4>
                <p style="margin: 0 0 8px 0; color: #374151;"><strong>Date:</strong> ${bookingData.date}</p>
                <p style="margin: 0; color: #374151;"><strong>Time:</strong> ${bookingData.time}</p>
            </div>

            <!-- Important Notice -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0;">
                <p style="margin: 0 0 15px 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                    <strong>All sales are final.</strong>
                </p>
                <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                    Orders placed outside normal business hours may have a delay in receiving their final confirmation. 
                    If you ordered the same day you should receive final confirmation and tickets within 15-30 minutes. 
                    You can always email us at <a href="mailto:info@vianovatours.com" style="color: #d97706; text-decoration: underline;">info@vianovatours.com</a> for any questions.
                </p>
            </div>

            <p style="font-size: 16px; color: #374151; margin: 30px 0 0 0;">
                Best regards,<br>
                <strong>${bookingData.tour_name} Team</strong>
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
                © ${new Date().getFullYear()} ${bookingData.tour_name}. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
            `;

            await base44.asServiceRole.functions.invoke('sendEmailViaSendGrid', {
                to: bookingData.customer.email,
                subject: `Your ${bookingData.tour_name} order has been received!`,
                html: htmlBody
            });

            // Send notification email to team
            const orderUrl = `https://backend.vianovatours.com/OrderDetail?id=${createdOrder.id}`;
            const notificationHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background-color: #dc2626; color: white; padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🎫 New Order Received!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">${bookingData.tour_name}</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 0 0 30px 0;">
                <p style="margin: 0; color: #991b1b; font-size: 16px; font-weight: bold;">
                    Action Required: Process this order
                </p>
            </div>

            <h3 style="font-size: 20px; font-weight: bold; margin: 0 0 20px 0; color: #111827;">Order Details</h3>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 0 0 25px 0;">
                <p style="margin: 0 0 10px 0; color: #374151;"><strong>Order ID:</strong> ${createdOrder.order_id}</p>
                <p style="margin: 0 0 10px 0; color: #374151;"><strong>Tour Date:</strong> ${bookingData.date}</p>
                <p style="margin: 0 0 10px 0; color: #374151;"><strong>Tour Time:</strong> ${bookingData.time}</p>
                <p style="margin: 0; color: #374151;"><strong>Total Amount:</strong> ${bookingData.currency} ${bookingData.total.toFixed(2)}</p>
            </div>

            <h3 style="font-size: 20px; font-weight: bold; margin: 0 0 20px 0; color: #111827;">Customer Information</h3>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 0 0 25px 0;">
                <p style="margin: 0 0 10px 0; color: #374151;"><strong>Name:</strong> ${bookingData.customer.firstName} ${bookingData.customer.lastName}</p>
                <p style="margin: 0 0 10px 0; color: #374151;"><strong>Email:</strong> <a href="mailto:${bookingData.customer.email}" style="color: #2563eb;">${bookingData.customer.email}</a></p>
                ${bookingData.customer.phone ? `<p style="margin: 0; color: #374151;"><strong>Phone:</strong> ${bookingData.customer.phone}</p>` : ''}
            </div>

            <h3 style="font-size: 20px; font-weight: bold; margin: 0 0 20px 0; color: #111827;">Tickets Ordered</h3>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; background-color: #ffffff; margin: 0 0 30px 0;">
                <thead>
                    <tr style="background-color: #f9fafb;">
                        <th style="padding: 12px 15px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Ticket Type</th>
                        <th style="padding: 12px 15px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Quantity</th>
                        <th style="padding: 12px 15px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">Price</th>
                    </tr>
                </thead>
                <tbody>
                    ${ticketRows}
                </tbody>
            </table>

            <!-- View Order Button -->
            <div style="text-align: center; margin: 40px 0 20px 0;">
                <a href="${orderUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    View Order Details →
                </a>
            </div>

            <p style="text-align: center; font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
                Or copy this link: <a href="${orderUrl}" style="color: #2563eb; word-break: break-all;">${orderUrl}</a>
            </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">
                Via Nova Tours Order Management System
            </p>
        </div>
    </div>
</body>
</html>
            `;

            await base44.asServiceRole.functions.invoke('sendEmailViaSendGrid', {
                to: 'info@vianovatours.com',
                subject: `🎫 New Order: ${bookingData.tour_name} - ${createdOrder.order_id}`,
                html: notificationHtml
            });
                } catch (emailError) {
                    console.error('Failed to send notification email:', emailError);
                }
            })()
        ]).catch(err => console.error('Email error:', err));

        return Response.json({
            success: true,
            order_id: createdOrder.order_id,
            message: 'Booking confirmed successfully'
        });

    } catch (error) {
        console.error('Booking error:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});