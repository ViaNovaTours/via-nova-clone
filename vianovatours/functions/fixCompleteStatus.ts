import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user || user.role !== 'admin') {
            return Response.json({ 
                success: false,
                error: 'Unauthorized - admin only' 
            }, { status: 401 });
        }

        console.log('Fixing "complete" status to "completed"...');
        
        // Find all orders with "complete" status
        const ordersToFix = await base44.asServiceRole.entities.Order.filter({ 
            status: 'complete' 
        });

        console.log(`Found ${ordersToFix.length} orders with "complete" status`);
        
        let updated = 0;
        const errors = [];

        for (const order of ordersToFix) {
            try {
                await base44.asServiceRole.entities.Order.update(order.id, {
                    status: 'completed'
                });
                updated++;
                
                if (updated % 10 === 0) {
                    console.log(`Progress: ${updated}/${ordersToFix.length} orders fixed`);
                }
            } catch (error) {
                errors.push(`Failed to update order ${order.order_id || order.id}: ${error.message}`);
            }
        }

        return Response.json({
            success: true,
            total_fixed: updated,
            errors: errors.length > 0 ? errors : null,
            message: `Successfully changed ${updated} orders from "complete" to "completed"`
        });

    } catch (error) {
        console.error('Fix status error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});