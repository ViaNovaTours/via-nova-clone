
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const WOOCOMMERCE_SITES = [
    { name: "AlcatrazTourism", tour_type: "Alcatraz Island Tour", api_url: "https://alcatraztourism.com/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_ALCATRAZ_TOURISM", secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM" },
    { name: "PelesCastle", tour_type: "Peles Castle Tour", api_url: "https://pelescastle.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_PELES_CASTLE", secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE" },
    { name: "BranCastle", tour_type: "Bran Castle Tour", api_url: "https://brancastletickets.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_BRAN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE" },
    { name: "StatueofLiberty", tour_type: "Statue of Liberty Tour", api_url: "https://statueoflibertytickets.org/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_STATUE_LIBERTY", secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY" },
    { name: "CorvinCastle", tour_type: "Corvin Castle Tour", api_url: "https://corvincastle.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE" },
    { name: "HadriansVilla", tour_type: "Hadrian's Villa Tour", api_url: "https://hadriansvillatickets.com/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_HADRIANS_VILLA", secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA" },
    { name: "PenaPalace", tour_type: "Pena Palace Tour", api_url: "https://penapalace.pt/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_PENA_PALACE", secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE" },
    { name: "VillaEste", tour_type: "Villa d'Este Tour", api_url: "https://villa-d-este.it/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_VILLA_ESTE", secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE" },
    { name: "CasaDiGiulietta", tour_type: "Casa di Giulietta Tour", api_url: "https://casadigiulietta.it/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_CASA_DI_GIULIETTA", secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA" }
];

const mapOrderStatus = (wooStatus) => {
    switch (wooStatus) {
        case 'completed': return 'complete';
        case 'refunded': return 'refunded';
        case 'failed': return 'failed';
        case 'on-hold': return 'on-hold';
        case 'processing': return 'new';
        case 'pending': return 'new';
        default: return 'new';
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the order IDs to check from the request body
        const { order_ids } = await req.json().catch(() => ({}));
        
        // If no specific orders provided, check all orders with past tour dates that are still "new" or "processing"
        const allOrders = await base44.entities.Order.list();
        const ordersToCheck = order_ids ? 
            allOrders.filter(order => order_ids.includes(order.order_id)) :
            allOrders.filter(order => {
                // Check orders that are still "new" but have past tour dates
                if (order.status !== 'new') return false;
                if (!order.tour_date) return false;
                
                const tourDate = new Date(order.tour_date);
                const now = new Date();
                now.setHours(23, 59, 59, 999); // End of today
                
                return tourDate < now; // Tour date has passed
            });

        const results = [];
        let updatedCount = 0;

        for (const order of ordersToCheck) {
            if (!order.order_id || !order.order_id.includes('-')) continue;

            const [siteName, wooOrderId] = order.order_id.split('-');
            const site = WOOCOMMERCE_SITES.find(s => s.name === siteName);
            
            if (!site) {
                results.push({
                    order_id: order.order_id,
                    error: 'Site configuration not found'
                });
                continue;
            }

            const consumerKey = Deno.env.get(site.key_env);
            const consumerSecret = Deno.env.get(site.secret_env);

            if (!consumerKey || !consumerSecret) {
                results.push({
                    order_id: order.order_id,
                    error: 'Missing API credentials'
                });
                continue;
            }

            try {
                const auth = btoa(`${consumerKey}:${consumerSecret}`);
                
                // Fetch this specific order from WooCommerce
                const response = await fetch(`${site.api_url}/orders/${wooOrderId}`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });

                if (!response.ok) {
                    results.push({
                        order_id: order.order_id,
                        error: `WooCommerce API error: ${response.status}`
                    });
                    continue;
                }

                const wooOrder = await response.json();
                const currentWooStatus = mapOrderStatus(wooOrder.status);
                
                results.push({
                    order_id: order.order_id,
                    customer: `${order.first_name} ${order.last_name}`,
                    tour_date: order.tour_date,
                    current_status_in_our_system: order.status,
                    woocommerce_status: wooOrder.status,
                    mapped_status: currentWooStatus,
                    needs_update: order.status !== currentWooStatus
                });

                // Update if status has changed
                if (order.status !== currentWooStatus) {
                    await base44.entities.Order.update(order.id, {
                        status: currentWooStatus
                    });
                    updatedCount++;
                }

            } catch (error) {
                results.push({
                    order_id: order.order_id,
                    error: error.message
                });
            }
        }

        return Response.json({
            success: true,
            orders_checked: results.length,
            orders_updated: updatedCount,
            results: results
        });

    } catch (error) {
        console.error('Update specific order status error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});
