import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Corvin Castle site configuration
        const site = {
            name: "Corvin Castle",
            api_url: "https://corvincastle.ro/wp-json/wc/v3",
            key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE",
            secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE"
        };

        const consumerKey = Deno.env.get(site.key_env);
        const consumerSecret = Deno.env.get(site.secret_env);

        const debugResults = {
            site: site.name,
            credentials_found: !!consumerKey && !!consumerSecret,
            api_url: site.api_url,
            consumer_key_preview: consumerKey ? `${consumerKey.substring(0, 10)}...` : 'Not found',
            existing_corvin_orders: [],
            specific_order_1892: null,
            recent_orders: [],
            api_connection_test: null,
            errors: []
        };

        // Check existing Corvin Castle orders in our database
        const allOrders = await base44.entities.Order.list();
        const corvinOrders = allOrders.filter(order => order.tour === 'Corvin Castle Tour');
        debugResults.existing_corvin_orders = corvinOrders.map(o => ({
            order_id: o.order_id,
            customer: `${o.first_name} ${o.last_name}`,
            email: o.email,
            status: o.status,
            created_date: o.created_date
        }));

        if (!consumerKey || !consumerSecret) {
            debugResults.errors.push('Missing API credentials for Corvin Castle');
            return Response.json(debugResults);
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);

        // Test API connection
        try {
            const testResponse = await fetch(`${site.api_url}/orders?per_page=1`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            debugResults.api_connection_test = {
                status: testResponse.status,
                success: testResponse.ok,
                status_text: testResponse.statusText
            };

            if (testResponse.ok) {
                // Look for order #1892 specifically
                const order1892Response = await fetch(`${site.api_url}/orders/1892`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });

                if (order1892Response.ok) {
                    const order1892 = await order1892Response.json();
                    debugResults.specific_order_1892 = {
                        found: true,
                        id: order1892.id,
                        number: order1892.number,
                        status: order1892.status,
                        customer: `${order1892.billing?.first_name || ''} ${order1892.billing?.last_name || ''}`,
                        email: order1892.billing?.email,
                        date_created: order1892.date_created,
                        total: order1892.total,
                        line_items: order1892.line_items?.map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            total: item.total
                        }))
                    };
                } else {
                    debugResults.specific_order_1892 = {
                        found: false,
                        error: `HTTP ${order1892Response.status}: ${order1892Response.statusText}`
                    };
                }

                // Get recent orders (last 10)
                const recentResponse = await fetch(`${site.api_url}/orders?per_page=10&orderby=date&order=desc`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });

                if (recentResponse.ok) {
                    const recentOrders = await recentResponse.json();
                    debugResults.recent_orders = recentOrders.map(order => ({
                        id: order.id,
                        number: order.number,
                        status: order.status,
                        customer: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`,
                        email: order.billing?.email,
                        date_created: order.date_created,
                        total: order.total
                    }));
                }
            } else {
                const errorText = await testResponse.text();
                debugResults.errors.push(`API connection failed: ${errorText.substring(0, 200)}`);
            }

        } catch (error) {
            debugResults.errors.push(`API connection error: ${error.message}`);
        }

        return Response.json(debugResults);

    } catch (error) {
        return Response.json({ 
            error: error.message, 
            stack: error.stack.split('\n').slice(0, 5).join('\n') 
        }, { status: 500 });
    }
});