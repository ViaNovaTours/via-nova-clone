import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all existing orders to see what we have
        const existingOrders = await base44.entities.Order.list('-created_date');
        
        // Get recent orders created in the last 24 hours
        const last24Hours = new Date();
        last24Hours.setDate(last24Hours.getDate() - 1);
        
        const recentOrders = existingOrders.filter(order => {
            const createdDate = new Date(order.created_date);
            return createdDate > last24Hours;
        });

        // Check webhook status by attempting to ping each site
        const webhookStatus = {};
        const sites = [
            "AlcatrazTourism",
            "PelesCastle", 
            "BranCastle",
            "StatueofLiberty",
            "CorvinCastle",
            "HadriansVilla"
        ];

        for (const site of sites) {
            const webhookUrl = `https://vianovatours.base44.app/functions/wooCommerceWebhook?site=${site}`;
            try {
                const response = await fetch(webhookUrl, { method: 'GET' });
                webhookStatus[site] = {
                    status: response.status,
                    active: response.status === 200,
                    url: webhookUrl
                };
            } catch (error) {
                webhookStatus[site] = {
                    status: 'error',
                    active: false,
                    error: error.message,
                    url: webhookUrl
                };
            }
        }

        return Response.json({
            success: true,
            total_orders: existingOrders.length,
            orders_last_24h: recentOrders.length,
            recent_orders: recentOrders.slice(0, 5).map(o => ({
                id: o.order_id,
                tour: o.tour,
                customer: `${o.first_name} ${o.last_name}`,
                created: o.created_date,
                fulfilled_by: o.fulfilled_by
            })),
            webhook_status: webhookStatus,
            webhook_secret_configured: !!Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET")
        });

    } catch (error) {
        console.error('Test webhook status error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});