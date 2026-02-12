import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fix the two specific Bran Castle orders
        const ordersToFix = await base44.entities.Order.filter({ 
            order_id: ['BranCastle-2381', 'BranCastle-2379']
        });

        const results = [];
        for (const order of ordersToFix) {
            await base44.entities.Order.update(order.id, { status: 'failed' });
            results.push({
                order_id: order.order_id,
                old_status: order.status,
                new_status: 'failed',
                customer: `${order.first_name} ${order.last_name}`
            });
        }

        return Response.json({
            success: true,
            message: 'Fixed cancelled Bran Castle orders',
            fixed_orders: results
        });

    } catch (error) {
        console.error('Fix error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});