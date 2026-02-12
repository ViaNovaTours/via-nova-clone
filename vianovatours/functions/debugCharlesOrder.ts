import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find all Charles Vineyard orders
        const allOrders = await base44.entities.Order.list();
        const charlesOrders = allOrders.filter(order => 
            (order.first_name && order.first_name.toLowerCase().includes('charles')) ||
            (order.last_name && order.last_name.toLowerCase().includes('vineyard')) ||
            (order.email && order.email.toLowerCase().includes('vineyard')) ||
            (order.email && order.email.toLowerCase().includes('charles'))
        );

        const results = {
            success: true,
            total_charles_orders: charlesOrders.length,
            orders_found: charlesOrders.map(order => ({
                id: order.id,
                order_id: order.order_id,
                first_name: order.first_name,
                last_name: order.last_name,
                email: order.email,
                tour: order.tour,
                tour_date: order.tour_date,
                tickets: order.tickets,
                extras: order.extras,
                purchase_date: order.purchase_date,
                created_date: order.created_date
            })),
            potential_duplicates: []
        };

        // Check for potential duplicates (same email, tour, date)
        const duplicateGroups = {};
        for (const order of charlesOrders) {
            const key = `${order.email}-${order.tour}-${order.tour_date}`;
            if (!duplicateGroups[key]) {
                duplicateGroups[key] = [];
            }
            duplicateGroups[key].push(order);
        }

        for (const [key, orders] of Object.entries(duplicateGroups)) {
            if (orders.length > 1) {
                results.potential_duplicates.push({
                    key: key,
                    count: orders.length,
                    orders: orders.map(o => ({
                        id: o.id,
                        order_id: o.order_id,
                        tickets: o.tickets,
                        created_date: o.created_date
                    }))
                });
            }
        }

        return Response.json(results);
        
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});