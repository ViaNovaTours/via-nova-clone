import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Helper to extract base URL from API URL
const getBaseUrl = (apiUrl) => {
    return apiUrl.replace('/wp-json/wc/v3', '');
};

// Helper to extract payment method from WooCommerce data
const extractPaymentMethod = (wooOrder) => {
    const method = wooOrder.payment_method || '';
    const title = (wooOrder.payment_method_title || '').toLowerCase();
    
    // Check payment method title first (more reliable)
    if (title.includes('airwallex')) return 'airwallex';
    if (title.includes('stripe')) return 'stripe';
    if (title.includes('paypal')) return 'paypal';
    
    // Then check method ID
    if (method.includes('airwallex')) return 'airwallex';
    if (method.includes('stripe') || method.includes('card')) return 'stripe';
    if (method.includes('paypal')) return 'paypal';
    
    return method || null;
};

// Helper to extract payment data from WooCommerce order
const extractPaymentData = (wooOrder) => {
    const paymentData = {
        payment_method: extractPaymentMethod(wooOrder),
        payment_transaction_id: wooOrder.transaction_id || null,
        payment_status: null,
        payment_captured: null
    };

    // Map WooCommerce payment status
    if (wooOrder.status === 'completed') {
        paymentData.payment_status = 'succeeded';
        paymentData.payment_captured = true;
    } else if (wooOrder.status === 'processing') {
        paymentData.payment_status = 'processing';
        paymentData.payment_captured = true;
    } else if (wooOrder.status === 'pending') {
        paymentData.payment_status = 'pending';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'failed') {
        paymentData.payment_status = 'failed';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'cancelled') {
        paymentData.payment_status = 'canceled';
        paymentData.payment_captured = false;
    } else if (wooOrder.status === 'refunded') {
        paymentData.payment_status = 'refunded';
        paymentData.payment_captured = true;
    }

    return paymentData;
};

