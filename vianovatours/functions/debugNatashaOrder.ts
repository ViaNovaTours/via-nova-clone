import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const WOOCOMMERCE_SITES = [
    { name: "AlcatrazTourism", api_url: "https://alcatraztourism.com/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_ALCATRAZ_TOURISM", secret_env: "WOOCOMMERCE_SECRET_ALCATRAZ_TOURISM" },
    { name: "PelesCastle", api_url: "https://pelescastle.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_PELES_CASTLE", secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE" },
    { name: "BranCastle", api_url: "https://brancastletickets.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_BRAN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE" },
    { name: "StatueofLiberty", api_url: "https://statueoflibertytickets.org/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_STATUE_LIBERTY", secret_env: "WOOCOMMERCE_SECRET_STATUE_LIBERTY" },
    { name: "CorvinCastle", api_url: "https://corvincastle.ro/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE", secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE" },
    { name: "HadriansVilla", api_url: "https://hadrians-villa.it/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_HADRIANS_VILLA", secret_env: "WOOCOMMERCE_SECRET_HADRIANS_VILLA" },
    { name: "PenaPalace", api_url: "https://penapalace.pt/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_PENA_PALACE", secret_env: "WOOCOMMERCE_SECRET_PENA_PALACE" },
    { name: "VillaEste", api_url: "https://villa-d-este.it/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_VILLA_ESTE", secret_env: "WOOCOMMERCE_SECRET_VILLA_ESTE" },
    { name: "CasaDiGiulietta", api_url: "https://casadigiulietta.it/wp-json/wc/v3", key_env: "WOOCOMMERCE_KEY_CASA_DI_GIULIETTA", secret_env: "WOOCOMMERCE_SECRET_CASA_DI_GIULIETTA" }
];

const mapOrderStatus = (wooStatus) => {
    if (wooStatus === 'processing') {
        return 'new';
    }
    return wooStatus;
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Find Natasha's order in database
        const allOrders = await base44.entities.Order.list();
        const natashaOrder = allOrders.find(order => 
            order.email === 'natashachilton06@icloud.com' ||
            (order.first_name === 'Natasha' && order.last_name === 'Chilton')
        );

        if (!natashaOrder) {
            return Response.json({ 
                success: false, 
                error: 'Order not found for Natasha Chilton' 
            });
        }

        // Extract site name and WooCommerce order ID
        if (!natashaOrder.order_id || !natashaOrder.order_id.includes('-')) {
            return Response.json({
                success: false,
                error: 'Invalid order_id format',
                order_data: natashaOrder
            });
        }

        const [siteName, wooOrderId] = natashaOrder.order_id.split('-');
        const site = WOOCOMMERCE_SITES.find(s => s.name === siteName);

        if (!site) {
            return Response.json({
                success: false,
                error: `Site ${siteName} not found in configuration`,
                order_data: natashaOrder
            });
        }

        // Get WooCommerce credentials
        const consumerKey = Deno.env.get(site.key_env);
        const consumerSecret = Deno.env.get(site.secret_env);

        if (!consumerKey || !consumerSecret) {
            return Response.json({
                success: false,
                error: `API credentials not configured for ${siteName}`,
                order_data: natashaOrder
            });
        }

        // Fetch order from WooCommerce
        const auth = btoa(`${consumerKey}:${consumerSecret}`);
        const response = await fetch(`${site.api_url}/orders/${wooOrderId}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) {
            return Response.json({
                success: false,
                error: `WooCommerce API error: ${response.status}`,
                order_data: natashaOrder
            });
        }

        const wooOrder = await response.json();
        const currentWooStatus = mapOrderStatus(wooOrder.status);

        // Return comparison
        return Response.json({
            success: true,
            order_id: natashaOrder.order_id,
            customer: `${natashaOrder.first_name} ${natashaOrder.last_name}`,
            email: natashaOrder.email,
            tour: natashaOrder.tour,
            site: siteName,
            our_database_status: natashaOrder.status,
            woocommerce_raw_status: wooOrder.status,
            woocommerce_mapped_status: currentWooStatus,
            status_mismatch: natashaOrder.status !== currentWooStatus,
            should_update: natashaOrder.status !== currentWooStatus,
            woocommerce_order_data: {
                date_created: wooOrder.date_created,
                date_modified: wooOrder.date_modified,
                date_completed: wooOrder.date_completed
            }
        });

    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});