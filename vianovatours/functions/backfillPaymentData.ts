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

const extractPaymentMethod = (wooOrder) => {
    const method = wooOrder.payment_method || '';
    if (method.includes('stripe') || method.includes('card')) return 'stripe';
    if (method.includes('airwallex')) return 'airwallex';
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

        // Get URL parameters for pagination
        const url = new URL(req.url);
        const limitParam = url.searchParams.get('limit');
        const MAX_ORDERS_PER_RUN = limitParam ? parseInt(limitParam) : 50; // Process only 50 orders per run by default

        console.log('Starting payment data backfill...');
        
        const allOrders = await base44.asServiceRole.entities.Order.list();
        console.log(`Found ${allOrders.length} total orders`);
        
        const ordersNeedingPaymentData = allOrders.filter(order => {
            if (!order.order_id) return false;
            const parts = order.order_id.split('-');
            if (parts.length < 2) return false;
            // Check if already has payment data
            if (order.payment_method && order.payment_transaction_id) return false;
            return true;
        });

        console.log(`${ordersNeedingPaymentData.length} orders need payment data`);
        
        // Limit to MAX_ORDERS_PER_RUN to avoid timeout
        const ordersToProcess = ordersNeedingPaymentData.slice(0, MAX_ORDERS_PER_RUN);
        console.log(`Processing ${ordersToProcess.length} orders in this run`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        const BATCH_SIZE = 3; // Reduced from 5
        const DELAY_BETWEEN_BATCHES = 5000; // Increased to 5 seconds
        const DELAY_BETWEEN_UPDATES = 1000; // Increased to 1 second

        for (let i = 0; i < ordersToProcess.length; i++) {
            const order = ordersToProcess[i];
            
            const parts = order.order_id.split('-');
            const siteName = parts[0];
            const wooOrderId = parts[1];
            
            const site = WOOCOMMERCE_SITES.find(s => s.name === siteName);
            if (!site) {
                errors.push(`Unknown site: ${siteName} for order ${order.order_id}`);
                errorCount++;
                continue;
            }

            const consumerKey = Deno.env.get(site.key_env);
            const consumerSecret = Deno.env.get(site.secret_env);
            
            if (!consumerKey || !consumerSecret) {
                skippedCount++;
                continue;
            }

            try {
                // Fetch the WooCommerce order
                const auth = btoa(`${consumerKey}:${consumerSecret}`);
                const response = await fetch(`${site.api_url}/orders/${wooOrderId}`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        errors.push(`WooCommerce order not found: ${order.order_id}`);
                        errorCount++;
                        await delay(DELAY_BETWEEN_UPDATES);
                        continue;
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const wooOrder = await response.json();
                const paymentData = extractPaymentData(wooOrder);

                // Only update if we got useful payment data
                if (paymentData.payment_method || paymentData.payment_transaction_id) {
                    await base44.asServiceRole.entities.Order.update(order.id, paymentData);
                    updatedCount++;
                    console.log(`✓ Updated ${order.order_id} with payment data (${updatedCount}/${ordersToProcess.length})`);
                } else {
                    skippedCount++;
                    console.log(`⊘ Skipped ${order.order_id} - no payment data available`);
                }
                
                await delay(DELAY_BETWEEN_UPDATES);
                
                if ((i + 1) % BATCH_SIZE === 0) {
                    console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}, pausing...`);
                    await delay(DELAY_BETWEEN_BATCHES);
                }
                
            } catch (error) {
                if (error.message.includes('Rate limit') || error.message.includes('429')) {
                    console.log(`Rate limit hit at order ${updatedCount}, stopping this run`);
                    errors.push(`Rate limit hit - run again to continue`);
                    break; // Stop processing to avoid more rate limit errors
                } else {
                    errors.push(`Failed to update ${order.order_id}: ${error.message}`);
                    errorCount++;
                }
            }
        }

        const remainingCount = ordersNeedingPaymentData.length - ordersToProcess.length;

        return Response.json({
            success: true,
            total_orders: allOrders.length,
            total_needing_update: ordersNeedingPaymentData.length,
            processed_this_run: ordersToProcess.length,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount,
            remaining: remainingCount + (ordersNeedingPaymentData.length - updatedCount - skippedCount - errorCount),
            error_details: errors.length > 0 ? errors.slice(0, 20) : null,
            note: remainingCount > 0 
                ? `Run again to process ${remainingCount} more orders. Add ?limit=100 to URL to process more per run.` 
                : updatedCount > 0 
                    ? 'Batch complete! Run again if more orders need processing.' 
                    : 'No updates needed.'
        });

    } catch (error) {
        console.error('Backfill error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n')
        }, { status: 500 });
    }
});