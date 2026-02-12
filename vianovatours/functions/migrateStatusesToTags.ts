import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        console.log('=== MIGRATION START ===');
        
        // Check authentication
        const user = await base44.auth.me();
        console.log('User authenticated:', user?.email);
        if (!user) {
            return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        console.log('Starting migration, fetching orders...');
        const allOrders = await base44.asServiceRole.entities.Order.list();
        console.log(`Found ${allOrders.length} total orders`);
        
        let updatedCount = 0;
        const details = [];
        const errors = [];
        
        // Process in smaller batches to avoid timeouts
        const batchSize = 50;
        for (let i = 0; i < allOrders.length; i += batchSize) {
            const batch = allOrders.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allOrders.length/batchSize)}`);
            
            for (const order of batch) {
                try {
                    const updates = {};
                    let needsUpdate = false;
                    
                    // Initialize tags array if undefined
                    const currentTags = Array.isArray(order.tags) ? order.tags : [];
                    
                    if (order.status === 'reserved_date') {
                        updates.status = 'unprocessed';
                        updates.tags = currentTags.includes('reserved_date') ? currentTags : [...currentTags, 'reserved_date'];
                        needsUpdate = true;
                        details.push(`${order.order_id || order.id}: reserved_date → unprocessed + tag`);
                    } else if (order.status === 'awaiting_reply') {
                        updates.status = 'unprocessed';
                        updates.tags = currentTags.includes('awaiting_reply') ? currentTags : [...currentTags, 'awaiting_reply'];
                        needsUpdate = true;
                        details.push(`${order.order_id || order.id}: awaiting_reply → unprocessed + tag`);
                    } else if (order.status === 'new') {
                        updates.status = 'unprocessed';
                        updates.tags = currentTags;
                        needsUpdate = true;
                        details.push(`${order.order_id || order.id}: new → unprocessed`);
                    }
                    
                    if (needsUpdate) {
                        console.log(`Updating order ${order.id}: ${order.order_id}`);
                        await base44.asServiceRole.entities.Order.update(order.id, updates);
                        updatedCount++;
                    }
                } catch (err) {
                    const errorMsg = `${order.order_id || order.id}: ${err.message}`;
                    console.error('Order update error:', errorMsg);
                    errors.push(errorMsg);
                }
            }
        }
        
        console.log(`Migration complete. Updated ${updatedCount} orders.`);
        
        return Response.json({
            success: true,
            total_orders: allOrders.length,
            updated_count: updatedCount,
            details: details,
            errors: errors,
            message: `Migrated ${updatedCount} of ${allOrders.length} orders${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
        });
        
    } catch (error) {
        console.error('=== MIGRATION ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error:', JSON.stringify(error, null, 2));
        return Response.json({
            success: false,
            error: error.message,
            stack: error.stack,
            full_error: String(error)
        }, { status: 500 });
    }
});