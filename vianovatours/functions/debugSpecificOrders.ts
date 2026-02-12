import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find the specific problematic orders
        const allOrders = await base44.entities.Order.list();
        
        const harrisonOrder = allOrders.find(order => 
            order.order_id === 'PelesCastle-3101' || 
            (order.first_name === 'Harrison' && order.last_name === 'Gardiner')
        );
        
        const karinaOrder = allOrders.find(order => 
            order.email === 'spandetkammer@gmail.com' ||
            (order.first_name && order.first_name.includes('Karina'))
        );

        const results = {
            success: true,
            current_date: new Date().toISOString(),
            harrison_analysis: null,
            karina_analysis: null
        };

        // Analyze Harrison's order
        if (harrisonOrder) {
            const tourDate = new Date(harrisonOrder.tour_date);
            const now = new Date();
            const daysUntil = Math.ceil((tourDate - now) / (1000 * 60 * 60 * 24));
            
            const shouldBeReserved = daysUntil > 15; // Peles Castle buffer is 15 days
            
            results.harrison_analysis = {
                found: true,
                order_id: harrisonOrder.order_id,
                current_status: harrisonOrder.status,
                tour_date: harrisonOrder.tour_date,
                days_until_tour: daysUntil,
                should_be_reserved: shouldBeReserved,
                expected_status: shouldBeReserved ? 'reserved_date' : 'new',
                tour_type: harrisonOrder.tour,
                created_date: harrisonOrder.created_date,
                purchase_date: harrisonOrder.purchase_date
            };
        } else {
            results.harrison_analysis = { found: false };
        }

        // Analyze Karina's order  
        if (karinaOrder) {
            results.karina_analysis = {
                found: true,
                order_id: karinaOrder.order_id,
                current_status: karinaOrder.status,
                expected_status: 'refunded',
                tour_date: karinaOrder.tour_date,
                email: karinaOrder.email,
                tour_type: karinaOrder.tour,
                created_date: karinaOrder.created_date,
                purchase_date: karinaOrder.purchase_date
            };
        } else {
            results.karina_analysis = { found: false };
        }

        return Response.json(results);
        
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});