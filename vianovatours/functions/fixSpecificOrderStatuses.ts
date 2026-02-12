
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const fixes = [];
        const allOrders = await base44.entities.Order.list();
        
        // Fix Harrison Gardiner - should be reserved_date
        const harrisonOrder = allOrders.find(order => 
            order.order_id === 'PelesCastle-3101' || 
            (order.first_name === 'Harrison' && order.last_name === 'Gardiner')
        );
        
        if (harrisonOrder && harrisonOrder.tour_date) {
            const tourDate = new Date(harrisonOrder.tour_date);
            const now = new Date();
            const daysUntil = Math.ceil((tourDate - now) / (1000 * 60 * 60 * 24));
            
            if (daysUntil > 15 && harrisonOrder.status !== 'reserved_date') {
                await base44.entities.Order.update(harrisonOrder.id, { status: 'reserved_date' });
                fixes.push({
                    name: 'Harrison Gardiner',
                    order_id: harrisonOrder.order_id,
                    old_status: harrisonOrder.status,
                    new_status: 'reserved_date',
                    reason: `Tour date ${daysUntil} days away (>15 day buffer)`
                });
            }
        }

        // Fix Karina Spandet - should be refunded AND fix ticket count
        const karinaOrder = allOrders.find(order => 
            order.email === 'spandetkammer@gmail.com' ||
            (order.first_name && order.first_name.includes('Karina'))
        );
        
        if (karinaOrder) {
            const updates = {};
            let needsUpdate = false;
            
            // Check status
            if (karinaOrder.status !== 'refunded') {
                updates.status = 'refunded';
                needsUpdate = true;
                fixes.push({
                    name: 'Karina Spandet',
                    order_id: karinaOrder.order_id,
                    old_status: karinaOrder.status,
                    new_status: 'refunded',
                    reason: 'Order was refunded in WooCommerce'
                });
            }

            // Check ticket count
            const adultTicket = karinaOrder.tickets.find(t => t.type.includes('Adult'));
            if (adultTicket && adultTicket.quantity !== 2) {
                // The outline implies overwriting the entire tickets array with just one specific ticket.
                // Assuming this is the desired behavior.
                updates.tickets = [{ type: 'Adult (18+) Day', quantity: 2 }];
                needsUpdate = true;
                fixes.push({
                    name: 'Karina Spandet',
                    order_id: karinaOrder.order_id,
                    old_status: 'N/A', // Old status not relevant for ticket quantity change fix entry.
                    new_status: 'N/A', // New status not relevant for ticket quantity change fix entry.
                    reason: `Corrected ticket quantity from ${adultTicket.quantity} to 2`
                });
            }

            if (needsUpdate) {
                await base44.entities.Order.update(karinaOrder.id, updates);
            }
        }

        // Fix Shania Gaddu - should be refunded
        const shaniaOrder = allOrders.find(order => 
            order.email === 'shaniagaddu@hotmail.co.uk' ||
            (order.first_name && order.first_name.includes('Shania') && order.last_name && order.last_name.includes('Gaddu'))
        );
        
        if (shaniaOrder && shaniaOrder.status !== 'refunded') {
            await base44.entities.Order.update(shaniaOrder.id, { status: 'refunded' });
            fixes.push({
                name: 'Shania Gaddu',
                order_id: shaniaOrder.order_id,
                old_status: shaniaOrder.status,
                new_status: 'refunded',
                reason: 'Order was refunded in WooCommerce'
            });
        }

        // Also fix any other orders that should be reserved_date but aren't
        let additionalFixes = 0;
        for (const order of allOrders) {
            if (!order.tour_date || order.status === 'reserved_date') continue;
            if (['complete', 'refunded', 'failed', 'chargeback'].includes(order.status)) continue;
            
            const tourDate = new Date(order.tour_date);
            const now = new Date();
            const daysUntil = Math.ceil((tourDate - now) / (1000 * 60 * 60 * 24));
            
            const isAlcatraz = order.tour === 'Alcatraz Island Tour';
            const bufferDays = isAlcatraz ? 90 : 15;
            
            if (daysUntil > bufferDays && order.status !== 'reserved_date') {
                await base44.entities.Order.update(order.id, { status: 'reserved_date' });
                additionalFixes++;
            }
        }

        return Response.json({
            success: true,
            specific_fixes: fixes,
            additional_reserved_fixes: additionalFixes,
            total_fixes: fixes.length + additionalFixes
        });
        
    } catch (error) {
        console.error('Fix error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});
