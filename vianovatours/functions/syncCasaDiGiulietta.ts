import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PROFIT_PER_TICKET_EURO = 11;

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

const extractPaymentData = (wooOrder) => {
    const paymentData = {
        payment_method: extractPaymentMethod(wooOrder),
        payment_transaction_id: wooOrder.transaction_id || null,
        payment_status: null,
        payment_captured: null
    };

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
    if (wooStatus === 'processing') return 'new';
    return wooStatus;
};

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

        console.log('🏰 Syncing Casa di Giulietta orders...');
        
        // Get credentials from database
        const credentials = await base44.asServiceRole.entities.WooCommerceCredentials.filter({ 
            site_name: 'CasaDiGiulietta',
            is_active: true
        });

        if (credentials.length === 0) {
            return Response.json({
                success: false,
                error: 'Casa di Giulietta credentials not found or inactive'
            }, { status: 404 });
        }

        const site = credentials[0];
        console.log('✅ Using credentials:', {
            site_name: site.site_name,
            website_url: site.website_url,
            api_url: site.api_url
        });

        // Fetch orders from WooCommerce
        const auth = btoa(`${site.consumer_key}:${site.consumer_secret}`);
        const wooUrl = `${site.api_url}/orders?per_page=100&orderby=id&order=desc`;
        
        console.log(`📡 Fetching from: ${wooUrl}`);
        
        const response = await fetch(wooUrl, {
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ WooCommerce API Error (${response.status}):`, errorText);
            return Response.json({
                success: false,
                error: `WooCommerce API Error (${response.status}): ${response.statusText}`,
                details: errorText,
                url_used: site.api_url
            }, { status: response.status });
        }

        const wooOrders = await response.json();
        console.log(`✅ Found ${wooOrders.length} orders on WooCommerce`);

        if (wooOrders.length === 0) {
            return Response.json({
                success: true,
                message: 'No orders found on Casa di Giulietta WooCommerce site',
                imported: 0,
                skipped: 0
            });
        }

        // Get existing orders
        const existingOrders = await base44.asServiceRole.entities.Order.list();
        const existingIds = new Set(
            existingOrders
                .filter(o => o.order_id && o.order_id.startsWith('CasaDiGiulietta-'))
                .map(o => o.order_id)
        );

        console.log(`📊 Found ${existingIds.size} existing Casa di Giulietta orders in database`);

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (const wooOrder of wooOrders) {
            const orderId = `CasaDiGiulietta-${wooOrder.id}`;
            
            if (existingIds.has(orderId)) {
                skipped++;
                continue;
            }

            try {
                const tickets = (wooOrder.line_items || []).map(item => {
                    const nameMatch = (item.name || '').match(/\s*x(\d+)$/);
                    const quantity = nameMatch ? parseInt(nameMatch[1], 10) : (item.quantity || 1);
                    const type = nameMatch ? (item.name || '').replace(/\s*x\d+$/, '').trim() : (item.name || '').trim();
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

                const orderData = {
                    order_id: orderId,
                    tour: site.tour_name,
                    tour_date: tourDate,
                    tour_time: extractTourTime(wooOrder),
                    tickets: ticketsWithCosts,
                    extras: [],
                    first_name: wooOrder.billing?.first_name || '',
                    last_name: wooOrder.billing?.last_name || '',
                    email: wooOrder.billing?.email || '',
                    phone: wooOrder.billing?.phone || '',
                    status: wooMappedStatus,
                    priority: 'normal',
                    purchase_date: wooOrder.date_created,
                    purchase_url: site.website_url,
                    fulfilled_by: null,
                    venue: `${site.site_name} - Main Location`,
                    currency: (wooOrder.currency || 'EUR').toUpperCase(),
                    total_cost: totalCost,
                    total_ticket_cost: totalTicketCost,
                    projected_profit: projectedProfit,
                    ...paymentData
                };

                await base44.asServiceRole.entities.Order.create(orderData);
                imported++;
                console.log(`✅ Imported order ${orderId}`);

            } catch (error) {
                errors.push(`Failed to import order ${orderId}: ${error.message}`);
                console.error(`❌ Error importing ${orderId}:`, error);
            }
        }

        console.log(`🎉 Sync complete: ${imported} imported, ${skipped} skipped`);

        return Response.json({
            success: true,
            message: `Successfully imported ${imported} Casa di Giulietta orders`,
            total_on_woocommerce: wooOrders.length,
            imported,
            skipped,
            errors: errors.length > 0 ? errors : null
        });

    } catch (error) {
        console.error('❌ Casa di Giulietta sync error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        }, { status: 500 });
    }
});