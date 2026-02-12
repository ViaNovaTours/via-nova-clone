import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find Lianne's order in our database
        const allOrders = await base44.entities.Order.list();
        const liannesOrder = allOrders.find(order => 
            order.first_name === 'Lianne' && order.last_name === 'Everett' ||
            order.email === 'lianneeverett@hotmail.com' ||
            order.order_id === 'BranCastle-2212'
        );

        if (!liannesOrder) {
            return Response.json({ 
                success: false, 
                error: 'Could not find Lianne Everett\'s order in database',
                searched_criteria: ['Lianne Everett', 'lianneeverett@hotmail.com', 'BranCastle-2212']
            });
        }

        // Force the correct ticket data
        const correctTickets = [
            { type: 'Adult (18+) Day', quantity: 3 },
            { type: 'Torture Chambers', quantity: 3 },
            { type: 'Time Tunnel', quantity: 3 }
        ];

        // Update the order with correct data
        await base44.entities.Order.update(liannesOrder.id, {
            tickets: correctTickets,
            extras: [] // Clear extras since everything should be tickets
        });

        return Response.json({
            success: true,
            message: 'Lianne\'s order has been forcefully corrected',
            order_id: liannesOrder.id,
            order_identifier: liannesOrder.order_id,
            old_tickets: liannesOrder.tickets,
            old_extras: liannesOrder.extras,
            new_tickets: correctTickets,
            new_extras: []
        });

    } catch (error) {
        console.error('Emergency fix error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});