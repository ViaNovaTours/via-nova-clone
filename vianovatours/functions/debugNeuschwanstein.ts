import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    
    try {
        // Get Neuschwanstein credentials
        const credentials = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
            site_name: 'NeuschwansteinCastle' 
        });
        
        if (credentials.length === 0) {
            return Response.json({ error: 'No credentials found for NeuschwansteinCastle' });
        }
        
        const cred = credentials[0];
        const auth = btoa(`${cred.consumer_key}:${cred.consumer_secret}`);
        
        // Fetch recent orders from WooCommerce
        const response = await fetch(`${cred.api_url}/orders?per_page=10&orderby=id&order=desc`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        
        if (!response.ok) {
            return Response.json({ 
                error: `WooCommerce API error: ${response.status} ${response.statusText}`,
                url: `${cred.api_url}/orders`
            });
        }
        
        const wooOrders = await response.json();
        
        // Get existing orders from database
        const dbOrders = await base44.asServiceRole.entities.Order.filter({ 
            tour: 'Neuschwanstein Castle' 
        });
        
        const dbOrderIds = new Set(dbOrders.map(o => o.order_id));
        const highestDbId = Math.max(0, ...dbOrders.map(o => {
            const parts = (o.order_id || '').split('-');
            return parseInt(parts[1] || '0');
        }));
        
        // Compare
        const wooOrdersList = wooOrders.map(wo => ({
            id: wo.id,
            status: wo.status,
            date_created: wo.date_created,
            customer: `${wo.billing?.first_name} ${wo.billing?.last_name}`,
            total: wo.total,
            in_database: dbOrderIds.has(`NeuschwansteinCastle-${wo.id}`)
        }));
        
        const missingInDb = wooOrdersList.filter(wo => !wo.in_database);
        
        return Response.json({
            highest_id_in_db: highestDbId,
            total_db_orders: dbOrders.length,
            woocommerce_orders: wooOrdersList,
            missing_in_database: missingInDb,
            missing_count: missingInDb.length
        });
        
    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});