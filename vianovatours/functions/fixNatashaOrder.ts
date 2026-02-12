import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find and fix Natasha's order
        const allOrders = await base44.entities.Order.list();
        const natashaOrder = allOrders.find(order => 
            order.email === 'natashachilton06@icloud.com'
        );

        if (!natashaOrder) {
            return Response.json({ 
                success: false, 
                error: 'Order not found' 
            });
        }

        // Update to completed
        await base44.entities.Order.update(natashaOrder.id, {
            status: 'completed'
        });

        return Response.json({
            success: true,
            message: 'Fixed Natasha Chilton order status',
            order_id: natashaOrder.order_id,
            old_status: natashaOrder.status,
            new_status: 'completed',
            customer: `${natashaOrder.first_name} ${natashaOrder.last_name}`
        });

    } catch (error) {
        console.error('Fix error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});