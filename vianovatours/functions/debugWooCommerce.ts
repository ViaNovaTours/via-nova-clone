import { createClientFromRequest } from 'npm:@base44/sdk@0.7.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Test just one site first - Peles Castle
        const testSite = {
            name: "Peles Castle",
            api_url: "https://pelescastle.ro/wp-json/wc/v3",
            key_env: "WOOCOMMERCE_KEY_PELES_CASTLE",
            secret_env: "WOOCOMMERCE_SECRET_PELES_CASTLE",
            currency: "RON"
        };

        const consumerKey = Deno.env.get(testSite.key_env);
        const consumerSecret = Deno.env.get(testSite.secret_env);

        const debugResults = {
            site: testSite.name,
            credentials_found: !!consumerKey && !!consumerSecret,
            api_url: testSite.api_url,
            consumer_key_preview: consumerKey ? `${consumerKey.substring(0, 10)}...` : 'Not found',
            existing_ticket_types: [],
            raw_products: [],
            processed_products: [],
            api_tests: [],
            errors: []
        };

        // Check existing ticket types
        const existingTicketTypes = await base44.entities.TicketType.list();
        debugResults.existing_ticket_types = existingTicketTypes.map(t => ({
            tour_name: t.tour_name,
            name: t.name,
            price: t.price,
            lookup_key: `${t.tour_name}-${t.name}`.toLowerCase()
        }));

        if (!consumerKey || !consumerSecret) {
            debugResults.errors.push('Missing API credentials');
            return Response.json(debugResults);
        }

        const auth = btoa(`${consumerKey}:${consumerSecret}`);

        // Test multiple API endpoints
        const testUrls = [
            `${testSite.api_url}`,
            `${testSite.api_url}/products`,
            `${testSite.api_url}/products?per_page=5`,
            `${testSite.api_url}/products?per_page=5&status=publish`,
            `${testSite.api_url}/products?per_page=5&type=simple`,
            `${testSite.api_url}/products?per_page=100`,
            `${testSite.api_url}/products?orderby=date&order=desc&per_page=10`
        ];

        for (const url of testUrls) {
            try {
                const response = await fetch(url, {
                    headers: { 'Authorization': `Basic ${auth}` }
                });

                const testResult = {
                    url: url,
                    status: response.status,
                    status_text: response.statusText,
                    content_type: response.headers.get('content-type'),
                    success: response.ok
                };

                if (response.ok) {
                    try {
                        const data = await response.json();
                        if (Array.isArray(data)) {
                            testResult.result_type = 'array';
                            testResult.count = data.length;
                            if (data.length > 0) {
                                testResult.sample = {
                                    name: data[0].name || 'No name',
                                    type: data[0].type || 'No type',
                                    status: data[0].status || 'No status',
                                    price: data[0].price || 'No price'
                                };
                            }
                            // Store products from the main query
                            if (url.includes('/products?per_page=100')) {
                                debugResults.raw_products = data.slice(0, 10).map(p => ({
                                    id: p.id,
                                    name: p.name,
                                    type: p.type,
                                    status: p.status,
                                    purchasable: p.purchasable,
                                    price: p.price
                                }));
                            }
                        } else if (typeof data === 'object') {
                            testResult.result_type = 'object';
                            testResult.properties = Object.keys(data).slice(0, 5);
                        }
                    } catch (e) {
                        testResult.parse_error = e.message;
                        const text = await response.clone().text();
                        testResult.raw_response = text.substring(0, 200);
                    }
                } else {
                    const errorText = await response.text();
                    testResult.error_details = errorText.substring(0, 200);
                }

                debugResults.api_tests.push(testResult);

            } catch (error) {
                debugResults.api_tests.push({
                    url: url,
                    error: error.message
                });
            }
        }

        return Response.json(debugResults);

    } catch (error) {
        return Response.json({ 
            error: error.message, 
            stack: error.stack.split('\n').slice(0, 5).join('\n') 
        }, { status: 500 });
    }
});