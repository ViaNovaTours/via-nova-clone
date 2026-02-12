import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find Charles Vineyard's duplicate orders
        const allOrders = await base44.entities.Order.list();
        const charlesOrders = allOrders.filter(order => 
            order.order_id === 'PelesCastle-3227' && 
            order.email === 'vincr01@yahoo.com'
        );

        if (charlesOrders.length !== 2) {
            return Response.json({ 
                success: false, 
                error: `Expected 2 orders for PelesCastle-3227, found ${charlesOrders.length}`,
                orders: charlesOrders
            });
        }

        // Keep the first order, merge tickets, delete the second
        const orderToKeep = charlesOrders[0];
        const orderToDelete = charlesOrders[1];

        // Calculate total tickets (should be 2 Senior tickets)
        const totalSeniorTickets = charlesOrders.reduce((sum, order) => {
            const seniorTicket = order.tickets?.find(t => t.type.includes('Senior'));
            return sum + (seniorTicket?.quantity || 0);
        }, 0);

        // Update the first order with correct ticket quantity
        await base44.entities.Order.update(orderToKeep.id, {
            tickets: [
                {
                    ticket_type_id: null,
                    type: "Senior (65+) Day",
                    quantity: totalSeniorTickets,
                    cost_per_ticket: null
                }
            ]
        });

        // Delete the duplicate order
        await base44.entities.Order.delete(orderToDelete.id);

        return Response.json({
            success: true,
            message: `Successfully merged Charles Vineyard orders`,
            kept_order_id: orderToKeep.id,
            deleted_order_id: orderToDelete.id,
            total_senior_tickets: totalSeniorTickets,
            final_order: {
                order_id: orderToKeep.order_id,
                tickets: [{ type: "Senior (65+) Day", quantity: totalSeniorTickets }]
            }
        });

    } catch (error) {
        console.error('Fix Charles order error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});