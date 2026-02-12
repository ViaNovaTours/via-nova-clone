import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const payload = await req.json();
        const emailToFind = payload?.email;

        if (!emailToFind) {
            return Response.json({ error: 'Email is required' }, { status: 400 });
        }

        // --- DIRECT FETCH FOR SPECIFIC ORDER VIA EMAIL ---
        const testSite = {
            name: "Bran Castle", 
            api_url: "https://brancastletickets.ro/wp-json/wc/v3",
            key_env: "WOOCOMMERCE_KEY_BRAN_CASTLE",
            secret_env: "WOOCOMMERCE_SECRET_BRAN_CASTLE"
        };

        const consumerKey = Deno.env.get(testSite.key_env);
        const consumerSecret = Deno.env.get(testSite.secret_env);

        if (!consumerKey || !consumerSecret) {
            return Response.json({ error: 'Missing API credentials for ' + testSite.name }, { status: 400 });
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);

        // 1. Find orders by email
        const searchResponse = await fetch(`${testSite.api_url}/orders?search=${encodeURIComponent(emailToFind)}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        
        if (!searchResponse.ok) {
             return Response.json({ error: `Failed to search orders: ${searchResponse.statusText}` }, { status: 500 });
        }
        
        const foundOrders = await searchResponse.json();
        
        if (foundOrders.length === 0) {
            return Response.json({ message: `No orders found for email: ${emailToFind}` });
        }
        
        const orderData = foundOrders[0]; // Assume the first result is the correct one

        const debugResults = {
            site: testSite.name,
            email_searched: emailToFind,
            order_id: orderData.id,
            api_response_status: searchResponse.status,
            order_found: !!orderData,
            raw_order_data: orderData,
            ticket_parsing_analysis: null
        };

        if (orderData) {
            // Analyze the line items and how our parsing logic would handle them
            const ticketParsingAnalysis = {
                line_items_count: (orderData.line_items || []).length,
                parsing_results: []
            };

            (orderData.line_items || []).forEach((item, index) => {
                const nameMatch = (item.name || '').match(/\s*x(\d+)$/);
                const realQuantity = nameMatch ? parseInt(nameMatch[1], 10) : (item.quantity || 1);
                const cleanName = (item.name || '').replace(/\s*x\d+$/, '').trim();

                ticketParsingAnalysis.parsing_results.push({
                    item_index: index,
                    original_name: item.name,
                    original_quantity: item.quantity,
                    name_regex_match: nameMatch ? nameMatch[0] : null,
                    extracted_quantity: realQuantity,
                    clean_name: cleanName,
                    item_total: item.total,
                    item_price: item.price,
                    item_meta_data: item.meta_data || []
                });
            });

            debugResults.ticket_parsing_analysis = ticketParsingAnalysis;
        }

        return Response.json(debugResults);
    } catch (error) {
        console.error('Debug error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});