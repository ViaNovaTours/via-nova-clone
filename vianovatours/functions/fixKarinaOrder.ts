import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find Karina's order specifically
        const allOrders = await base44.entities.Order.list();
        const karinaOrder = allOrders.find(order => 
            order.email === 'spandetkammer@gmail.com'
        );

        if (!karinaOrder) {
            return Response.json({ 
                success: false, 
                error: 'Karina Spandet order not found' 
            });
        }

        // Update with correct data based on WooCommerce debug info
        const updates = {
            status: 'refunded',
            tour_date: '2025-09-17', // Correct date from WooCommerce
            tour_time: '9:00 am', // Clean time format
            tickets: [
                {
                    ticket_type_id: null,
                    type: 'Adult (18+) Day',
                    quantity: 2, // Correct quantity from WooCommerce "Adult (18+) Day x2"
                    cost_per_ticket: null
                }
            ]
        };

        await base44.entities.Order.update(karinaOrder.id, updates);

        return Response.json({
            success: true,
            message: 'Successfully fixed Karina\'s order',
            order_id: karinaOrder.order_id,
            old_data: {
                status: karinaOrder.status,
                tour_date: karinaOrder.tour_date,
                tickets: karinaOrder.tickets
            },
            new_data: updates
        });

    } catch (error) {
        console.error('Fix Karina order error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});