// Re-usable helper functions
const extractTourDate = (wooOrder) => {
    for (const item of (wooOrder.line_items || [])) {
        const dateMeta = (item.meta_data || []).find(m => m.key && m.key.toLowerCase() === 'date');
        if (dateMeta && dateMeta.value) {
            try {
                const parsedDate = new Date(dateMeta.value);
                if (!isNaN(parsedDate.getTime())) return parsedDate.toISOString().split('T')[0];
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
    const statusMap = {
        'pending': 'pending',
        'processing': 'unprocessed',
        'on-hold': 'on-hold',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'refunded': 'refunded',
        'failed': 'failed',
        'pending-payment': 'pending-payment'
    };
    return statusMap[wooStatus] || 'unprocessed';
};

// Enhanced order creation to include automatic profit calculation and payment data
const PROFIT_PER_TICKET_EURO = 11;

// Helper to convert UTC date to timezone-aware date string
const convertToTimezone = (utcDate, timezone) => {
    try {
        return new Date(utcDate).toLocaleString('en-US', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (e) {
        return null;
    }
};

const createOrderWithProfitCalculation = (site, wooOrder, tourTimezone, officialSiteUrl) => {
    const tickets = (wooOrder.line_items || []).map(item => {
        // Try multiple patterns to extract quantity from the name
        let quantity = item.quantity || 1; // Default to WooCommerce quantity
        let type = (item.name || '').trim();
        
        // Pattern 1: "Some Ticket Name x2" (at the end)
        const endPatternMatch = type.match(/\s+x(\d+)$/i);
        if (endPatternMatch) {
            quantity = parseInt(endPatternMatch[1], 10);
            type = type.replace(/\s+x\d+$/i, '').trim();
        } 
        // Pattern 2: "Some Ticket Name (x2)" (with parentheses)
        else {
            const parenPatternMatch = type.match(/\(x(\d+)\)/i);
            if (parenPatternMatch) {
                quantity = parseInt(parenPatternMatch[1], 10);
                type = type.replace(/\s*\(x\d+\)/i, '').trim();
            }
        }
        
        return { type, quantity, cost_per_ticket: 0 };
    });

    const totalCost = parseFloat(wooOrder.total) || 0;
    const totalTickets = tickets.reduce((sum, t) => sum + t.quantity, 0);
    
    const customerPaidPerTicket = totalTickets > 0 ? totalCost / totalTickets : 0;
    const agentCostPerTicket = Math.max(0, customerPaidPerTicket - PROFIT_PER_TICKET_EURO);
    
    const ticketsWithCosts = tickets.map(ticket => ({
        ...ticket,
        cost_per_ticket: agentCostPerTicket
    }));
    
    const totalTicketCost = ticketsWithCosts.reduce((sum, ticket) => 
        sum + (ticket.cost_per_ticket * ticket.quantity), 0);
    const projectedProfit = totalCost - totalTicketCost;

    const tourDate = extractTourDate(wooOrder);
    const wooMappedStatus = mapOrderStatus(wooOrder.status);
    const paymentData = extractPaymentData(wooOrder);

    // Calculate timezone-aware purchase dates
    const purchaseDateUTC = wooOrder.date_created;
    const purchaseDatePST = tourTimezone ? convertToTimezone(purchaseDateUTC, 'America/Los_Angeles') : null;
    const purchaseDateTourTZ = tourTimezone ? convertToTimezone(purchaseDateUTC, tourTimezone) : null;

    return {
        order_id: `${site.site_name}-${wooOrder.id}`,
        tour: site.tour_name,
        tour_date: tourDate,
        tour_time: extractTourTime(wooOrder),
        tour_timezone: tourTimezone || null,
        tickets: ticketsWithCosts,
        extras: [],
        first_name: wooOrder.billing?.first_name || '',
        last_name: wooOrder.billing?.last_name || '',
        email: wooOrder.billing?.email || '',
        phone: wooOrder.billing?.phone || '',
        address: wooOrder.billing?.address_1 || '',
        city: wooOrder.billing?.city || '',
        state_region: wooOrder.billing?.state || '',
        zip: wooOrder.billing?.postcode || '',
        country: wooOrder.billing?.country || '',
        status: wooMappedStatus,
        priority: 'normal',
        purchase_date: purchaseDateUTC,
        purchase_date_pst: purchaseDatePST,
        purchase_date_tour_tz: purchaseDateTourTZ,
        purchase_url: site.website_url,
        official_site_url: officialSiteUrl || null,
        fulfilled_by: null,
        venue: `${site.site_name} - Main Location`,
        currency: (wooOrder.currency || 'USD').toUpperCase(),
        total_cost: totalCost,
        total_ticket_cost: totalTicketCost,
        projected_profit: projectedProfit,
        ...paymentData
    };
};

// --- Main Sync Logic ---
Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    let totalImported = 0;
    let statusUpdated = 0;
    const errors = [];
    const warnings = [];
    
    let allDbOrders;
    try {
        allDbOrders = await base44.asServiceRole.entities.Order.list();
    } catch (e) {
        return Response.json({
            success: false,
            error: `Failed to load existing orders: ${e.message}`
        }, { status: 500 });
    }

    // Load WooCommerce sites from database and get tour timezones
    let sites;
    let tourTimezones = {};
    let tourOfficialUrls = {};
    try {
        const credentials = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ is_active: true });
        const tours = await base44.asServiceRole.entities.Tour.list();

        // Create a map of tour names to timezones and official URLs (case-insensitive)
        tours.forEach(tour => {
            const normalizedName = tour.name.toLowerCase();
            if (tour.timezone) {
                tourTimezones[normalizedName] = tour.timezone;
            }
            if (tour.official_ticketing_url) {
                tourOfficialUrls[normalizedName] = tour.official_ticketing_url;
            }
        });
        
        sites = credentials.map(cred => ({
            site_name: cred.site_name,
            tour_name: cred.tour_name,
            api_url: cred.api_url,
            website_url: cred.website_url,
            consumer_key: cred.consumer_key,
            consumer_secret: cred.consumer_secret,
            timezone: tourTimezones[cred.tour_name.toLowerCase()] || null,
            official_site_url: tourOfficialUrls[cred.tour_name.toLowerCase()] || null
        }));
    } catch (e) {
        return Response.json({
            success: false,
            error: `Failed to load WooCommerce credentials: ${e.message}`
        }, { status: 500 });
    }

    if (sites.length === 0) {
        return Response.json({
            success: false,
            error: 'No active WooCommerce sites configured. Please add your tour credentials in Tour Setup page.'
        }, { status: 400 });
    }

    console.log(`Syncing ${sites.length} sites:`, sites.map(s => s.site_name).join(', '));

    for (const site of sites) {
        try {
            console.log(`\n--- Syncing ${site.site_name} ---`);
            const auth = btoa(`${site.consumer_key}:${site.consumer_secret}`);
            
            const siteOrders = allDbOrders.filter(order => order.order_id && order.order_id.startsWith(`${site.site_name}-`));
            const highestId = Math.max(0, ...siteOrders.map(o => parseInt(o.order_id.split('-')[1] || '0')));
            console.log(`${site.site_name}: Found ${siteOrders.length} existing orders, highest ID: ${highestId}`);

            // Fetch orders with pagination to handle sites with many orders
            let wooOrders = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore && page <= 5) { // Limit to 5 pages (500 orders) for safety
                const response = await fetch(`${site.api_url}/orders?per_page=100&page=${page}&orderby=id&order=desc`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });
                
                if (!response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('text/html')) {
                        errors.push(`${site.site_name}: Received HTML instead of JSON - check URL and credentials (Status: ${response.status})`);
                        console.error(`${site.site_name}: API returned HTML page, not JSON (Status: ${response.status})`);
                    } else {
                        errors.push(`Failed to fetch from ${site.site_name}: ${response.statusText}`);
                        console.error(`${site.site_name}: API error ${response.status}`);
                    }
                    break;
                }

                const pageOrders = await response.json();
                
                if (pageOrders.length === 0) {
                    hasMore = false;
                    break;
                }
                
                wooOrders = wooOrders.concat(pageOrders);
                
                // Stop fetching if we've gone past our highest ID
                const lowestIdOnPage = Math.min(...pageOrders.map(o => o.id));
                if (lowestIdOnPage <= highestId) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
            
            console.log(`${site.site_name}: Found ${wooOrders.length} orders on WooCommerce (fetched ${page} page${page > 1 ? 's' : ''})`);

            // Import new orders
            const missingOrders = wooOrders.filter(order => order.id > highestId);
            console.log(`${site.site_name}: ${missingOrders.length} new orders to import`);

            for (const wooOrder of missingOrders) {
                const transformedOrder = createOrderWithProfitCalculation(site, wooOrder, site.timezone, site.official_site_url);
                await base44.asServiceRole.entities.Order.create(transformedOrder);
                totalImported++;
                console.log(`${site.site_name}: ✓ Imported order ${wooOrder.id}`);
            }

            // Update existing orders with current WooCommerce status and payment data
            // Only update the 20 most recent orders to avoid rate limits
            const recentOrders = siteOrders
                .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                .slice(0, 20);
            
            for (const existingOrder of recentOrders) {
                const wooOrderId = parseInt(existingOrder.order_id.split('-')[1]);
                const wooOrder = wooOrders.find(wo => wo.id === wooOrderId);

                if (wooOrder) {
                    const wooMappedStatus = mapOrderStatus(wooOrder.status);
                    const paymentData = extractPaymentData(wooOrder);
                    
                    const updates = {};
                    let hasChanges = false;

                    // Check if status changed
                    if (existingOrder.status !== wooMappedStatus) {
                        updates.status = wooMappedStatus;
                        hasChanges = true;
                    }

                    // Check if payment data changed or is missing
                    if (paymentData.payment_transaction_id && existingOrder.payment_transaction_id !== paymentData.payment_transaction_id) {
                        updates.payment_transaction_id = paymentData.payment_transaction_id;
                        hasChanges = true;
                    }
                    
                    if (paymentData.payment_status && existingOrder.payment_status !== paymentData.payment_status) {
                        updates.payment_status = paymentData.payment_status;
                        hasChanges = true;
                    }
                    
                    if (paymentData.payment_captured !== null && existingOrder.payment_captured !== paymentData.payment_captured) {
                        updates.payment_captured = paymentData.payment_captured;
                        hasChanges = true;
                    }
                    
                    if (paymentData.payment_account_id && existingOrder.payment_account_id !== paymentData.payment_account_id) {
                        updates.payment_account_id = paymentData.payment_account_id;
                        hasChanges = true;
                    }

                    // Check if address data is missing and backfill from WooCommerce
                    if (!existingOrder.address && wooOrder.billing?.address_1) {
                        updates.address = wooOrder.billing.address_1;
                        hasChanges = true;
                    }
                    if (!existingOrder.city && wooOrder.billing?.city) {
                        updates.city = wooOrder.billing.city;
                        hasChanges = true;
                    }
                    if (!existingOrder.state_region && wooOrder.billing?.state) {
                        updates.state_region = wooOrder.billing.state;
                        hasChanges = true;
                    }
                    if (!existingOrder.zip && wooOrder.billing?.postcode) {
                        updates.zip = wooOrder.billing.postcode;
                        hasChanges = true;
                    }
                    if (!existingOrder.country && wooOrder.billing?.country) {
                        updates.country = wooOrder.billing.country;
                        hasChanges = true;
                    }
                    
                    // Check if official_site_url is missing and backfill from tour settings
                    if (!existingOrder.official_site_url && site.official_site_url) {
                        updates.official_site_url = site.official_site_url;
                        hasChanges = true;
                    }

                    // Only update if there are actual changes
                    if (hasChanges) {
                        await base44.asServiceRole.entities.Order.update(existingOrder.id, updates);
                        statusUpdated++;
                    }
                }
            }

        } catch (e) {
            errors.push(`Error processing ${site.site_name}: ${e.message}`);
            console.error(`${site.site_name}: Error -`, e);
        }
    }

    // --- Run Cleanup for duplicates ---
    let mergedCount = 0;
    try {
        const postImportOrders = await base44.asServiceRole.entities.Order.list();
        const ordersByWooId = {};
        postImportOrders.forEach(o => {
            if (!o.order_id) return;
            if (!ordersByWooId[o.order_id]) ordersByWooId[o.order_id] = [];
            ordersByWooId[o.order_id].push(o);
        });

        for (const wooId in ordersByWooId) {
            const group = ordersByWooId[wooId];
            if (group.length > 1) {
                group.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                const ordersToDelete = group.slice(1);
                
                // Delete one by one to handle missing entities gracefully
                for (const orderToDelete of ordersToDelete) {
                    try {
                        await base44.asServiceRole.entities.Order.delete(orderToDelete.id);
                        mergedCount++;
                    } catch (deleteError) {
                        console.log(`Could not delete order ${orderToDelete.id}: ${deleteError.message}`);
                        // Continue with other deletions
                    }
                }
            }
        }
    } catch (e) {
        errors.push(`Error during duplicate cleanup: ${e.message}`);
    }

    return Response.json({
        success: true,
        total_new_orders: totalImported,
        status_updates: statusUpdated,
        merged_duplicates: mergedCount,
        sites_synced: sites.length,
        warnings: warnings.length > 0 ? warnings : null,
        errors: errors.length > 0 ? errors : null
    });
});