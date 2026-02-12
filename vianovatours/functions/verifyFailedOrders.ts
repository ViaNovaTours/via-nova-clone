import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all failed orders
        const failedOrders = await base44.asServiceRole.entities.Order.filter({ status: 'failed' });
        
        // Fetch WooCommerce credentials
        const credentials = await base44.asServiceRole.entities.WooCommerceCredentials.list();
        
        const results = {
            checked: 0,
            updated: 0,
            errors: [],
            updates: []
        };

        for (const order of failedOrders) {
            results.checked++;
            
            if (!order.order_id || !order.order_id.includes('-')) {
                continue;
            }

            const [siteName, wooOrderId] = order.order_id.split('-');
            const cred = credentials.find(c => c.site_name === siteName);

            if (!cred) {
                results.errors.push(`No credentials for site: ${siteName}`);
                continue;
            }

            try {
                // Fetch order from WooCommerce
                const wooUrl = `${cred.api_url}/orders/${wooOrderId}`;
                const auth = btoa(`${cred.consumer_key}:${cred.consumer_secret}`);
                
                const response = await fetch(wooUrl, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    results.errors.push(`Failed to fetch ${order.order_id}: ${response.status}`);
                    continue;
                }

                const wooOrder = await response.json();
                
                // Check if WooCommerce shows it as completed
                if (wooOrder.status === 'completed') {
                    await base44.asServiceRole.entities.Order.update(order.id, {
                        status: 'completed'
                    });
                    
                    results.updated++;
                    results.updates.push({
                        order_id: order.order_id,
                        customer: `${order.first_name} ${order.last_name}`,
                        tour: order.tour,
                        woo_status: wooOrder.status
                    });
                }
            } catch (error) {
                results.errors.push(`Error checking ${order.order_id}: ${error.message}`);
            }
        }

        return Response.json({
            success: true,
            ...results
        });
    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});