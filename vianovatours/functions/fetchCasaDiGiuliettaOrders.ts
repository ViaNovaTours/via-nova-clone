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

        console.log('Fetching Casa di Giulietta credentials and orders...');
        
        // Get credentials
        const credentials = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
            site_name: 'CasaDiGiulietta' 
        });

        if (credentials.length === 0) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta credentials not found in database'
            }, { status: 404 });
        }

        const site = credentials[0];
        console.log('Found credentials:', {
            site_name: site.site_name,
            tour_name: site.tour_name,
            api_url: site.api_url,
            website_url: site.website_url,
            is_active: site.is_active
        });

        // Try to fetch orders from WooCommerce
        const auth = btoa(`${site.consumer_key}:${site.consumer_secret}`);
        const wooUrl = `${site.api_url}/orders?per_page=100&orderby=id&order=desc`;
        
        console.log('Fetching from WooCommerce:', wooUrl);

        const response = await fetch(wooUrl, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('WooCommerce Response Status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({
                success: false,
                error: `WooCommerce API Error (${response.status}): ${response.statusText}`,
                details: errorText,
                url: wooUrl,
                credentials_found: true
            }, { status: response.status });
        }

        const wooOrders = await response.json();
        console.log(`Found ${wooOrders.length} orders on WooCommerce`);

        // Check existing orders in database
        const existingOrders = await base44.asServiceRole.entities.Order.filter({
            order_id: { $regex: '^CasaDiGiulietta-' }
        });
        console.log(`Found ${existingOrders.length} existing orders in database`);

        return Response.json({
            success: true,
            credentials_found: true,
            woocommerce_orders_count: wooOrders.length,
            database_orders_count: existingOrders.length,
            sample_woo_orders: wooOrders.slice(0, 3).map(o => ({
                id: o.id,
                status: o.status,
                date: o.date_created,
                total: o.total,
                customer: `${o.billing?.first_name} ${o.billing?.last_name}`
            })),
            message: wooOrders.length === 0 
                ? 'No orders found on WooCommerce site yet'
                : `Found ${wooOrders.length} orders on WooCommerce but only ${existingOrders.length} in database`
        });

    } catch (error) {
        console.error('Casa di Giulietta fetch error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        }, { status: 500 });
    }
});