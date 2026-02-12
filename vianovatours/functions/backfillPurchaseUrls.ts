import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const WOOCOMMERCE_SITES = [
    { name: "AlcatrazTourism", api_url: "https://alcatraztourism.com/wp-json/wc/v3" },
    { name: "PelesCastle", api_url: "https://pelescastle.ro/wp-json/wc/v3" },
    { name: "BranCastle", api_url: "https://brancastletickets.ro/wp-json/wc/v3" },
    { name: "StatueofLiberty", api_url: "https://statueoflibertytickets.org/wp-json/wc/v3" },
    { name: "CorvinCastle", api_url: "https://corvincastle.ro/wp-json/wc/v3" },
    { name: "HadriansVilla", api_url: "https://hadrians-villa.it/wp-json/wc/v3" },
    { name: "PenaPalace", api_url: "https://penapalace.pt/wp-json/wc/v3" },
    { name: "VillaEste", api_url: "https://villa-d-este.it/wp-json/wc/v3" },
    { name: "CasaDiGiulietta", api_url: "https://casadigiulietta.it/wp-json/wc/v3" }
];

const getBaseUrl = (apiUrl) => {
    return apiUrl.replace('/wp-json/wc/v3', '');
};

// Helper function to add delay
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

        console.log('Starting purchase URL backfill...');
        
        // Get all orders
        const allOrders = await base44.asServiceRole.entities.Order.list();
        console.log(`Found ${allOrders.length} total orders`);
        
        // Filter to only orders that need updating
        const ordersNeedingUpdate = allOrders.filter(order => {
            if (order.purchase_url) return false;
            if (!order.order_id) return false;
            const parts = order.order_id.split('-');
            if (parts.length < 2) return false;
            return true;
        });

        console.log(`${ordersNeedingUpdate.length} orders need purchase_url`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        // Process in smaller batches with delays to avoid rate limits
        const BATCH_SIZE = 10;
        const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
        const DELAY_BETWEEN_UPDATES = 200; // 200ms between each update

        for (let i = 0; i < ordersNeedingUpdate.length; i++) {
            const order = ordersNeedingUpdate[i];
            
            // Extract site name from order_id (format: "SiteName-123")
            const parts = order.order_id.split('-');
            const siteName = parts[0];
            const site = WOOCOMMERCE_SITES.find(s => s.name === siteName);

            if (!site) {
                errors.push(`Unknown site: ${siteName} for order ${order.order_id}`);
                errorCount++;
                continue;
            }

            try {
                const baseUrl = getBaseUrl(site.api_url);
                await base44.asServiceRole.entities.Order.update(order.id, {
                    purchase_url: baseUrl
                });
                updatedCount++;
                console.log(`✓ Updated ${order.order_id} with ${baseUrl} (${updatedCount}/${ordersNeedingUpdate.length})`);
                
                // Add delay between each update to avoid rate limits
                await delay(DELAY_BETWEEN_UPDATES);
                
                // Add longer delay after each batch
                if ((i + 1) % BATCH_SIZE === 0) {
                    console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}, pausing...`);
                    await delay(DELAY_BETWEEN_BATCHES);
                }
                
            } catch (error) {
                // Check if it's a rate limit error
                if (error.message.includes('Rate limit') || error.message.includes('429')) {
                    console.log(`Rate limit hit at order ${updatedCount}, waiting 5 seconds...`);
                    await delay(5000);
                    // Retry this order
                    try {
                        const baseUrl = getBaseUrl(site.api_url);
                        await base44.asServiceRole.entities.Order.update(order.id, {
                            purchase_url: baseUrl
                        });
                        updatedCount++;
                        console.log(`✓ Retried and updated ${order.order_id}`);
                        await delay(DELAY_BETWEEN_UPDATES);
                    } catch (retryError) {
                        errors.push(`Failed to update ${order.order_id} after retry: ${retryError.message}`);
                        errorCount++;
                    }
                } else {
                    errors.push(`Failed to update ${order.order_id}: ${error.message}`);
                    errorCount++;
                }
            }
        }

        const remainingCount = allOrders.filter(order => {
            if (order.purchase_url) return false;
            if (!order.order_id) return false;
            const parts = order.order_id.split('-');
            if (parts.length < 2) return false;
            return true;
        }).length;

        return Response.json({
            success: true,
            total_orders: allOrders.length,
            needed_update: ordersNeedingUpdate.length,
            updated: updatedCount,
            errors: errorCount,
            remaining: remainingCount,
            error_details: errors.length > 0 ? errors.slice(0, 50) : null, // Limit error details to first 50
            note: remainingCount > 0 ? `Run again to process ${remainingCount} remaining orders` : 'All orders processed!'
        });

    } catch (error) {
        console.error('Backfill error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});