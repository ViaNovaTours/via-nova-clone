import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find all orders with reserved_date status
        const reservedOrders = await base44.entities.Order.filter({
            status: 'reserved_date'
        });

        const results = [];
        for (const order of reservedOrders) {
            await base44.entities.Order.update(order.id, { status: 'new' });
            results.push({
                order_id: order.order_id,
                customer: `${order.first_name} ${order.last_name}`,
                tour: order.tour,
                tour_date: order.tour_date,
                old_status: 'reserved_date',
                new_status: 'new'
            });
        }

        return Response.json({
            success: true,
            message: `Reset ${results.length} orders from reserved_date to new`,
            updated_orders: results
        });

    } catch (error) {
        console.error('Reset error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});