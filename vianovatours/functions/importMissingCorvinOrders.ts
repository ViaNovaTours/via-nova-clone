import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const extractTourDate = (wooOrder) => {
    for (const item of (wooOrder.line_items || [])) {
        const dateMeta = (item.meta_data || []).find(m => m.key && m.key.toLowerCase() === 'date');
        if (dateMeta && dateMeta.value) {
            try {
                const parsedDate = new Date(dateMeta.value);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate.toISOString().split('T')[0];
                }
            } catch (e) { /* continue */ }
        }
    }
    return wooOrder.date_created ? new Date(wooOrder.date_created).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
};

const extractTourTime = (wooOrder) => {
    for (const item of (wooOrder.line_items || [])) {
        const timeMeta = (item.meta_data || []).find(m => m.key && m.key.toLowerCase() === 'time');
        if (timeMeta && timeMeta.value) {
            const timeMatch = timeMeta.value.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
            if (timeMatch) return timeMatch[0];
        }
    }
    return '';
};

const mapOrderStatus = (wooStatus) => {
    switch (wooStatus) {
        case 'completed': return 'complete';
        case 'refunded': return 'refunded';
        case 'failed': return 'failed';
        case 'on-hold': return 'on-hold';
        case 'processing': return 'new'; // Processing orders should be "new" for action
        case 'pending': return 'new';
        default: return 'new';
    }
};

const getSmartStatus = (tourType, tourDateStr) => {
    if (!tourDateStr) return 'new';
    const tourDate = new Date(tourDateStr);
    const now = new Date();
    tourDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const daysUntilTour = (tourDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const bufferDays = 15; // Corvin Castle buffer
    return daysUntilTour > bufferDays ? 'reserved_date' : 'new';
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const site = {
            name: "CorvinCastle",
            tour_type: "Corvin Castle Tour",
            api_url: "https://corvincastle.ro/wp-json/wc/v3",
            key_env: "WOOCOMMERCE_KEY_CORVIN_CASTLE",
            secret_env: "WOOCOMMERCE_SECRET_CORVIN_CASTLE"
        };

        const consumerKey = Deno.env.get(site.key_env);
        const consumerSecret = Deno.env.get(site.secret_env);

        if (!consumerKey || !consumerSecret) {
            return Response.json({ error: 'Missing API credentials for Corvin Castle' }, { status: 400 });
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);

        // Find our highest Corvin order number
        const allOrders = await base44.entities.Order.list();
        const corvinOrders = allOrders.filter(order => order.order_id && order.order_id.startsWith('CorvinCastle-'));
        const highestOrderNumber = Math.max(...corvinOrders.map(order => {
            const num = parseInt(order.order_id.split('-')[1]);
            return isNaN(num) ? 0 : num;
        }));

        console.log(`Highest existing Corvin order: ${highestOrderNumber}`);

        // Fetch all orders from WooCommerce that are newer than our highest
        const response = await fetch(`${site.api_url}/orders?per_page=100&orderby=id&order=desc`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) {
            return Response.json({ error: `Failed to fetch orders: ${response.statusText}` }, { status: 500 });
        }

        const wooOrders = await response.json();
        const missingOrders = wooOrders.filter(order => order.id > highestOrderNumber);

        const importResults = [];
        let importedCount = 0;

        for (const wooOrder of missingOrders) {
            try {
                const orderId = `${site.name}-${wooOrder.id}`;

                // Extract tickets with correct quantity parsing
                const tickets = [];
                (wooOrder.line_items || []).forEach(item => {
                    const nameMatch = (item.name || '').match(/\s*x(\d+)$/);
                    let quantity;
                    let cleanName;
                    
                    if (nameMatch) {
                        quantity = parseInt(nameMatch[1], 10);
                        cleanName = (item.name || '').replace(/\s*x\d+$/, '').trim();
                    } else {
                        quantity = item.quantity || 1;
                        cleanName = (item.name || '').trim();
                    }
                    
                    tickets.push({ type: cleanName, quantity: quantity });
                });

                const tourDate = extractTourDate(wooOrder);
                const tourTime = extractTourTime(wooOrder);
                const wooMappedStatus = mapOrderStatus(wooOrder.status);
                
                // Use smart status logic for processing/pending orders
                const finalStatus = ['processing', 'pending'].includes(wooOrder.status) 
                    ? getSmartStatus(site.tour_type, tourDate)
                    : wooMappedStatus;

                const transformedOrder = {
                    order_id: orderId,
                    tour: site.tour_type,
                    tour_date: tourDate,
                    tour_time: tourTime,
                    tickets,
                    extras: [],
                    first_name: wooOrder.billing?.first_name || '',
                    last_name: wooOrder.billing?.last_name || '',
                    email: wooOrder.billing?.email || '',
                    phone: wooOrder.billing?.phone || '',
                    status: finalStatus,
                    priority: 'normal',
                    purchase_date: wooOrder.date_created,
                    fulfilled_by: null,
                    venue: `${site.name} - Main Location`,
                    currency: (wooOrder.currency || 'USD').toUpperCase(),
                    total_cost: parseFloat(wooOrder.total) || 0,
                    projected_profit: parseFloat(wooOrder.total) || 0
                };

                await base44.entities.Order.create(transformedOrder);
                importedCount++;

                importResults.push({
                    order_id: orderId,
                    customer: `${transformedOrder.first_name} ${transformedOrder.last_name}`,
                    status: finalStatus,
                    woo_status: wooOrder.status,
                    total: transformedOrder.total_cost
                });

            } catch (error) {
                console.error(`Failed to import order ${wooOrder.id}:`, error);
                importResults.push({
                    order_id: `CorvinCastle-${wooOrder.id}`,
                    error: error.message
                });
            }
        }

        return Response.json({
            success: true,
            message: `Successfully imported ${importedCount} missing Corvin Castle orders`,
            highest_existing_order: highestOrderNumber,
            total_missing_orders: missingOrders.length,
            imported_count: importedCount,
            imported_orders: importResults
        });

    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});