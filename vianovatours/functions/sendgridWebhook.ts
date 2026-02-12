import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Verify webhook signature
    const webhookSecret = Deno.env.get('EMAIL_WEBHOOK_SECRET');
    const signature = req.headers.get('X-Twilio-Email-Event-Webhook-Signature');
    const timestamp = req.headers.get('X-Twilio-Email-Event-Webhook-Timestamp');
    
    if (!webhookSecret || !signature || !timestamp) {
      console.warn('Missing webhook authentication headers');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const events = await req.json();
    
    console.log('Received SendGrid events:', events.length);

    // Process each event
    for (const event of events) {
      try {
        const { event: eventType, email, timestamp, sg_message_id, order_id } = event;
        
        console.log('Processing event:', { eventType, email, order_id, sg_message_id });
        
        // Try to find order by email and recent date
        let orders = [];
        if (order_id) {
          orders = await base44.asServiceRole.entities.Order.filter({ order_id });
        } else if (email) {
          // Find recent orders with this email
          const allOrders = await base44.asServiceRole.entities.Order.filter({ email });
          orders = allOrders
            .filter(o => o.customer_communication?.some(c => c.type === 'email_sent'))
            .slice(0, 5); // Only check last 5 orders
        }
        
        if (orders.length === 0) {
          console.log('No matching order found for email:', email);
          continue;
        }
        
        // Update each matching order
        for (const order of orders) {
          const eventMap = {
            'delivered': '✓ Email delivered',
            'open': '👁 Email opened',
            'click': '🖱 Link clicked',
            'bounce': '⚠️ Email bounced',
            'dropped': '⚠️ Email dropped',
            'spamreport': '⚠️ Marked as spam',
            'unsubscribe': '🚫 Unsubscribed'
          };
          
          const message = eventMap[eventType] || `Email event: ${eventType}`;
          
          const communication = {
            timestamp: new Date(timestamp * 1000).toISOString(),
            message,
            sent_by: 'system',
            type: `email_${eventType}`,
            sg_message_id
          };
          
          const existingComms = order.customer_communication || [];
          
          // Avoid duplicate events
          const isDuplicate = existingComms.some(
            c => c.type === communication.type && c.sg_message_id === sg_message_id
          );
          
          if (!isDuplicate) {
            await base44.asServiceRole.entities.Order.update(order.id, {
              customer_communication: [...existingComms, communication]
            });
            console.log('Logged event to order:', order.order_id);
          }
        }
      } catch (err) {
        console.error('Error processing event:', err);
      }
    }

    return Response.json({ success: true, processed: events.length });

  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});