import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// This function is designed to be called by a service like Zapier or Make.com
// which can parse an incoming email and POST it as JSON.

Deno.serve(async (req) => {
    // 1. Authenticate the request
    const authHeader = req.headers.get('Authorization');
    const secretKey = Deno.env.get('EMAIL_WEBHOOK_SECRET');

    if (!secretKey) {
        return new Response("Server error: Webhook secret is not configured.", { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
        return new Response("Unauthorized.", { status: 401 });
    }

    if (req.method !== 'POST') {
        return new Response("This endpoint only accepts POST requests.", { status: 405 });
    }

    try {
        const { from, subject, body } = await req.json();
        
        if (!from || !subject || !body) {
            return new Response("Missing required fields: from, subject, body.", { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // 2. Find the relevant order
        // Look for an order ID in the subject line like [Order: CorvinCastle-1892] or #1892
        const orderIdMatch = subject.match(/(?:Order:?\s*|#)([a-zA-Z0-9-]+)/i);
        let targetOrder = null;

        if (orderIdMatch && orderIdMatch[1]) {
            const potentialOrderId = orderIdMatch[1];
            const orders = await base44.asServiceRole.entities.Order.filter({ order_id: { $regex: potentialOrderId, $options: 'i' } });
            if (orders.length > 0) {
                targetOrder = orders[0];
            }
        }
        
        // If we didn't find an order by subject, try to find it by the sender's email address
        if (!targetOrder) {
            const ordersByEmail = await base44.asServiceRole.entities.Order.filter({ email: from.toLowerCase() });
            if (ordersByEmail.length > 0) {
                // If there are multiple orders, pick the most recently created one
                targetOrder = ordersByEmail.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
            }
        }

        if (!targetOrder) {
            return new Response(`Could not find a matching order for email from ${from}.`, { status: 404 });
        }

        // 3. Append the communication to the order
        const newCommunication = {
            timestamp: new Date().toISOString(),
            message: body,
            sent_by: from // This is the customer's email
        };

        const existingCommunications = targetOrder.customer_communication || [];
        const updatedCommunications = [...existingCommunications, newCommunication];

        await base44.asServiceRole.entities.Order.update(targetOrder.id, {
            customer_communication: updatedCommunications
        });

        return new Response(`Successfully logged communication for order ${targetOrder.order_id}.`, { status: 200 });

    } catch (error) {
        console.error("Error processing email webhook:", error);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
});